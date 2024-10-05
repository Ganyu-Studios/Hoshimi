import { Awaitable, QueueJSON } from "../../types";
import { isTrack } from "../../utils";
import { ManagerError } from "../manager/Error";
import { Player } from "../manager/Player";

export class QueueUtils {
	private player: Player;

	constructor(player: Player) {
		this.player = player;
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
		return this.player.manager.options.storage!.set(
			this.player.guildId,
			this.player.queue.toJSON(),
		);
	}

	/**
	 *
	 * Destroy the queue.
	 * @returns {Promise<void>}
	 */
	public destroy(): Awaitable<void> {
		return this.player.manager.options.storage!.delete(this.player.guildId);
	}

	/**
	 *
	 * Sync the queue.
	 * @returns {Awaitable<void>}
	 */
	public async sync(override = true, syncCurrent = false): Promise<void> {
		const data = await this.player.manager.options.storage!.get<QueueJSON>(this.player.guildId);
		if (!data)
			throw new ManagerError(`No data found to sync for guildId: ${this.player.guildId}`);

		if (!syncCurrent && !this.player.queue.current) this.player.queue.current = data.current;
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
