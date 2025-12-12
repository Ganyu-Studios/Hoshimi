import type { Track } from "../../classes/Track";
import { DebugLevels, Events } from "../../types/Manager";
import {
    LoopMode,
    type LyricsFoundEvent,
    type LyricsLineEvent,
    type LyricsNotFoundEvent,
    PlayerEventType,
    type PlayerUpdate,
    type TrackEndEvent,
    TrackEndReason,
    type TrackExceptionEvent,
    type TrackStartEvent,
    type TrackStuckEvent,
    type WebSocketClosedEvent,
} from "../../types/Player";
import type { NodeStructure, PlayerStructure } from "../../types/Structures";
import { stringify, validateTrack } from "../functions/utils";

/**
 *
 * Queue the track end event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @returns {Promise<void>} Yeah, this is something weird but it works.
 */
async function onEnd(this: PlayerStructure): Promise<void> {
    if (
        this.queue.current &&
        !this.queue.history.find(
            (x) => x.info.identifier === this.queue.current!.info.identifier && x.info.title === this.queue.current!.info.title,
        )
    ) {
        this.queue.history.unshift(this.queue.current);
        if (this.queue.history.length > this.manager.options.queueOptions.maxPreviousTracks!)
            this.queue.history.splice(this.manager.options.queueOptions.maxPreviousTracks!, this.queue.history.length);

        await this.queue.utils.save();

        this.manager.emit(
            Events.Debug,
            DebugLevels.Player,
            `[Player] -> [Previous] The track: ${this.queue.current.info.title} has been added to the previous track list.`,
        );
    }

    if (this.loop === LoopMode.Track && this.queue.current) this.queue.unshift(this.queue.current);
    if (this.loop === LoopMode.Queue && this.queue.current) this.queue.add(this.queue.current);

    if (!this.queue.current) this.queue.current = await validateTrack(this, this.queue.shift());

    await this.queue.utils.save();

    return;
}

/**
 *
 * The queue end event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {Track | null} track The track that ended.
 * @param {TrackEndEvent | TrackStuckEvent | TrackExceptionEvent} payload The payload of the event.
 * @returns {Promise<void>} Let's start a new queue!
 */
async function queueEnd(
    this: PlayerStructure,
    track: Track | null,
    payload: TrackEndEvent | TrackStuckEvent | TrackExceptionEvent,
): Promise<void> {
    this.playing = false;
    this.paused = false;
    this.queue.current = null;

    if (typeof this.manager.options.queueOptions.autoplayFn === "function") {
        await this.manager.options.queueOptions.autoplayFn(this, track);

        this.manager.emit(Events.Debug, DebugLevels.Player, "[Queue] -> [Autoplay] Autoplay function executed.");

        if (this.queue.size > 0) await onEnd.call(this);
        if (this.queue.current) {
            if (payload.type === PlayerEventType.TrackEnd) this.manager.emit(Events.TrackEnd, this, track, payload);

            this.manager.emit(Events.Debug, DebugLevels.Player, "[Queue] -> [Autoplay] Track(s) queued from autoplay function.");

            return this.play({ noReplace: true, paused: false });
        }
    }

    if (track) await this.queue.utils.save();
    if (payload.type === PlayerEventType.TrackEnd && payload.reason !== TrackEndReason.Stopped) await this.queue.utils.save();

    this.manager.emit(Events.QueueEnd, this, this.queue);
    this.manager.emit(Events.Debug, DebugLevels.Player, "[Player] -> [Queue] The queue has ended.");
}

/**
 *
 * The track start event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {TrackStartEvent} payload The payload of the event.
 * @returns {Promise<void>} I mean, it's a track start event, what do you expect?
 */
export async function trackStart(this: PlayerStructure, payload: TrackStartEvent): Promise<void> {
    this.paused = false;
    this.playing = true;

    if (this.queue.current) await this.queue.utils.save();

    this.manager.emit(Events.TrackStart, this, this.queue.current, payload);
    this.manager.emit(
        Events.Debug,
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
    const current = this.queue.current;

    if (!this.queue.size && this.loop === LoopMode.Off) return queueEnd.call(this, current, payload);

    switch (payload.reason) {
        case TrackEndReason.Stopped:
            // soontm
            break;

        case TrackEndReason.Replaced: {
            this.manager.emit(Events.TrackEnd, this, current, payload);
            return;
        }

        case TrackEndReason.LoadFailed:
        case TrackEndReason.Cleanup: {
            this.playing = false;

            await onEnd.call(this);

            if (!this.queue.size || !this.queue.current) return queueEnd.call(this, current, payload);

            this.manager.emit(Events.TrackEnd, this, current, payload);
            this.manager.emit(
                Events.Debug,
                DebugLevels.Player,
                `[Player] -> [End] The track: ${current?.info.title ?? "Unknown"} has ended.`,
            );

            this.queue.current = null;

            return this.play();
        }
    }

    if (current) await this.queue.utils.save();

    await onEnd.call(this);

    this.queue.current = null;

    if (!this.queue.size) {
        this.playing = false;
        return queueEnd.call(this, current, payload);
    }

    this.manager.emit(Events.TrackEnd, this, current, payload);
    this.manager.emit(Events.Debug, DebugLevels.Player, `[Player] -> [End] The track: ${current?.info.title ?? "Uhknown"} has ended.`);

    return this.play();
}

/**
 *
 * The track stuck event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {TrackStuckEvent} payload The payload of the event.
 * @returns {Promise<void>} The track stuck? Try to unstuck it!
 */
export async function trackStuck(this: PlayerStructure, payload: TrackStuckEvent): Promise<void> {
    this.manager.emit(Events.TrackStuck, this, this.queue.current, payload);

    this.manager.emit(
        Events.Debug,
        DebugLevels.Player,
        `[Player] -> [Stuck] The track: ${this.queue.current?.info.title ?? "Unknown"} has stuck.`,
    );

    if (!this.queue.size && this.loop === LoopMode.Off) {
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
    this.manager.emit(Events.TrackError, this, this.queue.current, payload);

    this.manager.emit(
        Events.Debug,
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
    const player = this.nodeManager.manager.getPlayer(payload.guildId);
    if (!player) return;

    const oldPlayer = player.toJSON();

    player.ping = payload.state.ping;
    player.connected = payload.state.connected;
    player.createdTimestamp = payload.state.time;
    player.position = payload.state.position;

    this.nodeManager.manager.emit(Events.PlayerUpdate, player, oldPlayer, payload);
    this.nodeManager.manager.emit(
        Events.Debug,
        DebugLevels.Node,
        `[Player] -> [Update] Player updated: ${player.guildId} | Payload: ${stringify(payload)}`,
    );
}

/**
 * The lyrics found event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {Track | null} track The track that emitted the event.
 * @param {LyricsFoundEvent} payload The payload of the event.
 * @returns {Promise<void>} Yay! Let's sing along!
 */
export async function lyricsFound(this: PlayerStructure, track: Track | null, payload: LyricsFoundEvent): Promise<void> {
    this.manager.emit(Events.LyricsFound, this, track, payload);
    this.manager.emit(
        Events.Debug,
        DebugLevels.Player,
        `[Player] -> [Lyrics] The lyrics have been found: ${this.guildId} | Payload: ${stringify(payload)}`,
    );
}

/**
 * The lyrics line event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {Track | null} track The track that emitted the event.
 * @param {LyricsLineEvent} payload The payload of the event.
 * @returns {Promise<void>} Let's be honest, you don't care about this.
 */
export async function lyricsLine(this: PlayerStructure, track: Track | null, payload: LyricsLineEvent): Promise<void> {
    this.manager.emit(Events.LyricsLine, this, track, payload);
    this.manager.emit(
        Events.Debug,
        DebugLevels.Player,
        `[Player] -> [Lyrics] The lyrics line has been found: ${this.guildId} | Payload: ${stringify(payload)}`,
    );
}

/**
 * The lyrics not found event.
 * @param {PlayerStructure} this The player that emitted the event.
 * @param {Track | null} track The track that emitted the event.
 * @param {LyricsNotFoundEvent} payload The payload of the event.
 * @returns {Promise<void>} Awww, no lyrics? That's sad.
 */
export async function lyricsNotFound(this: PlayerStructure, track: Track | null, payload: LyricsNotFoundEvent): Promise<void> {
    this.manager.emit(Events.LyricsNotFound, this, track, payload);
    this.manager.emit(
        Events.Debug,
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
    this.manager.emit(Events.WebSocketClosed, this, payload);
    this.manager.emit(
        Events.Debug,
        DebugLevels.Player,
        `[Player] -> [Socket] The socket has closed: ${this.guildId} | Payload: ${stringify(payload)}`,
    );
}
