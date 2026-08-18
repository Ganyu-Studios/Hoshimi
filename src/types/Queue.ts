import type { QueueStorageAdapter } from "../classes/storage/adapters/QueueAdapter";
import type { TrackRequester, TrackResolvableStructure } from "../classes/Track";
import type { Awaitable } from "./Manager";
import type { LavalinkTrack } from "./Node";
import type { PlayerStructure } from "./Structures";

/**
 * The queue options.
 */
export interface HoshimiQueueOptions {
    /**
     * The maximum amount of tracks that can be saved in the queue.
     * @type {number}
     * @default 25
     */
    maxHistory?: number;
    /**
     *
     * The function to use for autoplay.
     * @param {Player} player The player.
     * @param {TrackResolvableStructure | null} lastTrack The last track played.
     */
    autoplayFn?(player: PlayerStructure, lastTrack: TrackResolvableStructure | null): Awaitable<void>;
    /**
     * Enable the auto play for the queue. (By default, only supports `youtube` and `spotify`, add more with your own function)
     * @type {boolean}
     * @default false
     */
    autoPlay?: boolean;
    /**
     * The storage manager to use for the queue.
     * @type {QueueStorageAdapter}
     * @default {QueueMemoryStorage}
     */
    storage?: QueueStorageAdapter;
}

/**
 * The sync options for the queue.
 */
export interface SyncOptions {
    /**
     * Whether to override the current queue with the stored one.
     * @type {boolean}
     * @default true
     */
    override?: boolean;
    /**
     * Whether to sync the current track.
     * @type {boolean}
     * @default false
     */
    syncCurrent?: boolean;
}

/**
 * The type for any lavalink track, including partial and unresolved tracks.
 */
export interface TrackJSON extends LavalinkTrack {
    requester: TrackRequester;
    /**
     * Whether the track was taken from history to be replayed. Persisted so the flag survives
     * a queue save/restore.
     * @type {boolean}
     */
    isPrevious?: boolean;
}

/**
 * The queue json.
 */
export interface QueueJSON {
    /**
     * The tracks of the queue.
     * @type {TrackJSON[]}
     */
    tracks: TrackJSON[];
    /**
     * The previous tracks of the queue.
     * @type {TrackJSON[]}
     */
    history: TrackJSON[];
    /**
     * The current track of the queue.
     * @type {TrackJSON | null}
     */
    current: TrackJSON | null;
}
