import type { Manager } from "./Manager";
import type { Track } from "./Track";

/**
 * Main Queue class.
 */
export class Queue {
	/**
	 * Tracks of the queue.
	 */
	public tracks: Track[] = [];
	/**
	 * Previous tracks of the queue.
	 */
	public previous: Track[] = [];

	/**
	 * Current track of the queue.
	 */
	public current: Track | null = null;

	/**
	 * Manager instance.
	 */
	private manager: Manager;

	/**
	 *
	 * Constructor of the queue.
	 * @param manager Manager instance.
	 */
	constructor(manager: Manager) {
		this.manager = manager;
	}

	/**
	 * Get the track size of the queue.
	 */
	public get size(): number {
		return this.tracks.length;
	}

	/**
	 * Get the total track size of the queue (Includes the current track).
	 */
	public get totalSize(): number {
		return this.size + Number(!!this.current);
	}

	/**
	 *
	 * Check if the queue is empty.
	 * @returns {boolean} True if the queue is empty.
	 */
	public isEmpty(): boolean {
		return this.size === 0;
	}

	/**
	 *
	 * Get the previous track of the queue.
	 * @returns {Track | null} The previous track of the queue.
	 */
	public getPrevious(remove?: boolean): Track | null {
		if (remove) return this.previous.shift() ?? null;
		return this.previous[0] ?? null;
	}

	/**
	 *
	 * Add a track or tracks to the queue.
	 * @param track The track or tracks to add.
	 * @returns
	 */
	public add(track: Track | Track[], position?: number): this {
		if (typeof position === "number" && position >= 0 && position < this.tracks.length) {
			this.tracks.splice(position, 0, ...(Array.isArray(track) ? track : [track]));
			return this;
		}

		if (Array.isArray(track)) this.tracks.push(...track);
		else this.tracks.push(track);

		this.manager.emit(
			"debug",
			`[Queue -> Add] Added ${this.tracks.length} tracks to the queue.`,
		);
		this.manager.emit("queueUpdate", this);

		return this;
	}

	/**
	 *
	 * Get the first track of the queue.
	 * @returns {Track | null} The first track of the queue.
	 */
	public shift(): Track | null {
		return this.tracks.shift() ?? null;
	}

	/**
	 *
	 * Add tracks to the beginning of the queue.
	 * @param tracks The tracks to add.
	 * @returns {this} The queue instance.
	 */
	public unshift(...tracks: Track[]): this {
		this.tracks.unshift(...tracks);

		this.manager.emit(
			"debug",
			`[Queue -> Unshift] Added ${this.tracks.length} tracks to the queue.`,
		);
		this.manager.emit("queueUpdate", this);

		return this;
	}

	/**
	 *
	 * Shuffle the queue.
	 * @returns {this} The queue instance.
	 */
	public shuffle(): this {
		if (this.size <= 1) return this;
		if (this.size === 2) [this.tracks[0], this.tracks[1]] = [this.tracks[1]!, this.tracks[0]!];
		else {
			for (let i = this.tracks.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[this.tracks[i], this.tracks[j]] = [this.tracks[j]!, this.tracks[i]!];
			}
		}

		this.manager.emit("debug", "[Queue -> Shuffle] Shuffled the queue.");
		this.manager.emit("queueUpdate", this);

		return this;
	}

	/**
	 *
	 * Clear the queue.
	 * @returns {this} The queue instance.
	 */
	public clear(): this {
		this.tracks = [];
		this.previous = [];
		this.current = null;

		this.manager.emit("debug", "[Queue -> Clear] Cleared the queue.");
		this.manager.emit("queueUpdate", this);

		return this;
	}

	/**
	 *
	 * Move a track to a specific position in the queue.
	 * @param track The track to move.
	 * @param to The position to move.
	 * @returns
	 */
	public moveTrack(track: Track, to: number): this {
		const index = this.tracks.indexOf(track);
		if (index === -1) return this;

		this.tracks.splice(index, 1);
		this.add(track, to - 1);

		this.manager.emit(
			"debug",
			`[Queue -> Move] Moved track ${track.info.title} to position ${to}.`,
		);
		this.manager.emit("queueUpdate", this);

		return this;
	}

	/**
	 *
	 * Delete tracks from the queue.
	 * @param start The start index.
	 * @param deleteCount The number of tracks to delete.
	 * @param tracks The tracks to add.
	 * @returns {this} The queue instance.
	 */
	public spliceTrack(start: number, deleteCount: number, tracks?: Track | Track[]): this {
		if (!this.size && tracks) this.add(tracks);

		if (tracks)
			this.tracks.splice(start, deleteCount, ...(Array.isArray(tracks) ? tracks : [tracks]));
		else this.tracks.splice(start, deleteCount);

		this.manager.emit(
			"debug",
			`[Queue -> Splice] Removed ${deleteCount} tracks from the queue.`,
		);
		this.manager.emit("queueUpdate", this);

		return this;
	}
}
