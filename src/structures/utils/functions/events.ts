import {
	PlayerEventType,
	type TrackStartEvent,
	type TrackEndEvent,
	type WebSocketClosedEvent,
	type TrackStuckEvent,
	type TrackExceptionEvent,
	type PlayerUpdate,
} from "shoukaku";
import type { Player, Track } from "../../classes";
import { LoopMode } from "../../types";

/**
 *
 * Queue track end event.
 * @param this The player instance.
 * @returns
 */
async function queueTrackEnd(this: Player) {
	if (
		this.queue.current &&
		!this.queue.previous.find(
			(x) =>
				x.info.identifier === this.queue.current?.info.identifier &&
				x.info.title === this.queue.current?.info.title,
		)
	) {
		this.queue.previous.unshift(this.queue.current);
		if (this.queue.previous.length > this.manager.options!.maxPreviousTracks!)
			this.queue.previous.splice(
				this.manager.options!.maxPreviousTracks!,
				this.queue.previous.length,
			);

		await this.queue.utils.save();

		this.manager.emit(
			"debug",
			`[Player -> Previous] The track: ${this.queue.current?.info.title} has been added to the previous track list.`,
		);
	}

	if (this.loop === LoopMode.Track && this.queue.current) this.queue.unshift(this.queue.current);
	if (this.loop === LoopMode.Queue && this.queue.current) this.queue.add(this.queue.current);

	if (!this.queue.current) this.queue.current = this.queue.shift();

	await this.queue.utils.save();

	return;
}

/**
 *
 * Player queue end event.
 * @param this The player instance.
 * @param track The track that ended.
 * @param payload The payload of the event.
 * @returns
 */
async function queueEnd(
	this: Player,
	track: Track | null,
	payload: TrackEndEvent | TrackStuckEvent | TrackExceptionEvent,
) {
	this.playing = false;
	this.paused = false;
	this.queue.current = null;

	if (this.manager.options.autoplayFn && typeof this.manager.options.autoplayFn === "function") {
		await this.manager.options.autoplayFn(this, this.queue.current ?? track);
		if (this.queue.size > 0) await queueTrackEnd.call(this);
		if (this.queue.current) {
			if (payload.type === PlayerEventType.TRACK_END_EVENT)
				this.manager.emit("trackEnd", this, track, payload);
			this.manager.emit("debug", "[Queue -> Autoplay] Track queued from autoplay function.");
			return this.play({ noReplace: true, pause: false });
		}
	}

	if (track) await this.queue.utils.save();
	if ((payload as TrackEndEvent).reason !== "stopped") await this.queue.utils.save();

	this.manager.emit("debug", "[Player -> Queue] The queue has ended.");
	this.manager.emit("queueEnd", this, this.queue);
}

/**
 *
 * Lavalink track start event.
 * @param this
 */
export async function trackStart(this: Player, payload: TrackStartEvent) {
	this.paused = false;
	this.playing = true;

	if (this.queue.current) await this.queue.utils.save();

	this.manager.emit(
		"debug",
		`[Player -> Start] The track: ${this.queue.current?.info.title} has started playing.`,
	);
	this.manager.emit("trackStart", this, this.queue.current, payload);
}

/**
 *
 * Lavalink track ended event.
 * @param this
 * @param payload
 * @returns
 */
export async function trackEnd(this: Player, payload: TrackEndEvent) {
	const current = this.queue.current;

	if (!this.queue.size && this.loop === LoopMode.Off)
		return queueEnd.call(this, current, payload);
	if (payload.reason === "replaced") return this.manager.emit("trackEnd", this, current, payload);
	if (["loadFailed", "cleanup"].includes(payload.reason)) {
		this.playing = false;

		await queueTrackEnd.call(this);

		if (!this.queue.size || !this.queue.current) return queueEnd.call(this, current, payload);

		this.manager.emit("debug", `[Player -> End] The track: ${current?.info.title} has ended.`);
		this.manager.emit("trackEnd", this, current, payload);
		this.queue.current = null;

		return this.play();
	}

	if (current) await this.queue.utils.save();

	await queueTrackEnd.call(this);

	this.queue.current = null;

	if (this.queue.size) this.manager.emit("trackEnd", this, current, payload);
	else {
		this.playing = false;
		return queueEnd.call(this, current, payload);
	}

	this.manager.emit("debug", `[Player -> End] The track: ${current?.info.title} has ended.`);

	return this.play();
}

/**
 *
 * Lavalink websocket closed event.
 * @param this The player instance.
 * @param payload The payload of the event.
 * @returns
 */
export function socketClosed(this: Player, payload: WebSocketClosedEvent) {
	return this.manager.emit("socketClosed", payload);
}

/**
 *
 * Lavalink track stuck event.
 * @param this The player instance.
 * @param payload The payload of the event.
 * @returns
 */
export async function trackStuck(this: Player, payload: TrackStuckEvent) {
	if (!this.queue.size && this.loop === LoopMode.Off)
		return queueEnd.call(this, this.queue.current, payload);

	await queueTrackEnd.call(this);

	if (!this.queue.current) return queueEnd.call(this, this.queue.current, payload);
	return this.manager.emit("trackStuck", this, this.queue.current, payload);
}

/**
 *
 * Lavalink track error event.
 * @param this The player instance.
 * @param payload The payload of the event.
 * @returns
 */
export async function trackError(this: Player, payload: TrackExceptionEvent) {
	if (!this.queue.size && this.loop === LoopMode.Off)
		return queueEnd.call(this, this.queue.current, payload);

	await queueTrackEnd.call(this);

	if (!this.queue.current) return queueEnd.call(this, this.queue.current, payload);

	return this.manager.emit("trackError", this, this.queue.current, payload);
}

/**
 *
 * Lavalink player update event.
 * @param this The player instance.
 * @param payload The payload of the event.
 * @returns
 */
export function playerUpdate(this: Player, payload: PlayerUpdate) {
	return this.manager.emit("playerUpdate", payload);
}

/**
 *
 * Lavalink player resumed event.
 * @param this The player instance.
 * @returns
 */
export function playerResumed(this: Player) {
	return this.manager.emit("playerResumed", this);
}
