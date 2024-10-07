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
	private player: Player;
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
		this.player = queue.player;
		this.store = new QueueStore(this.player.manager.options.storage!);
	}

	/**
	 *
	 * Save the queue.
	 * @returns {Awaitable<void>}
	 */
	public save(): Awaitable<void> {
		if (this.player.queue.previous.length > this.player.manager.options.maxPreviousTracks!)
			this.player.queue.previous.splice(
				this.player.manager.options.maxPreviousTracks!,
				this.player.queue.previous.length,
			);
		return this.store.set(this.player.guildId, this.player.queue.toJSON());
	}

	/**
	 *
	 * Destroy the queue.
	 * @returns {Promise<void>}
	 */
	public destroy(): Awaitable<boolean> {
		return this.store.delete(this.player.guildId);
	}

	/**
	 *
	 * Sync the queue.
	 * @returns {Awaitable<void>}
	 */
	public async sync(override = true, syncCurrent = false): Promise<void> {
		const data = this.store.get<QueueJSON>(this.player.guildId);
		if (!data)
			throw new StorageError(`No data found to sync for guildId: ${this.player.guildId}`);

		if (syncCurrent && !this.player.queue.current) this.player.queue.current = data.current;
		if (
			Array.isArray(data.tracks) &&
			data?.tracks.length &&
			data.tracks.some((track) => isTrack(track))
		)
			this.player.queue.tracks.splice(
				override ? 0 : this.player.queue.tracks.length,
				override ? this.player.queue.tracks.length : 0,
				...data.tracks.filter((track) => isTrack(track)),
			);
		if (
			Array.isArray(data.previous) &&
			data?.previous.length &&
			data.previous.some((track) => isTrack(track))
		)
			this.player.queue.previous.splice(
				0,
				override ? this.player.queue.tracks.length : 0,
				...data.previous.filter((track) => isTrack(track)),
			);

		await this.save();
	}
}
