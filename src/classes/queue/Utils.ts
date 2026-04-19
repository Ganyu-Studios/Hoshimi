import { type Awaitable, DebugLevels, EventNames } from "../../types/Manager";
import type { AnyLavalinkTrack } from "../../types/Player";
import type { HoshimiQueueOptions, QueueJson, SyncOptions } from "../../types/Queue";
import { type QueueStructure, Structures, type TrackStructure } from "../../types/Structures";
import { isLavalinkResolved, isLavalinkUnresolved, isResolved, isUnresolved, stringify } from "../../util/functions/utils";
import { ResolveError, StorageError } from "../Errors";
import type { QueueStorageAdapter } from "../storage/adapters/QueueAdapter";
import type { TrackRequester, TrackResolvableStructure } from "../Track";

/**
 * Class representing the queue utils.
 * @class QueueUtils
 */
export class QueueUtils {
    /**
     * Player instance.
     * @type {Queue}
     * @private
     * @readonly
     * @internal
     */
    private readonly queue: QueueStructure;

    /**
     * Queue storage adapter.
     * @type {QueueStorageAdapter}
     * @private
     * @readonly
     * @internal
     */
    private readonly storage: QueueStorageAdapter;

    /**
     * Options for the queue.
     * @type {HoshimiQueueOptions}
     * @private
     * @readonly
     * @internal
     */
    private readonly options: Required<HoshimiQueueOptions>;

    /**
     *
     * Constructor of the queue utils.
     * @param {QueueStructure} queue The queue instance.
     */
    constructor(queue: QueueStructure) {
        this.queue = queue;
        this.options = queue.player.manager.options.queueOptions;
        this.storage = this.options.storage;
    }

    /**
     * Build a track from a resolvable structure.
     * Automatically resolves UnresolvedTrack instances to avoid double resolution.
     * @param {TrackResolvableStructure | null} track The input track.
     * @param {TrackRequester} [requester] Optional requester override.
     * @returns {Promise<TrackStructure | null>} The built and resolved track.
     */
    public async build(
        track?: TrackResolvableStructure | AnyLavalinkTrack | null,
        requester?: TrackRequester,
    ): Promise<TrackStructure | null> {
        if (!track) throw new ResolveError("Are you trying to build a track without providing one? Please provide a track to build.");

        const requesterFn = this.queue.player.manager.options.playerOptions.requesterFn;

        const currentRequester: TrackRequester | undefined = "requester" in track ? track.requester : track.userData?.requester;
        const trackRequester: TrackRequester = await requesterFn(requester ?? currentRequester ?? {});

        this.queue.player.manager.emit(
            EventNames.Debug,
            DebugLevels.Queue,
            `[Queue] -> [Utils] Building track for ${this.queue.player.guildId} | Input: ${stringify(track)} | Requester: ${stringify(trackRequester)}`,
        );

        if (isResolved(track)) return track;
        if (isUnresolved(track)) return track.resolve(this.queue.player);
        if (isLavalinkResolved(track)) return Structures.Track(track, trackRequester);
        if (isLavalinkUnresolved(track)) return Structures.UnresolvedTrack(track, trackRequester).resolve(this.queue.player);

        throw new ResolveError(`Unable to build track from input: ${stringify(track)}`); // This should never happen, but just in case.
    }

    /**
     *
     * Save the queue to the storage.
     * @returns {Awaitable<void>}
     * @example
     * ```ts
     * await player.queue.utils.save();
     * ```
     */
    public save(): Awaitable<void> {
        const max: number = this.options.maxHistory;
        const length: number = this.queue.tracks.length;

        if (length > max) this.queue.history.splice(0, length - max);

        this.queue.player.manager.emit(
            EventNames.Debug,
            DebugLevels.Queue,
            `[Queue] -> [Adapter] Saving queue for ${this.queue.player.guildId} | Object: ${stringify(this.queue.toJSON())}`,
        );

        return this.storage.set(this.queue.player.guildId, this.queue.toJSON());
    }

    /**
     *
     * Destroy the queue, removing all stored data.
     * @returns {Promise<void>}
     * @example
     * ```ts
     * await player.queue.utils.destroy();
     * ```
     */
    public destroy(): Awaitable<boolean> {
        this.queue.player.manager.emit(
            EventNames.Debug,
            DebugLevels.Queue,
            `[Queue] -> [Adapter] Destroying queue for ${this.queue.player.guildId}`,
        );

        return this.storage.delete(this.queue.player.guildId);
    }

    /**
     *
     * Sync the queue with the stored data.
     * @param {SyncOptions} [options={}] Sync options.
     * @returns {Promise<void>} The promise for the sync operation.
     * @example
     * ```ts
     * await player.queue.utils.sync();
     * ```
     */
    public async sync(options: SyncOptions = {}): Promise<void> {
        const { override = true, syncCurrent = false } = options;

        const storedQueue: QueueJson | undefined = await this.storage.get(this.queue.player.guildId);
        if (!storedQueue) throw new StorageError(`No data found to sync for guildId: ${this.queue.player.guildId}`);

        if (syncCurrent && storedQueue.current && !this.queue.current && isResolved(storedQueue.current))
            this.queue.current = storedQueue.current;

        const tracks: TrackStructure[] = storedQueue.tracks.filter((track): track is TrackStructure => isResolved(track)) || [];
        const history: TrackStructure[] = storedQueue.history.filter((track): track is TrackStructure => isResolved(track)) || [];

        const length: number = this.queue.tracks.length;

        if (tracks.length) this.queue.tracks.splice(override ? 0 : length, override ? length : 0, ...tracks);
        if (history.length) this.queue.history.splice(0, override ? length : 0, ...history);

        this.queue.player.manager.emit(
            EventNames.Debug,
            DebugLevels.Queue,
            `[Queue] -> [Adapter] Syncing queue for ${this.queue.player.guildId} | Object: ${stringify(storedQueue)}`,
        );

        await this.save();
    }
}
