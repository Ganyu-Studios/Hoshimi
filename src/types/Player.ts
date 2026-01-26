import type { PlayerStorageAdapter } from "../classes/storage/adapters/PlayerAdapter";
import type { Track, TrackRequester, UnresolvedTrack } from "../classes/Track";
import type { FilterSettings } from "./Filters";
import type { Awaitable, NodeIdentifier, Nullable } from "./Manager";
import type { Exception, LavalinkTrack, LyricsLine, LyricsResult, NodeJson, OpCodes } from "./Node";
import type { NodelinkEventType } from "./Nodelink";
import type { QueueJson } from "./Queue";

/**
 * Partial Lavalink track type.
 */
type PartialLavalinkTrack = Partial<Nullable<LavalinkTrack>>;

/**
 * The base options for playing a track.
 */
interface BasePlayOptions {
    /**
     * The position to start the track.
     * @type {number | undefined}
     */
    position?: number;
    /**
     * The position to end the track.
     * @type {number | undefined}
     */
    endTime?: number;
    /**
     * The pause state of the player.
     * @type {boolean | undefined}
     */
    paused?: boolean;
    /**
     * The volume of the player.
     * @type {number | undefined}
     */
    volume?: number;
    /**
     * The filters for the player.
     * @type {Partial<FilterSettings> | undefined}
     */
    filters?: Partial<FilterSettings>;
    /**
     * The voice settings for the player.
     * @type {LavalinkPlayerVoice | undefined}
     */
    voice?: LavalinkPlayerVoice;
}

/**
 * The types of loop modes.
 */
export enum LoopMode {
    /**
     * Loop mode for repeating the current track.
     */
    Track = 1,
    /**
     * Loop mode for repeating the queue.
     */
    Queue = 2,
    /**
     * Loop mode for repeating nothing.
     */
    Off = 3,
}

/**
 * The types of player events.
 */
export enum PlayerEventType {
    /**
     * Event type for when a track starts.
     */
    TrackStart = "TrackStartEvent",
    /**
     * Event type for when a track ends.
     */
    TrackEnd = "TrackEndEvent",
    /**
     * Event type for when a track encounters an exception.
     */
    TrackException = "TrackExceptionEvent",
    /**
     * Event type for when a track gets stuck.
     */
    TrackStuck = "TrackStuckEvent",
    /**
     * Event type for when lyrics are found.
     */
    LyricsFound = "LyricsFoundEvent",
    /**
     * Event type for when lyrics are not found.
     */
    LyricsNotFound = "LyricsNotFoundEvent",
    /**
     * Event type for when a lyrics line is sent.
     */
    LyricsLine = "LyricsLineEvent",
    /**
     * Event type for when the WebSocket connection is closed.
     */
    WebsocketClosed = "WebSocketClosedEvent",
}

/**
 * The reasons a track can end.
 */
export enum TrackEndReason {
    /**
     * The track ended normally.
     */
    Finished = "finished",
    /**
     * The track fails to load.
     */
    LoadFailed = "loadFailed",
    /**
     * The track was stopped.
     */
    Stopped = "stopped",
    /**
     * The track was replaced.
     */
    Replaced = "replaced",
    /**
     * The track was cleaned up.
     */
    Cleanup = "cleanup",
}

/**
 * The options for automatic player error handling.
 */
interface ErrorPlayerActions {
    /**
     * Whether to automatically destroy the player on disconnect or error.
     * @type {boolean | undefined}
     * @default false
     */
    autoDestroy?: boolean;
    /**
     * Whether to automatically skip the track on error
     * @type {boolean | undefined}
     * @default false
     */
    autoSkip?: boolean;
    /**
     * Whether to automatically stop the player on error.
     * @type {boolean | undefined}
     * @default false
     */
    autoStop?: boolean;
}

/**
 * The options for error actions.
 */
interface DisconnectPlayerActions extends Pick<ErrorPlayerActions, "autoDestroy"> {
    /**
     * Whether to automatically reconnect on disconnect.
     * @type {boolean | undefined}
     * @default false
     */
    autoReconnect?: boolean;
    /**
     * Whether to automatically add tracks back to the queue on disconnect.
     * @type {boolean | undefined}
     * @default false
     */
    autoQueue?: boolean;
}

/**
 * The Hoshimi player options.
 */
export interface HoshimiPlayerOptions {
    /**
     *
     * The function to use to get the requester data.
     * @param {TrackRequester} requester The requester of the track.
     */
    requesterFn?<T extends TrackRequester = TrackRequester>(requester: TrackRequester): Awaitable<T>;
    /**
     * The options for handling errors.
     * @type {ErrorPlayerActions | undefined}
     */
    onError?: ErrorPlayerActions;
    /**
     * The options for handling disconnects.
     * @type {DisconnectPlayerActions | undefined}
     */
    onDisconnect?: DisconnectPlayerActions;
    /**
     * The customizable player storage adapter.
     * @type {PlayerStorageAdapter | undefined}
     * @default {PlayerMemoryStorage}
     */
    storage?: PlayerStorageAdapter;
}

/**
 * The base interface for player events.
 */
export interface PlayerEvent<E extends PlayerEventType | NodelinkEventType> {
    /**
     * The type of the event.
     * @type {E}
     */
    type: E;
    /**
     * The operation code for the event.
     * @type {OpCodes.Event}
     */
    op: OpCodes.Event;
    /**
     * The guild id associated with the event.
     * @type {string}
     */
    guildId: string;
}

/**
 * The event for when a track starts playing.
 */
export interface TrackStartEvent extends PlayerEvent<PlayerEventType.TrackStart> {
    /**
     * The track that started playing.
     * @type {LavalinkTrack}
     */
    track: LavalinkTrack;
}

/**
 * The event for when a track ends.
 */
export interface TrackEndEvent extends PlayerEvent<PlayerEventType.TrackEnd> {
    /**
     * The track that ended.
     * @type {LavalinkTrack}
     */
    track: LavalinkTrack;
    /**
     * The reason the track ended.
     * @type {TrackEndReason}
     */
    reason: TrackEndReason;
}

/**
 * The event for when a track gets stuck.
 */
export interface TrackStuckEvent extends PlayerEvent<PlayerEventType.TrackStuck> {
    /**
     * The track that got stuck.
     * @type {LavalinkTrack}
     */
    track: LavalinkTrack;
    /**
     * The threshold in milliseconds.
     * @type {number}
     */
    thresholdMs: number;
}

/**
 * The event for when a track encounters an exception.
 */
export interface TrackExceptionEvent extends PlayerEvent<PlayerEventType.TrackException> {
    /**
     * The exception that occurred.
     * @type {Exception}
     */
    exception: Exception;
}

/**
 * The event for when the WebSocket connection is closed.
 */
export interface WebSocketClosedEvent extends PlayerEvent<PlayerEventType.WebsocketClosed> {
    /**
     * The close code.
     * @type {number}
     */
    code: number;
    /**
     * Whether the connection was closed by the remote.
     * @type {boolean}
     */
    byRemote: boolean;
    /**
     * The reason for the closure.
     * @type {string}
     */
    reason: string;
}

/**
 * The event for when lyrics are found.
 */
export interface LyricsFoundEvent extends PlayerEvent<PlayerEventType.LyricsFound> {
    /**
     * The guild id associated with the event.
     * @type {string}
     */
    guildId: string;
    /**
     * The lyrics result of the event.
     * @type {LyricsResult}
     */
    lyrics: LyricsResult;
}

/**
 * The event for when lyrics are not found.
 */
export interface LyricsNotFoundEvent extends PlayerEvent<PlayerEventType.LyricsNotFound> {}

/**
 * The event for when a lyrics line is sent.
 */
export interface LyricsLineEvent extends PlayerEvent<PlayerEventType.LyricsLine> {
    /**
     * The guild id associated with the event.
     * @type {string}
     */
    guildId: string;
    /**
     * The line index of the lyrics line.
     * @type {number}
     */
    lineIndex: number;
    /**
     * The lyrics line of the event.
     * @type {LyricsLine}
     */
    line: LyricsLine;
    /**
     * Returns if the line was skipped.
     * @type {boolean}
     */
    skipped: boolean;
}

/**
 * The update for the player state.
 */
export interface PlayerUpdate {
    /**
     * The operation code for the update.
     * @type {OpCodes.PlayerUpdate}
     */
    op: OpCodes.PlayerUpdate;
    /**
     * The guild ID associated with the update.
     * @type {string}
     */
    guildId: string;
    /**
     * The state of the player.
     * @type {PlayerUpdateState}
     */
    state: PlayerUpdateState;
}

export interface PlayerUpdateState {
    /**
     * Whether the player is connected.
     * @type {boolean}
     */
    connected: boolean;
    /**
     * The position of the track.
     * @type {number}
     */
    position: number;
    /**
     * The time of the update.
     * @type {number}
     */
    time: number;
    /**
     * The ping of the player.
     * @type {number}
     */
    ping: number;
}

/**
 * The options for the player.
 */
export interface PlayerOptions {
    /**
     * Guild id of the player.
     * @type {string}
     */
    guildId: string;
    /**
     * Voice channel id of the player.
     * @type {string}
     */
    voiceId: string;
    /**
     * Volume of the player.
     * @type {number | undefined}
     * @default 100
     */
    volume?: number;
    /**
     * Set if the player should be deafened.
     * @type {boolean | undefined}
     * @default true
     */
    selfDeaf?: boolean;
    /**
     * Set if the player should be muted.
     * @type {boolean | undefined}
     * @default false
     */
    selfMute?: boolean;
    /**
     * Text channel id of the player.
     * @type {string | undefined}
     */
    textId?: string;
    /**
     * Lavalink node of the player.
     * @type {NodeIdentifier}
     */
    node?: NodeIdentifier;
}

/**
 * The options for playing a track with Lavalink.
 */
export interface LavalinkPlayOptions extends BasePlayOptions {
    /**
     * Track to play.
     * @type {PartialLavalinkTrack | undefined}
     */
    track?: PartialLavalinkTrack;
}

/**
 * The options for playing a track.
 */
export interface PlayOptions extends BasePlayOptions {
    /**
     * Whether to replace the current track.
     * @type {boolean | undefined}
     * @default false
     */
    noReplace?: boolean;
    /**
     * Track to play.
     * @type {Track | UnresolvedTrack | undefined}
     */
    track?: Track | UnresolvedTrack;
}

export interface PlayerVoice {
    /**
     * The voice server token.
     * @type {string}
     */
    token: string;
    /**
     * The voice server endpoint.
     * @type {string}
     */
    endpoint: string;
    /**
     * The voice server session id.
     * @type {string}
     */
    sessionId: string;
    /**
     * The voice server guild id.
     * @type {string | undefined}
     */
    connected?: boolean;
    /**
     * The voice server ping.
     * @type {number | undefined}
     */
    ping?: number;
}

/**
 * The JSON representation of the player.
 */
export interface PlayerJson {
    /**
     * The guild id of the player.
     * @type {string}
     */
    guildId: string;
    /**
     * The volume of the player.
     * @type {number}
     */
    volume: number;
    /**
     * The self deaf state of the player.
     * @type {boolean}
     */
    selfDeaf: boolean;
    /**
     * The self mute state of the player.
     * @type {boolean}
     */
    selfMute: boolean;
    /**
     * The voice settings for the player.
     * @type {LavalinkPlayerVoice}
     */
    voice: Nullable<LavalinkPlayerVoice>;
    /**
     * The loop mode of the player.
     * @type {LoopMode}
     */
    loop: LoopMode;
    /**
     * The options for the player.
     * @type {boolean}
     */
    options: PlayerOptions;
    /**
     * The paused state of the player.
     * @type {boolean}
     */
    paused: boolean;
    /**
     * The playing state of the player.
     * @type {boolean}
     */
    playing: boolean;
    /**
     * The voice channel id of the player.
     * @type {string}
     */
    voiceId?: string;
    /**
     * The text channel id of the player.
     * @type {string | undefined}
     */
    textId?: string;
    /**
     * The last position received from Lavalink.
     * @type {number}
     */
    lastPosition: number;
    /**
     * The timestamp when the last position change update happened.
     * @type {number | null}
     */
    lastPositionUpdate: number | null;
    /**
     * The current calculated position of the player.
     * @type {number}
     */
    position: number;
    /**
     * The timestamp when the player was created.
     * @type {number}
     */
    createdTimestamp: number;
    /**
     * The ping of the player.
     * @type {number}
     */
    ping: number;
    /**
     * The queue of the player.
     * @type {QueueJson}
     */
    queue: QueueJson;
    /**
     * The node of the player.
     * @type {NodeJson}
     */
    node: NodeJson;
    /**
     * The filter settings of the player.
     * @type {FilterSettings}
     */
    filters: FilterSettings;
}

/**
 * The lyrics methods for the player.
 */
export interface LyricsMethods {
    /**
     *
     * Get the current lyrics for the current track.
     * @param {boolean} [skipSource=false] Whether to skip the source or not.
     * @returns {Promise<LyricsResult | null>} The lyrics result or null if not found.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * const lyrics = await player.lyrics.current();
     * ```
     */
    current(skipSource?: boolean): Promise<LyricsResult | null>;
    /**
     *
     * Get the lyrics for a specific track.
     * @param {Track} track The track to get the lyrics for.
     * @param {boolean} [skipSource=false] Whether to skip the source or not.
     * @returns {Promise<LyricsResult | null>} The lyrics result or null if not found.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * const track = player.queue.current;
     * const lyrics = await player.lyrics.get(track);
     * ```
     */
    get(track: Track, skipSource?: boolean): Promise<LyricsResult | null>;
    /**
     *
     * Subscribe to the lyrics for a specific guild.
     * @param {boolean} [skipSource=false] Whether to skip the source or not.
     * @returns {Promise<void>} Let's start the sing session!
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * await player.lyrics.subscribe();
     * ```
     */
    subscribe(skipSource?: boolean): Promise<void>;
    /**
     *
     * Unsubscribe from the lyrics for a specific guild.
     * @returns {Promise<void>} Let's stop the sing session!
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * await player.lyrics.unsubscribe();
     * ```
     */
    unsubscribe(): Promise<void>;
}

/**
 * The voice channel update options.
 */
export type VoiceChannelUpdate = Pick<PlayerOptions, "selfDeaf" | "voiceId" | "selfMute">;

/**
 * The voice settings for the player.
 */
export type LavalinkPlayerVoice = Omit<PlayerVoice, "connected" | "ping">;
