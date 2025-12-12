import {
    DebugLevels,
    DestroyReasons,
    Events,
    type NodeIdentifier,
    type Nullable,
    type QueryResult,
    type SearchOptions,
} from "../../types/Manager";
import { type LyricsResult, type SourceNames, State } from "../../types/Node";
import {
    type LavalinkPlayerVoice,
    type LavalinkPlayOptions,
    LoopMode,
    type LyricsMethods,
    type PlayerJson,
    type PlayerOptions,
    type PlayOptions,
    type VoiceChannelUpdate,
} from "../../types/Player";
import type { LavalinkPlayer, UpdatePlayerInfo } from "../../types/Rest";
import { type NodeStructure, type QueueStructure, Structures } from "../../types/Structures";
import { isTrack, isUnresolvedTrack, validatePlayerOptions, validateTrack } from "../../util/functions/utils";
import { PlayerError } from "../Errors";
import type { Hoshimi } from "../Hoshimi";
import type { HoshimiTrack } from "../Track";
import type { FilterManager } from "./filters/Manager";
import { PlayerStorage } from "./Storage";

/**
 * Class representing a Hoshimi player.
 * @class Player
 */
export class Player {
    /**
     * The data for the player.
     * @type {PlayerStorage}
     * @readonly
     */
    readonly data: PlayerStorage = new PlayerStorage();

    /**
     * The options for the player.
     * @type {PlayerOptions}
     * @readonly
     */
    readonly options: PlayerOptions;

    /**
     * The manager for the player.
     * @type {Hoshimi}
     * @readonly
     */
    readonly manager: Hoshimi;

    /**
     * The queue for the player.
     * @type {Queue}
     * @readonly
     */
    readonly queue: QueueStructure;

    /**
     * The filter manager for the player.
     * @type {FilterManager}
     * @readonly
     */
    readonly filterManager: FilterManager;

    /**
     * The node for the player.
     * @type {NodeStructure}
     */
    public node: NodeStructure;

    /**
     * Check if the player is self deafened.
     * @type {boolean}
     */
    public selfDeaf: boolean = false;

    /**
     * Check if the player is self muted.
     * @type {boolean}
     */
    public selfMute: boolean = false;

    /**
     * Loop mode of the player.
     * @type {LoopMode}
     * @default LoopMode.Off
     */
    public loop: LoopMode = LoopMode.Off;

    /**
     * Check if the player is playing.
     * @type {boolean}
     * @default false
     */
    public playing: boolean = false;

    /**
     * Check if the player is paused.
     * @type {boolean}
     * @default false
     */
    public paused: boolean = false;

    /**
     * Check if the player is connected.
     * @type {boolean}
     * @default false
     */
    public connected: boolean = false;

    /**
     * Volume of the player.
     * @type {number}
     * @default 100
     */
    public volume: number = 100;

    /**
     * Guild ig of the player.
     * @type {string}
     */
    public guildId: string;

    /**
     * Voice channel idof the player.
     * @type {string | undefined}
     */
    public voiceId: string | undefined = undefined;

    /**
     * Text channel id of the player.
     * @type {string | undefined}
     */
    public textId: string | undefined = undefined;

    /**
     * The ping of the player.
     * @type {number}
     */
    public ping: number = 0;

    /**
     * The timestamp when the player was created.
     * @type {number}
     */
    public createdTimestamp: number = 0;

    /**
     * The last position received from Lavalink.
     * @type {number}
     */
    public lastPosition: number = 0;

    /**
     * The timestamp when the last position change update happened.
     * @type {number | null}
     */
    public lastPositionUpdate: number | null = null;

    /**
     * The current calculated position of the player.
     * @type {number}
     * @readonly
     */
    public get position(): number {
        return this.lastPosition + (this.lastPositionUpdate ? Date.now() - this.lastPositionUpdate : 0);
    }

    /**
     * The voice connection details.
     * @type {PlayerVoice}
     */
    public voice: Nullable<LavalinkPlayerVoice> = {
        endpoint: null,
        sessionId: null,
        token: null,
    };

    /**
     *
     * Create a new player.
     * @param {Hoshimi} manager The manager for the player.
     * @param {PlayOptions} options The options for the player.
     * @example
     * ```ts
     * const player = new Player(manager, {
     * 	guildId: "guildId",
     * 	voiceId: "voiceId",
     * 	textId: "textId",
     * 	selfDeaf: true,
     * 	selfMute: false,
     * 	volume: 100,
     * });
     *
     * console.log(player.guildId); // guildId
     * console.log(player.voiceId); // voiceId
     * console.log(player.textId); // textId
     */
    constructor(manager: Hoshimi, options: PlayerOptions) {
        this.manager = manager;
        this.options = options;

        this.guildId = options.guildId;
        this.voiceId = options.voiceId;

        this.selfDeaf = options.selfDeaf ?? true;
        this.selfMute = options.selfMute ?? false;
        this.volume = options.volume ?? 100;
        this.textId = options.textId;

        this.node =
            (typeof this.options.node === "string" ? this.manager.nodeManager.get(this.options.node) : this.options.node) ??
            this.manager.nodeManager.getLeastUsed();

        validatePlayerOptions(this.options);

        this.queue = Structures.Queue(this);
        this.filterManager = Structures.FilterManager(this);
    }

    /**
     * The lyrics methods for the player.
     * @type {LyricsMethods}
     * @readonly
     */
    readonly lyrics: LyricsMethods = {
        subscribe: (skipSource): Promise<void> => this.node.lyricsManager.subscribe(this.guildId, skipSource),
        unsubscribe: (): Promise<void> => this.node.lyricsManager.unsubscribe(this.guildId),
        current: (skipSource): Promise<LyricsResult | null> => this.node.lyricsManager.current(this.guildId, skipSource),
        get: (track, skipSource): Promise<LyricsResult | null> => this.node.lyricsManager.get(track, skipSource),
    };

    /**
     *
     * Search for a track or playlist.
     * @param {SearchOptions} options The options for the search.
     * @returns {Promise<QueryResult>} The search result.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * const result = await player.search({
     * 	query: "track name",
     * 	engine: SearchEngine.Youtube,
     * 	requester: {},
     * });
     *
     * console.log(result) // the search result
     * ```
     */
    public search(options: SearchOptions): Promise<QueryResult> {
        return this.manager.search({
            ...options,
            node: this.node,
        });
    }

    /**
     *
     * Play the next track in the queue.
     * @param {number} [to=0] The amount of tracks to skip.
     * @param {boolean} [throwError=true] Whether to throw an error if there are no tracks to skip.
     * @returns {Promise<void>}
     * @throws {PlayerError} If there are no tracks to skip.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * player.skip(2); // skip 2 tracks
     * player.skip(); // skip 1 track
     * ```
     */
    public async skip(to: number = 0, throwError: boolean = true): Promise<void> {
        if (!this.queue.size) {
            this.manager.emit(Events.Debug, DebugLevels.Player, "[Player] -> [Skip] No tracks to skip.");

            if (throwError) throw new PlayerError("No tracks to skip.");
        }

        if (typeof to === "number" && to > 0) {
            if (to > this.queue.size) throw new PlayerError("Cannot skip to a track that doesn't exist.");
            if (to < 0) throw new PlayerError("Cannot skip to a negative number.");

            this.queue.splice(0, to - 1);
        }

        if (!this.playing && !this.queue.current) return this.play();

        this.manager.emit(Events.Debug, DebugLevels.Player, `[Player] -> [Skip] Skipping to next track for guild: ${this.guildId}`);

        await this.node.stopPlayer(this.guildId);
    }

    /**
     *
     * Seek to a specific position in the current track.
     * @param {number} position The position to seek to in milliseconds.
     * @returns {Promise<void>}
     * @throws {PlayerError} If the position is invalid.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * player.seek(30000); // seek to 30 seconds
     * ```
     */
    public async seek(position: number): Promise<void> {
        if (typeof position !== "number" || Number.isNaN(position) || position < 0)
            throw new PlayerError("Position must be a positive number.");

        this.manager.emit(Events.Debug, DebugLevels.Player, `[Player] -> [Seek] Seeking to ${position} for guild: ${this.guildId}`);

        this.lastPosition = position;
        this.lastPositionUpdate = Date.now();

        await this.updatePlayer({ playerOptions: { position } });
    }

    /**
     *
     * Disconnect the player from the voice channel.
     * @returns {Promise<this>} The player instance.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * player.disconnect();
     * ```
     */
    public async disconnect(): Promise<this> {
        if (!this.voiceId) return this;

        await this.manager.options.sendPayload(this.guildId, {
            op: 4,
            d: {
                guild_id: this.guildId,
                channel_id: null,
                self_deaf: this.selfDeaf,
                self_mute: this.selfMute,
            },
        });

        this.manager.emit(Events.Debug, DebugLevels.Player, `[Player] -> [Disconnect] Player disconnected for guild: ${this.guildId}`);
        this.connected = false;

        return this;
    }

    /**
     *
     * Destroy and disconnect the player.
     * @param {DestroyReasons} [reason] The reason for destroying the player.
     * @returns {Promise<void>}
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * player.destroy(DestroyReasons.Stop);
     * ```
     */
    public async destroy(reason: DestroyReasons = DestroyReasons.Stop): Promise<boolean> {
        await this.disconnect();
        await this.node.destroyPlayer(this.guildId);

        this.manager.emit(Events.PlayerDestroy, this, reason);
        this.manager.emit(
            Events.Debug,
            DebugLevels.Player,
            `[Player] -> [Destroy] Destroyed player for guild: ${this.guildId} | Reason: ${reason}`,
        );

        return this.manager.deletePlayer(this.guildId);
    }

    /**
     *
     * Play a track in the player.
     * @param {Partial<PlayOptions>} [options] The options to play the track.
     * @returns {Promise<void>}
     * @throws {PlayerError} If there are no tracks to play.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     *
     * player.play({
     * 	track: track,
     * 	noReplace: true,
     * });
     * ```
     */
    public async play(options: Partial<PlayOptions> = {}): Promise<void> {
        if (typeof options !== "object") throw new PlayerError("The play options must be an object.");

        if (options.track) this.queue.current = await validateTrack(this, options.track);
        else if (!this.queue.current) this.queue.current = await validateTrack(this, this.queue.shift());

        if (!this.queue.current) throw new PlayerError("No track to play.");
        if (!isTrack(this.queue.current) && !isUnresolvedTrack(this.queue.current))
            throw new PlayerError("The track must be a valid Track or UnresolvedTrack instance.");

        this.manager.emit(Events.Debug, DebugLevels.Player, `[Player] -> [Play] A new track is playing: ${this.queue.current.info.title}`);

        // Reset position to start when playing a new track (unless a specific position is provided)
        const position: number = options.position ?? 0;

        this.lastPosition = position;
        this.lastPositionUpdate = Date.now();

        await this.updatePlayer({
            noReplace: options.noReplace,
            playerOptions: {
                ...options,
                position, // Ensure position is sent to Lavalink
                track: {
                    userData: this.queue.current.userData,
                    encoded: this.queue.current.encoded,
                },
            },
        });

        return;
    }

    /**
     * Connect the player to the voice channel.
     * @returns {Promise<this>} The player instance.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * player.connect();
     * ```
     */
    public async connect(): Promise<this> {
        if (!this.voiceId) return this;

        await this.manager.options.sendPayload(this.guildId, {
            op: 4,
            d: {
                guild_id: this.guildId,
                channel_id: this.voiceId,
                self_deaf: this.selfDeaf,
                self_mute: this.selfMute,
            },
        });

        this.manager.emit(Events.Debug, DebugLevels.Player, `[Player] -> [Connect] Player connected for guild: ${this.guildId}`);
        this.connected = true;

        return this;
    }

    /**
     *
     * Stop the player from playing.
     * @param {boolean} [destroy=true] Whether to destroy the player or not.
     * @returns {Promise<void>}
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * player.stop();
     * ```
     */
    public async stop(destroy: boolean = true): Promise<void> {
        await this.node.stopPlayer(this.guildId);

        if (destroy) await this.destroy(DestroyReasons.Stop);

        this.manager.emit(Events.Debug, DebugLevels.Player, `[Player] -> [Stop] Player stopped for guild: ${this.guildId}`);

        this.playing = false;
        this.paused = false;
        this.lastPosition = 0;
        this.lastPositionUpdate = null;
        this.queue.current = null;

        return;
    }

    /**
     *
     * Pause or resume the player.
     * @returns {Promise<void>}
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * player.setPaused();
     * ```
     */
    public async setPaused(paused: boolean = !this.paused): Promise<boolean> {
        this.manager.emit(
            Events.Debug,
            DebugLevels.Player,
            `[Player] -> [Pause] Player is now ${paused ? "paused" : "resumed"} for guild: ${this.guildId}`,
        );

        // When pausing, stop position calculation by setting lastPositionUpdate to null
        if (paused) {
            this.lastPositionUpdate = null;
        } else {
            // When resuming, restart position calculation from current position
            this.lastPosition = this.position;
            this.lastPositionUpdate = Date.now();
        }

        await this.updatePlayer({ playerOptions: { paused } });

        return paused;
    }

    /**
     *
     * Set the volume of the player.
     * @param {number} volume The volume to set.
     * @returns {Promise<void>}
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * player.setVolume(50); // set the volume to 50%
     * ```
     */
    public async setVolume(volume: number): Promise<void> {
        if (typeof volume !== "number" || Number.isNaN(volume) || volume < 0 || volume > 100)
            throw new PlayerError("Volume must be a number between 0 and 100.");

        await this.updatePlayer({ playerOptions: { volume } });

        this.volume = volume;
        this.manager.emit(
            Events.Debug,
            DebugLevels.Player,
            `[Player] -> [Volume] Player volume set to ${volume}% for guild: ${this.guildId}`,
        );

        return;
    }

    /**
     *
     * Set the loop mode of the player.
     * @param {LoopMode} mode The loop mode to set.
     * @throws {PlayerError} If the loop mode is invalid.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * player.setLoop(LoopMode.Track);
     * ```
     */
    public setLoop(mode: LoopMode): this {
        const loopValues = Object.values(LoopMode).filter((v) => typeof v === "number");
        if (!loopValues.includes(mode)) throw new PlayerError(`Invalid loop mode. Valid modes are: ${loopValues.join(", ")}`);

        this.loop = mode;
        this.manager.emit(
            Events.Debug,
            DebugLevels.Player,
            `[Player] -> [Loop] Player loop mode set to ${mode} for guild: ${this.guildId}`,
        );

        return this;
    }

    /**
     * Set the voice of the player.
     * @param {Partial<VoiceChannelUpdate>} voice The voice state to set.
     * @returns {Promise<void>}
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * player.setVoice({ voiceId: "newVoiceId" });
     * ```
     */
    public async setVoice(voice: Partial<VoiceChannelUpdate>): Promise<void> {
        if (voice.voiceId === this.voiceId) return;

        if (voice.voiceId) {
            this.voiceId = voice.voiceId;
            this.options.voiceId = voice.voiceId;
        }

        if (voice.selfDeaf) {
            this.selfDeaf = voice.selfDeaf;
            this.options.selfDeaf = voice.selfDeaf;
        }

        if (voice.selfMute) {
            this.selfMute = voice.selfMute;
            this.options.selfMute = voice.selfMute;
        }

        await this.manager.options.sendPayload(this.guildId, {
            op: 4,
            d: {
                guild_id: this.guildId,
                self_deaf: this.selfDeaf,
                self_mute: this.selfMute,
                channel_id: this.voiceId ?? null,
            },
        });

        this.manager.emit(
            Events.Debug,
            DebugLevels.Player,
            `[Player] -> [VoiceState] Updated voice state for guild: ${this.guildId} with voiceId: ${this.voiceId}`,
        );
    }

    /**
     *
     * Change the node the player is connected to.
     * @param {NodeIdentifier} node The node to change to.
     * @returns {Promise<void>} A promise that resolves when the node has been changed.
     * @throws {PlayerError} If the target node is not found, not connected, or missing source managers.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * player.move("newNodeId");
     * ```
     */
    public async move(node: NodeIdentifier): Promise<void> {
        const id = typeof node === "string" ? node : node.id;
        const target = this.manager.nodeManager.get(id);

        if (!target) throw new PlayerError("Target node not found.");
        if (!target.info) throw new PlayerError("Target node info not available.");

        if (target.state !== State.Connected) throw new PlayerError("Target node is not connected.");
        if (target.id === this.node.id) return;

        if (this.queue.current || this.queue.size) {
            const sources = [this.queue.current, ...this.queue.tracks]
                .filter((t): t is HoshimiTrack => t != null || typeof t !== "undefined")
                .map((t) => t.info.sourceName)
                .filter((s): s is SourceNames => s != null || typeof s !== "undefined");

            const missings = [...new Set(sources)].filter((s) => !target.info!.sourceManagers.includes(s));
            if (missings.length) throw new PlayerError(`Target node is missing source managers for: ${missings.join(", ")}`);
        }

        const current = this.queue.current;

        if (!this.voice.endpoint || !this.voice.sessionId || !this.voice.token)
            throw new PlayerError("Player voice connection data is incomplete.");
        if (this.node.state === State.Connected) await this.node.destroyPlayer(this.guildId);

        this.node = target;

        await this.updatePlayer({
            playerOptions: {
                voice: this.voice as LavalinkPlayerVoice,
                ...((current && {
                    track: current.encoded,
                    position: this.position,
                    volume: this.volume,
                }) as LavalinkPlayOptions),
            },
        });

        await this.filterManager.apply();

        this.manager.emit(
            Events.Debug,
            DebugLevels.Player,
            `[Player] -> [Move] Player moved to node: ${target.id} for guild: ${this.guildId}`,
        );
    }

    /**
     * Update the player with new data.
     * @param {NonGuildUpdatePlayerInfo} data The data to update the player with.
     * @returns {Promise<LavalinkPlayer | null>} The updated player data.
     */
    public async updatePlayer(data: NonGuildUpdatePlayerInfo): Promise<LavalinkPlayer | null> {
        return this.node.updatePlayer({
            guildId: this.guildId,
            ...data,
        });
    }

    /**
     *
     * Return the player as a json object.
     * @returns {PlayerJson}
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * const json = player.toJSON();
     * console.log(json); // the player as a json object
     * ```
     */
    public toJSON(): PlayerJson {
        return {
            volume: this.volume,
            loop: this.loop,
            paused: this.paused,
            playing: this.playing,
            voiceId: this.voiceId,
            guildId: this.guildId,
            selfMute: this.selfMute,
            selfDeaf: this.selfDeaf,
            options: this.options,
            voice: this.voice,
            textId: this.textId,
            lastPosition: this.lastPosition,
            lastPositionUpdate: this.lastPositionUpdate,
            position: this.position,
            createdTimestamp: this.createdTimestamp,
            ping: this.ping,
            filters: this.filterManager.toJSON(),
            queue: this.queue.toJSON(),
            node: this.node.toJSON(),
        };
    }
}

/**
 * Type representing the update player information without guildId.
 */
type NonGuildUpdatePlayerInfo = Omit<UpdatePlayerInfo, "guildId">;

/**
 * Interface representing the customizable player storage.
 */
export interface CustomizablePlayerStorage {}
