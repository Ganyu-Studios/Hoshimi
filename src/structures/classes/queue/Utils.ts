import type { Awaitable, QueueJSON } from "../../types";
import type { Player } from "../manager/Player";
import { isTrack } from "../../utils";
import { StorageError } from "../manager/Error";
import { QueueStore } from "./Storage";
import type { Queue } from "./Queue";

/**
 * Queue Utils class.
 */
export class QueueUtils {
	/**
	 * Player instance.
	 */
	private queue: Queue;
	/**
	 * Queue store.
	 */
	private store: QueueStore;

	/**
	 *
	 * Constructor of the queue utils.
	 * @param queue Player instance.
	 */
	constructor(queue: Queue) {
		this.queue = queue;
		this.store = new QueueStore(this.queue.player.manager.options.storage!);
	}

	/**
	 *
	 * Save the queue.
	 * @returns {Awaitable<void>}
	 */
	public save(): Awaitable<void> {
		if (this.queue.previous.length > this.queue.player.manager.options.maxPreviousTracks!)
			this.queue.previous.splice(
				this.queue.player.manager.options.maxPreviousTracks!,
				this.queue.player.queue.previous.length,
			);
		return this.store.set(this.queue.player.guildId, this.queue.player.queue.toJSON());
	}

	/**
	 *
	 * Destroy the queue.
	 * @returns {Promise<void>}
	 */
	public destroy(): Awaitable<boolean> {
		return this.store.delete(this.queue.player.guildId);
	}

	/**
	 *
	 * Sync the queue.
	 * @returns {Awaitable<void>}
	 */
	public async sync(override = true, syncCurrent = false): Promise<void> {
		const data = this.store.get<QueueJSON>(this.queue.player.guildId);
		if (!data)
			throw new StorageError(
				`No data found to sync for guildId: ${this.queue.player.guildId}`,
			);

		if (syncCurrent && !this.queue.player.queue.current)
			this.queue.player.queue.current = data.current;
		if (
			Array.isArray(data.tracks) &&
			data?.tracks.length &&
			data.tracks.some((track) => isTrack(track))
		)
			this.queue.player.queue.tracks.splice(
				override ? 0 : this.queue.player.queue.tracks.length,
				override ? this.queue.player.queue.tracks.length : 0,
				...data.tracks.filter((track) => isTrack(track)),
			);
		if (
			Array.isArray(data.previous) &&
			data?.previous.length &&
			data.previous.some((track) => isTrack(track))
		)
			this.queue.player.queue.previous.splice(
				0,
				override ? this.queue.player.queue.tracks.length : 0,
				...data.previous.filter((track) => isTrack(track)),
			);

		await this.save();
	}
}
