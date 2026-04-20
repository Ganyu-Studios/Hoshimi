import { DebugLevels, EventNames } from "../../types/Manager";
import {
    type LavalinkPlayerVoice,
    LoopMode,
    type LyricsFoundEvent,
    type LyricsLineEvent,
    type LyricsNotFoundEvent,
    PlayerEventType,
    type PlayerJSON,
    type PlayerUpdate,
    type TrackEndEvent,
    TrackEndReason,
    type TrackExceptionEvent,
    type TrackStartEvent,
    type TrackStuckEvent,
    type WebSocketClosedEvent,
} from "../../types/Player";
import type { NodeStructure, PlayerStructure, TrackStructure } from "../../types/Structures";
import { stringify } from "../functions/utils";

/**
 *
 * Emitted when a queue track ends.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {boolean} [updateCurrent=true] Whether to update the current track or not.
 * @returns {Promise<void>} Yeah, this is something weird but it works.
 */
async function onEnd(this: PlayerStructure, updateCurrent: boolean = true): Promise<void> {
    if (
        this.queue.current &&
        !this.queue.history.find(
            (x): boolean => x.info.identifier === this.queue.current!.info.identifier && x.info.title === this.queue.current!.info.title,
        )
    ) {
        this.queue.history.unshift(this.queue.current);
        if (this.queue.history.length > this.manager.options.queueOptions.maxHistory!)
            this.queue.history.splice(this.manager.options.queueOptions.maxHistory!, this.queue.history.length);

        await this.queue.utils.save();

        this.manager.emit(
            EventNames.Debug,
            DebugLevels.Player,
            `[Player] -> [Previous] The track: ${this.queue.current.info.title} has been added to the previous track list.`,
        );
    }

    if (this.loop === LoopMode.Track && this.queue.current) this.queue.unshift(this.queue.current);
    if (this.loop === LoopMode.Queue && this.queue.current) this.queue.add(this.queue.current);

    if (!this.queue.current && updateCurrent) this.queue.current = await this.queue.utils.build(await this.queue.shift());

    await this.queue.utils.save();

    return;
}

/**
 *
 * The queue end event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {TrackStructure | null} track The track that ended.
 * @param {TrackEndEvent | TrackStuckEvent | TrackExceptionEvent} payload The payload of the event.
 * @returns {Promise<void>} Let's start a new queue!
 */
async function queueEnd(
    this: PlayerStructure,
    track: TrackStructure | null,
    payload: TrackEndEvent | TrackStuckEvent | TrackExceptionEvent,
): Promise<void> {
    if (await this.data.get("internal_nodeChange")) return;

    await this.data.delete("internal_stopPlaying");

    this.playing = false;
    this.paused = false;
    this.queue.current = null;

    if (typeof this.manager.options.queueOptions.autoplayFn === "function") {
        await this.manager.options.queueOptions.autoplayFn(this, track);

        this.manager.emit(EventNames.Debug, DebugLevels.Player, "[Queue] -> [Autoplay] Autoplay function executed.");

        if (this.queue.size > 0) await onEnd.call(this);
        if (this.queue.current) {
            if (payload.type === PlayerEventType.TrackEnd) this.manager.emit(EventNames.TrackEnd, this, track, payload);

            this.manager.emit(EventNames.Debug, DebugLevels.Player, "[Queue] -> [Autoplay] Track(s) queued from autoplay function.");

            return this.play({ noReplace: true, paused: false });
        }
    }

    if (this.queue.current) {
        if (payload.type === PlayerEventType.TrackEnd) this.manager.emit(EventNames.TrackEnd, this, track, payload);

        return this.play({ noReplace: true, paused: false });
    }

    if (payload.type === PlayerEventType.TrackEnd && payload.reason !== TrackEndReason.Stopped) await this.queue.utils.save();

    await onEnd.call(this, false);

    this.manager.emit(EventNames.QueueEnd, this, this.queue);
    this.manager.emit(EventNames.Debug, DebugLevels.Player, "[Player] -> [Queue] The queue has ended.");
}

/**
 *
 * The track start event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {TrackStartEvent} payload The payload of the event.
 * @returns {Promise<void>} I mean, it's a track start event, what do you expect?
 */
export async function trackStart(this: PlayerStructure, payload: TrackStartEvent): Promise<void> {
    if (!(await this.data.get("internal_nodeChange"))) {
        this.paused = false;
        this.playing = true;
    }

    if (this.queue.current) await this.queue.utils.save();

    this.manager.emit(EventNames.TrackStart, this, this.queue.current, payload);
    this.manager.emit(
        EventNames.Debug,
        DebugLevels.Player,
        `[Player] -> [Start] The track: ${this.queue.current?.info.title ?? "Unknown"} has started playing.`,
    );
}

/**
 *
 * Emitted when a track ends.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {TrackEndEvent} payload The payload of the event.
 * @returns {Promise<void>} The track ended... sadge.
 */
export async function trackEnd(this: PlayerStructure, payload: TrackEndEvent): Promise<void> {
    if (await this.data.get("internal_nodeChange")) return;

    // Just use queue.current - it should be correct now because trackStart handles sync
    const current: TrackStructure | null = this.queue.current;

    if (payload.reason === TrackEndReason.Replaced) {
        this.manager.emit(EventNames.TrackEnd, this, current, payload);
        return onEnd.call(this, false);
    }

    const isStopPlaying = await this.data.get("internal_stopPlaying");

    if (!this.queue.size && (this.loop === LoopMode.Off || isStopPlaying)) return queueEnd.call(this, current, payload);

    const reasons: TrackEndReason[] = [TrackEndReason.LoadFailed, TrackEndReason.Cleanup];
    if (reasons.includes(payload.reason)) {
        await onEnd.call(this);

        if (!this.queue.current) return queueEnd.call(this, current, payload);

        this.manager.emit(EventNames.TrackEnd, this, current, payload);
        this.manager.emit(
            EventNames.Debug,
            DebugLevels.Player,
            `[Player] -> [End] The track: ${this.queue.current?.info.title ?? "Unknown"} has ended.`,
        );

        if (this.queue.current) await this.play({ noReplace: true });

        return;
    }

    if (!this.queue.current) return queueEnd.call(this, current, payload);

    await onEnd.call(this);

    this.manager.emit(EventNames.TrackEnd, this, current, payload);
    this.manager.emit(
        EventNames.Debug,
        DebugLevels.Player,
        `[Player] -> [End] The track: ${this.queue.current?.info.title ?? "Unknown"} has ended.`,
    );

    if (this.queue.current) await this.play({ noReplace: true });

    return;
}

/**
 *
 * The track stuck event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {TrackStuckEvent} payload The payload of the event.
 * @returns {Promise<void>} The track stuck? Try to unstuck it!
 */
export async function trackStuck(this: PlayerStructure, payload: TrackStuckEvent): Promise<void> {
    this.manager.emit(EventNames.TrackStuck, this, this.queue.current, payload);
    this.manager.emit(
        EventNames.Debug,
        DebugLevels.Player,
        `[Player] -> [Stuck] The track: ${this.queue.current?.info.title ?? "Unknown"} has stuck.`,
    );

    const isStopPlaying = await this.data.get("internal_stopPlaying");

    if (!this.queue.size && (this.loop === LoopMode.Off || isStopPlaying)) {
        try {
            await this.node.updatePlayer({
                guildId: this.guildId,
                playerOptions: { track: { encoded: null } },
            });

            return;
        } catch {
            return queueEnd.call(this, this.queue.current, payload);
        }
    }

    await onEnd.call(this);

    if (!this.queue.current) return queueEnd.call(this, this.queue.current, payload);
}

/**
 *
 * The track error event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {TrackExceptionEvent} payload The payload of the event.
 * @returns {Promise<void>} Aww, the track has an error? That's sad.
 */
export async function trackError(this: PlayerStructure, payload: TrackExceptionEvent): Promise<void> {
    this.manager.emit(EventNames.TrackError, this, this.queue.current, payload);
    this.manager.emit(
        EventNames.Debug,
        DebugLevels.Player,
        `[Player] -> [Error] The track: ${this.queue.current?.info.title ?? "Unknown"} has error.`,
    );
}

/**
 *
 * The player update event.
 * @param {NodeStructure} this The node that emitted the event.
 * @param {PlayerUpdate} payload The payload of the event.
 * @returns {Promise<void>} Yeah, i don't know what to say here.
 */
export async function playerUpdate(this: NodeStructure, payload: PlayerUpdate): Promise<void> {
    const player: PlayerStructure | undefined = this.nodeManager.manager.getPlayer(payload.guildId);
    if (!player) return;

    const oldPlayer: PlayerJSON = player.toJSON();

    player.ping = payload.state.ping;
    player.connected = payload.state.connected;
    player.createdTimestamp = payload.state.time;
    player.lastPosition = payload.state.position || 0;
    player.lastPositionUpdate = Date.now();

    this.nodeManager.manager.emit(EventNames.PlayerUpdate, player, oldPlayer, payload);
    this.nodeManager.manager.emit(
        EventNames.Debug,
        DebugLevels.Node,
        `[Player] -> [Update] Player updated: ${player.guildId} | Payload: ${stringify(payload)}`,
    );
}

/**
 * The lyrics found event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {LyricsFoundEvent} payload The payload of the event.
 * @returns {Promise<void>} Yay! Let's sing along!
 */
export async function lyricsFound(this: PlayerStructure, payload: LyricsFoundEvent): Promise<void> {
    this.manager.emit(EventNames.LyricsFound, this, this.queue.current, payload);
    this.manager.emit(
        EventNames.Debug,
        DebugLevels.Player,
        `[Player] -> [Lyrics] The lyrics have been found: ${this.guildId} | Payload: ${stringify(payload)}`,
    );
}

/**
 * The lyrics line event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {LyricsLineEvent} payload The payload of the event.
 * @returns {Promise<void>} Let's be honest, you don't care about this.
 */
export async function lyricsLine(this: PlayerStructure, payload: LyricsLineEvent): Promise<void> {
    this.manager.emit(EventNames.LyricsLine, this, this.queue.current, payload);
    this.manager.emit(
        EventNames.Debug,
        DebugLevels.Player,
        `[Player] -> [Lyrics] The lyrics line has been found: ${this.guildId} | Payload: ${stringify(payload)}`,
    );
}

/**
 * The lyrics not found event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {LyricsNotFoundEvent} payload The payload of the event.
 * @returns {Promise<void>} Awww, no lyrics? That's sad.
 */
export async function lyricsNotFound(this: PlayerStructure, payload: LyricsNotFoundEvent): Promise<void> {
    this.manager.emit(EventNames.LyricsNotFound, this, this.queue.current, payload);
    this.manager.emit(
        EventNames.Debug,
        DebugLevels.Player,
        `[Player] -> [Lyrics] The lyrics were not found: ${this.guildId} | Payload: ${stringify(payload)}`,
    );
}

/**
 * The websocket closed event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {WebSocketClosedEvent} payload The payload of the event.
 * @returns {Promise<void>} Did you expect something new here?
 */
export async function socketClosed(this: PlayerStructure, payload: WebSocketClosedEvent): Promise<void> {
    this.manager.emit(EventNames.WebSocketClosed, this, payload);
    this.manager.emit(
        EventNames.Debug,
        DebugLevels.Player,
        `[Player] -> [Socket] The socket has closed: ${this.guildId} | Payload: ${stringify(payload)}`,
    );
}

/**
 *
 * Resumes players by library.
 * @param {NodeStructure} this The node that is resuming the players.
 * @param {PlayerStructure[]} players The players to be resumed.
 * @returns {Promise<void>} Nothing.
 */
export async function resumeByLibrary(this: NodeStructure, players: PlayerStructure[]): Promise<void> {
    this.nodeManager.manager.emit(EventNames.Debug, DebugLevels.Node, `[Socket] -> [${this.id}]: Resuming session by library...`);

    for (const player of players) {
        try {
            if (!player.playing && !player.paused && !player.queue.totalSize) {
                this.nodeManager.manager.emit(
                    EventNames.Debug,
                    DebugLevels.Node,
                    `[Player] -> [Resume] Destroyed player for guild ${player.guildId} due to empty queue.`,
                );
                await player.destroy();
                return;
            }

            const track: TrackStructure | null = player.queue.current;

            const voice: LavalinkPlayerVoice | null = player.voice.toLavalink();
            if (!voice) {
                this.nodeManager.manager.emit(
                    EventNames.Debug,
                    DebugLevels.Node,
                    `[Player] -> [Resume] Skipping guild ${player.guildId} because voice data is incomplete.`,
                );

                continue;
            }

            await player.updatePlayer({ playerOptions: { voice } });
            await player.connect();
            await player.queue.utils.sync({ override: false, syncCurrent: true });

            if (track)
                await player.play({
                    track,
                    noReplace: false,
                    position: player.lastPosition,
                    paused: player.paused,
                });
        } catch (error) {
            this.nodeManager.manager.emit(EventNames.NodeError, this, error);
        }

        this.nodeManager.manager.emit(
            EventNames.Debug,
            DebugLevels.Node,
            `[Player] -> [Resume] Resumed player for guild ${player.guildId} using the library.`,
        );
    }
}
