import { type Awaitable, DebugLevels, EventNames } from "../../types/Manager";
import type { LavalinkTrack, UnresolvedLavalinkTrack } from "../../types/Node";
import type { HoshimiQueueOptions, QueueJson } from "../../types/Queue";
import { type QueueStructure, Structures, type TrackStructure } from "../../types/Structures";
import { isResolved, isUnresolved, stringify } from "../../util/functions/utils";
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
     * Build a playable track from resolved/unresolved inputs.
     * @param {TrackResolvableStructure | null} track The input track.
     * @param {TrackRequester} [requester] Optional requester override.
     * @returns {Promise<TrackStructure | null>} The built track.
     */
    public async build(
        track: TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack | null,
        requester?: TrackRequester,
    ): Promise<TrackStructure | null> {
        if (!track) return null;

        const requesterFn = this.queue.player.manager.options.playerOptions.requesterFn;
        const trackRequester: TrackRequester | undefined = "requester" in track ? track.requester : undefined;
        const request = requesterFn(requester ?? trackRequester ?? {});

        if (isResolved(track)) return Structures.Track(track, request);

        if (!isUnresolved(track)) throw new ResolveError("The track is not a valid unresolved track.");
        if (!("resolve" in track) || typeof track.resolve !== "function")
            return Structures.UnresolvedTrack(track, request).resolve(this.queue.player);

        return track.resolve(this.queue.player);
    }

    /**
     *
     * Save the queue.
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
     * Destroy the queue.
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
     * Sync the queue.
     * @param {boolean} [override=true] Whether to override the current queue or not.
     * @param {boolean} [syncCurrent=false] Whether to sync the current track or not.
     * @returns {Promise<void>} The promise for the sync operation.
     * @example
     * ```ts
     * await player.queue.utils.sync();
     * ```
     */
    public async sync(override: boolean = true, syncCurrent: boolean = false): Promise<void> {
        const data: QueueJson | undefined = await this.storage.get(this.queue.player.guildId);
        if (!data) throw new StorageError(`No data found to sync for guildId: ${this.queue.player.guildId}`);

        if (syncCurrent && data.current && !this.queue.current && isResolved(data.current)) this.queue.current = data.current;

        const tracks: TrackStructure[] = data.tracks.filter((track): track is TrackStructure => isResolved(track)) || [];
        const history: TrackStructure[] = data.history.filter((track): track is TrackStructure => isResolved(track)) || [];

        const length: number = this.queue.tracks.length;

        if (tracks.length) this.queue.tracks.splice(override ? 0 : length, override ? length : 0, ...tracks);
        if (history.length) this.queue.history.splice(0, override ? length : 0, ...history);

        this.queue.player.manager.emit(
            EventNames.Debug,
            DebugLevels.Queue,
            `[Queue] -> [Adapter] Syncing queue for ${this.queue.player.guildId} | Object: ${stringify(data)}`,
        );

        await this.save();
    }
}
