import { DebugLevels, EventNames } from "../../types/Manager";
import type { QueueJSON, TrackJSON } from "../../types/Queue";
import type { PlayerStructure, TrackStructure } from "../../types/Structures";
import { QueueError } from "../Errors";
import { Track, type TrackResolvableStructure, UnresolvedTrack } from "../Track";
import { QueueUtils } from "./Utils";

/**
 * Class representing a queue.
 * @class Queue
 */
export class Queue {
    /**
     * Tracks of the queue.
     * @type {TrackResolvableStructure[]}
     */
    public tracks: TrackResolvableStructure[] = [];

    /**
     * Previous tracks of the queue.
     * @type {TrackStructure[]}
     */
    public history: TrackStructure[] = [];

    /**
     * Current track of the queue.
     * @type {TrackStructure | null}
     */
    public current: TrackStructure | null = null;

    /**
     * The player instance.
     * @type {PlayerStructure}
     */
    readonly player: PlayerStructure;

    /**
     * The queue utils instance.
     * @type {QueueUtils}
     * @readonly
     */
    readonly utils: QueueUtils;

    /**
     *
     * Constructor of the queue.
     * @param {PlayerStructure} player Player instance.
     * @example
     * ```ts
     * const queue = Structures.Queue(player);
     *
     * console.log(queue.size); // 0
     * queue.add(track);
     * console.log(queue.size); // 1
     * ```
     */
    constructor(player: PlayerStructure) {
        this.player = player;
        this.utils = new QueueUtils(this);
    }

    /**
     * Get the track size of the queue.
     * @type {number}
     * @returns {number} The track size of the queue.
     * @readonly
     * @example
     * ```ts
     * const queue = player.queue;
     *
     * console.log(queue.size); // 0
     * queue.add(track);
     *
     * console.log(queue.size); // 1
     * queue.add([track1, track2]);
     *
     * console.log(queue.size); // 3
     * queue.shift();
     * console.log(queue.size); // 2
     *
     * queue.clear();
     * console.log(queue.size); // 0
     * ```
     */
    public get size(): number {
        return this.tracks.length;
    }

    /**
     * Get the total track size of the queue (Includes the current track).
     * @type {number}
     * @returns {number} The total track size of the queue.
     * @readonly
     * @example
     * ```ts
     * const queue = player.queue;
     *
     * console.log(queue.totalSize); // 0
     * queue.add(track);
     *
     * console.log(queue.totalSize); // 1
     * queue.add([track1, track2]);
     *
     * console.log(queue.totalSize); // 3
     * queue.shift();
     * console.log(queue.totalSize); // 2
     *
     * queue.clear();
     * console.log(queue.totalSize); // 0
     * ```
     */
    public get totalSize(): number {
        return this.size + Number(!!this.current);
    }

    /**
     *
     * Check if the queue is empty.
     * @type {boolean}
     * @returns {boolean} True if the queue is empty.
     * @readonly
     * @example
     * ```ts
     * const queue = player.queue;
     *
     * console.log(queue.isEmpty()); // true
     * queue.add(track);
     *
     * console.log(queue.isEmpty()); // false
     * queue.clear();
     *
     * console.log(queue.isEmpty()); // true
     * ```
     */
    public isEmpty(): boolean {
        return this.size === 0;
    }

    /**
     *
     * Get the previous track of the queue.
     * @param {boolean} [remove=false] Whether to remove the track from the previous queue.
     * @returns {Promise<TrackStructure | null>} The previous track of the queue.
     * @example
     * ```ts
     * const queue = player.queue;
     *
     * console.log(await queue.previous()); // null
     * queue.add(track);
     * queue.add(track2);
     *
     * console.log(await queue.previous()); // track
     * console.log(await queue.previous(true)); // track and remove it from the previous tracks
     * ```
     */
    public async previous(remove: boolean = false): Promise<TrackStructure | null> {
        if (remove) {
            const track: TrackStructure | null = this.history.shift() ?? null;
            if (track) await this.utils.save();

            return track;
        }

        return this.history[0] ?? null;
    }

    /**
     *
     * Add a track or tracks to the queue.
     * @param {TrackResolvableStructure | TrackResolvableStructure[]} track The track or tracks to add.
     * @param {number} [position] The position to add the track or tracks.
     * @returns {Promise<this>} The queue instance.
     * @example
     * ```ts
     * const queue = player.queue;
     *
     * console.log(queue.size); // 0
     *
     * await queue.add(track);
     * console.log(queue.size); // 1
     *
     * await queue.add([track1, track2]);
     * console.log(queue.size); // 3
     *
     * await queue.add(track3, 1);
     * console.log(queue.size); // 4
     * console.log(queue.tracks); // [track1, track3, track2, track]
     * ```
     */
    public async add(track: TrackResolvableStructure | TrackResolvableStructure[], position?: number): Promise<this> {
        const tracks: TrackResolvableStructure[] = Array.isArray(track) ? track : [track];

        if (typeof position === "number" && position >= 0 && position < this.tracks.length) {
            await this.splice(position, 0, ...tracks);
            return this;
        }

        this.tracks.push(...tracks);
        this.player.manager.emit(EventNames.QueueUpdate, this.player, this);
        this.player.manager.emit(EventNames.Debug, DebugLevels.Queue, `[Queue] -> [Add] Added ${this.tracks.length} tracks to the queue.`);

        await this.utils.save();

        return this;
    }

    /**
     *
     * Get the first track of the queue.
     * @returns {Promise<TrackResolvableStructure | null>} The first track of the queue.
     * @example
     * ```ts
     * const queue = player.queue;
     *
     * console.log(await queue.shift()); // null
     * await queue.add(track);
     *
     * console.log(await queue.shift()); // track
     * await queue.add(track2);
     * ```
     */
    public async shift(): Promise<TrackResolvableStructure | null> {
        const track: TrackResolvableStructure | null = this.tracks.shift() ?? null;
        if (track) await this.utils.save();
        return track;
    }

    /**
     *
     * Add tracks to the beginning of the queue.
     * @param {TrackResolvableStructure[]} tracks The tracks to add.
     * @returns {Promise<this>} The queue instance.
     * @example
     * ```ts
     * const queue = player.queue;
     *
     * console.log(queue.size); // 0
     * await queue.unshift(track);
     *
     * console.log(queue.size); // 1
     * await queue.unshift(track1, track2);
     *
     * console.log(queue.size); // 3
     * console.log(queue.tracks); // [track1, track2, track]
     * ```
     */
    public async unshift(...tracks: TrackResolvableStructure[]): Promise<this> {
        this.tracks.unshift(...tracks);

        this.player.manager.emit(
            EventNames.Debug,
            DebugLevels.Queue,
            `[Queue] -> [Unshift] Added ${this.tracks.length} tracks to the queue.`,
        );

        await this.utils.save();

        return this;
    }

    /**
     *
     * Shuffle the queue.
     * @returns {Promise<this>} The queue instance.
     * @example
     * ```ts
     * const queue = player.queue;
     *
     * console.log(queue.size); // 0
     * await queue.add(track);
     * await queue.add(track1, track2);
     *
     * console.log(queue.size); // 3
     * console.log(queue.tracks); // [track, track1, track2]
     *
     * await queue.shuffle();
     * console.log(queue.tracks); // [track2, track, track1]
     * ```
     */
    public async shuffle(): Promise<this> {
        if (this.size <= 1) return this;
        if (this.size === 2) [this.tracks[0], this.tracks[1]] = [this.tracks[1]!, this.tracks[0]!];
        else {
            for (let i: number = this.tracks.length - 1; i > 0; i--) {
                const j: number = Math.floor(Math.random() * (i + 1));
                [this.tracks[i], this.tracks[j]] = [this.tracks[j]!, this.tracks[i]!];
            }
        }

        this.player.manager.emit(EventNames.QueueUpdate, this.player, this);
        this.player.manager.emit(EventNames.Debug, DebugLevels.Queue, "[Queue] -> [Shuffle] Shuffled the queue.");

        await this.utils.save();

        return this;
    }

    /**
     * Clear the queue.
     * @param {ClearOptions} [options] The options for clearing the queue.
     * @returns {Promise<this>} The queue instance.
     * @example
     * ```ts
     * const queue = player.queue;
     *
     * // Clear queue and stop playback
     * console.log(queue.size); // 0
     * await queue.add(track);
     * await queue.add(track1, track2);
     * await queue.clear();
     * console.log(queue.current); // track
     * console.log(queue.size); // 0
     *
     * // Keep current track
     * await queue.add(track);
     * await queue.clear();
     * console.log(queue.current); // track
     * console.log(queue.size); // 0
     * ```
     */
    public async clear(): Promise<this> {
        this.tracks = [];
        this.history = [];

        this.player.manager.emit(EventNames.QueueUpdate, this.player, this);
        this.player.manager.emit(EventNames.Debug, DebugLevels.Queue, "[Queue] -> [Clear] Cleared the queue.");

        await this.utils.destroy();

        return this;
    }

    /**
     *
     * Move a track to a specific position in the queue.
     * @param {TrackResolvableStructure} track The track to move.
     * @param {number} to The position to move.
     * @returns {Promise<this>} The queue instance.
     * @example
     * ```ts
     * const queue = player.queue;
     * await queue.add(track);
     * await queue.add(track1);
     * await queue.add(track2);
     *
     * console.log(queue.tracks); // [track, track1, track2]
     * await queue.move(track1, 0);
     * console.log(queue.tracks); // [track1, track, track2]
     * ```
     */
    public async move(track: TrackResolvableStructure, to: number): Promise<this> {
        const index: number = this.tracks.indexOf(track);
        if (index === -1) return this;

        await this.splice(index, 1);
        await this.add(track, to - 1);

        this.player.manager.emit(EventNames.QueueUpdate, this.player, this);
        this.player.manager.emit(
            EventNames.Debug,
            DebugLevels.Queue,
            `[Queue] -> [Move] Moved track ${track.info.title} to position ${to}.`,
        );

        await this.utils.save();

        return this;
    }

    /**
     *
     * Delete tracks from the queue.
     * @param {number} start The start index.
     * @param {number} deleteCount The number of tracks to delete.
     * @param {TrackResolvableStructure | TrackResolvableStructure[]} [tracks] The tracks to add.
     * @returns {Promise<TrackResolvableStructure[]>} The spliced tracks.
     * @example
     * ```ts
     * const queue = player.queue;
     * await queue.add(track);
     * await queue.add(track1);
     * await queue.add(track2);
     *
     * console.log(queue.tracks); // [track, track1, track2]
     * await queue.splice(1, 1);
     * console.log(queue.tracks); // [track, track2]
     * ```
     */
    public async splice(
        start: number,
        deleteCount: number,
        tracks?: TrackResolvableStructure | TrackResolvableStructure[],
    ): Promise<TrackResolvableStructure[]> {
        if (!this.size && tracks) await this.add(tracks);

        const spliced = tracks
            ? this.tracks.splice(start, deleteCount, ...(Array.isArray(tracks) ? tracks : [tracks]))
            : this.tracks.splice(start, deleteCount);

        this.player.manager.emit(EventNames.QueueUpdate, this.player, this);
        this.player.manager.emit(EventNames.Debug, DebugLevels.Queue, `[Queue] -> [Splice] Removed ${deleteCount} tracks from the queue.`);

        await this.utils.save();

        return spliced;
    }

    /**
     *
     * Convert the queue to a JSON object.
     * @returns {QueueJSON} The queue JSON object.
     * @example
     * ```ts
     * const queue = player.queue;
     * await queue.add(track);
     *
     * console.log(queue.toJSON()); // { tracks: [{ ... }, { ... }], history: [], current: null }
     * ```
     */
    public toJSON(): QueueJSON {
        const tracks: TrackResolvableStructure[] = [...this.tracks, ...this.history, this.current].filter(
            (track): track is TrackResolvableStructure => !!track,
        );
        if (tracks.length && tracks.every((track): boolean => !(track instanceof Track) && !(track instanceof UnresolvedTrack)))
            throw new QueueError("Cannot convert queue to JSON because it contains invalid object tracks.");

        const max: number = this.player.manager.options.queueOptions.maxHistory;

        if (this.history.length > max) this.history.splice(max, this.history.length);

        return {
            tracks: this.tracks.map((track): TrackJSON => track.toJSON()),
            history: this.history.map((track): TrackJSON => track.toJSON()),
            current: this.current?.toJSON() ?? null,
        };
    }
}
