import type { Node, Player as ShoukakuPlayer } from "shoukaku";

import {
	LoopMode,
	type NonNodePlayerOptions,
	type PlayOptions,
	type QueryOptions,
	type SearchResult,
} from "../../types";
import type { Manager } from "./Manager";

import {
	playerResumed,
	playerUpdate,
	socketClosed,
	trackEnd,
	trackError,
	trackStart,
	trackStuck,
	validatePlayerOptions,
} from "../../utils";
import { Queue } from "../queue/Queue";
import { PlayerError } from "./Error";

/**
 * Main Player class.
 */
export class Player {
	private data: Record<string, unknown> = {};

	/**
	 * Shoukaku player.
	 */
	readonly shoukaku: ShoukakuPlayer;
	/**
	 * Options of the player.
	 */
	readonly options: NonNodePlayerOptions;
	/**
	 * Manager instance..
	 */
	readonly manager: Manager;
	/**
	 * Queue of the player.
	 */
	readonly queue: Queue;

	/**
	 * Check if the player is self deafened.
	 */
	readonly selfDeaf: boolean = false;
	/**
	 * Check if the player is self muted.
	 */
	readonly selfMute: boolean = false;

	/**
	 * Loop mode of the player.
	 */
	public loop: LoopMode = LoopMode.Off;
	/**
	 * Check if the player is playing.
	 */
	public playing: boolean = false;
	/**
	 * Check if the player is paused.
	 */
	public paused: boolean = false;
	/**
	 * Check if the player is connected.
	 */
	public connected: boolean = false;
	/**
	 * Volume of the player.
	 */
	public volume: number = 100;
	/**
	 * Guild ig of the player.
	 */
	public guildId: string;
	/**
	 * Voice channel idof the player.
	 */
	public voiceId: string | null;
	/**
	 * Text channel id of the player.
	 */
	public textId?: string;

	/**
	 *
	 * Constructor of the player.
	 * @param manager Manager instance.
	 * @param shoukaku Shoukaku player instance.
	 * @param options Player options.
	 */
	constructor(manager: Manager, shoukaku: ShoukakuPlayer, options: NonNodePlayerOptions) {
		this.shoukaku = shoukaku;
		this.options = options;
		this.manager = manager;

		this.queue = new Queue(this);

		this.guildId = options.guildId;
		this.voiceId = options.voiceId;

		this.selfDeaf = options.selfDeaf ?? false;
		this.selfMute = options.selfMute ?? false;
		this.volume = options.volume ?? 100;
		this.textId = options.textId ?? undefined;

		this.shoukaku.on("start", trackStart.bind(this));
		this.shoukaku.on("end", trackEnd.bind(this));
		this.shoukaku.on("closed", socketClosed.bind(this));
		this.shoukaku.on("stuck", trackStuck.bind(this));
		this.shoukaku.on("exception", trackError.bind(this));
		this.shoukaku.on("update", playerUpdate.bind(this));
		this.shoukaku.on("resumed", playerResumed.bind(this));

		validatePlayerOptions(options);
	}

	/**
	 * Node of the player.
	 * @returns {Node} Node of the player.
	 */
	public get node(): Node {
		return this.shoukaku.node;
	}

	/**
	 *
	 * Get the current position of the player.
	 * @returns {number} Current position of the player.
	 */
	public get position(): number {
		return this.shoukaku.position;
	}

	/**
	 *
	 * Make the player play a track.
	 * @param options Some options to play.
	 * @returns {Promise<this>} The player instance.
	 */
	public async play(options: PlayOptions = {}): Promise<this> {
		if (options.track) this.queue.current = options.track;
		else if (!this.queue.current) this.queue.current = this.queue.shift();

		if (!this.queue.current) throw new PlayerError("No track to play.");

		this.manager.emit(
			"debug",
			`[Player -> Play] A new track is playing: ${this.queue.current.info.title}`,
		);
		this.shoukaku.playTrack(
			{
				track: { encoded: this.queue.current.encoded },
				paused: options.pause ?? this.paused,
				volume: options.volume ?? this.volume,
			},
			options.noReplace ?? false,
		);

		return this;
	}

	/**
	 *
	 * Search using the player instance.
	 * @param query The query to search.
	 * @param options The options of the search.
	 * @returns {Promise<SearchResult>} The search result object.
	 */
	public async search(query: string, options: QueryOptions): Promise<SearchResult> {
		return this.manager.search(query, options);
	}

	/**
	 *
	 * Skip the current track.
	 * @param to The number of tracks to skip.
	 * @returns {Promise<this>} The player instance.
	 */
	public async skip(to: number = 0): Promise<this> {
		if (typeof to === "number" && to >= 0) {
			if (to > this.queue.size) throw new PlayerError("Can't skip more than the queue size.");
			this.queue.spliceTrack(0, to - 1);
		}

		if (!this.playing) await this.play();

		await this.shoukaku.stopTrack();

		return this;
	}

	/**
	 *
	 * Disconnect the player.
	 * @returns {void} The player instance.
	 */
	public disconnect(): void {
		this.playing = false;
		this.paused = false;
		this.connected = false;

		this.manager.options.sendPayload(this.guildId, {
			op: 4,
			d: {
				guild_id: this.guildId,
				channel_id: null,
				self_mute: false,
				self_deaf: false,
			},
		});

		this.voiceId = null;
		this.manager.emit("debug", `[Player -> Disconnect] Player ${this.guildId} disconnected.`);

		return;
	}

	/**
	 *
	 * Destroy the player.
	 * @param reason The reason of the destroy.
	 * @returns {Promise<void>} The player instance.
	 */
	public async destroy(reason?: string): Promise<void> {
		this.disconnect();
		this.shoukaku.clean();

		await this.manager.shoukaku.leaveVoiceChannel(this.guildId);
		await this.shoukaku.destroy();

		this.shoukaku.removeAllListeners();
		this.manager.players.delete(this.guildId);
		this.manager.emit("playerDestroy", this, reason ?? "Player destroyed.");
		this.manager.emit("debug", `[Player -> Destroy] Player ${this.guildId} destroyed.`);

		return;
	}

	/**
	 *
	 * Connect the player.
	 * @returns {this} The player instance.
	 */
	public connect(): this {
		if (this.connected) return this;

		this.manager.options.sendPayload(this.guildId, {
			op: 4,
			d: {
				guild_id: this.guildId,
				channel_id: this.voiceId,
				self_mute: this.selfMute,
				self_deaf: this.selfDeaf,
			},
		});

		this.manager.emit("debug", `[Player -> Connect] Player ${this.guildId} connected.`);

		return this;
	}

	/**
	 *
	 * Pause the player.
	 * @returns {Promise<this>} The player instance.
	 */
	public async pause(): Promise<this> {
		if (!this.playing) return this;

		await this.shoukaku.setPaused(true);

		this.paused = true;
		this.playing = false;
		this.manager.emit("debug", `[Player -> Pause] Player ${this.guildId} paused.`);

		return this;
	}

	/**
	 *
	 * Resume the player.
	 * @returns Promise<this> The player instance.
	 */
	public async resume(): Promise<this> {
		if (!this.paused) return this;

		await this.shoukaku.setPaused(false);

		this.paused = false;
		this.playing = true;
		this.manager.emit("debug", `[Player -> Resume] Player ${this.guildId} resumed.`);

		return this;
	}

	/**
	 *
	 * Seek to a position in the current track.
	 * @param position The position to seek to.
	 * @returns
	 */
	public async seek(position: number): Promise<this> {
		if (!this.queue.current)
			throw new PlayerError("Player has no current track in it's queue.");
		if (!this.queue.current.info.isSeekable)
			throw new PlayerError("The current track isn't seekable.");

		if (Number.isNaN(position)) throw new PlayerError("Position must be a number.");

		position = Number(position);

		if (position < 0 || position > (this.queue.current.info.length ?? 0))
			position = Math.max(Math.min(position, this.queue.current.info.length ?? 0), 0);

		await this.shoukaku.seekTo(position);

		this.manager.emit(
			"debug",
			`[Player -> Seek] Player ${this.guildId} seeked to ${position}.`,
		);

		return this;
	}

	/**
	 *
	 * Set the text channel id of the player.
	 * @param textId The text channel id.
	 * @returns
	 */
	public setTextChannel(textId: string): this {
		this.textId = textId;
		this.options.textId = textId;
		this.manager.emit(
			"debug",
			`[Player -> TextChannel] Player ${this.guildId} text channel set to ${textId}.`,
		);
		return this;
	}

	/**
	 *
	 * Set the voice channel id of the player.
	 * @param voiceId The voice channel id.
	 * @returns
	 */
	public setVoiceChannel(voiceId: string): this {
		this.voiceId = voiceId;
		this.options.voiceId = voiceId;

		this.manager.options.sendPayload(this.guildId, {
			op: 4,
			d: {
				guild_id: this.guildId,
				channel_id: this.voiceId,
				self_mute: this.selfMute,
				self_deaf: this.selfDeaf,
			},
		});

		this.manager.emit(
			"debug",
			`[Player -> VoiceChannel] Player ${this.guildId} voice channel set to ${voiceId}.`,
		);
		return this;
	}

	/**
	 *
	 * Set the loop mode of the player.
	 * @param loop The loop mode.
	 * @returns {this} The player instance.
	 */
	public setLoop(loop?: LoopMode): this {
		const loopModes: Record<LoopMode, LoopMode> = {
			[LoopMode.Off]: LoopMode.Queue,
			[LoopMode.Queue]: LoopMode.Track,
			[LoopMode.Track]: LoopMode.Off,
		};

		if (loop && !Object.keys(loopModes).includes(loop.toString()))
			throw new PlayerError("Loop mode must be 'off', 'queue' or 'track'.");

		this.loop = loop ?? loopModes[this.loop];

		this.manager.emit(
			"debug",
			`[Player -> Loop] Player ${this.guildId} loop mode set to ${this.loop}.`,
		);
		return this;
	}

	/**
	 *
	 * Set the volume of the player.
	 * @param volume The volume to set.
	 * @returns
	 */
	public async setVolume(volume: number): Promise<this> {
		if (Number.isNaN(volume)) throw new PlayerError("Volume must be a number.");
		if (volume < 0 || volume > 100) throw new PlayerError("Volume must be between 0 and 100.");

		await this.shoukaku.setGlobalVolume(volume);

		this.volume = volume;
		this.manager.emit(
			"debug",
			`[Player -> Volume] Player ${this.guildId} volume set to ${volume}.`,
		);

		return this;
	}

	/**
	 *
	 * Set custom data to the player.
	 * @param key The key of the data.
	 * @param value The value of the data.
	 * @returns {this} The player instance.
	 */
	public set(key: string, value: unknown): this {
		this.data[key] = value;
		return this;
	}

	/**
	 *
	 * Get custom data from the player.
	 * @param key The key of the data.
	 * @returns {T} The value of the data.
	 */
	public get<T>(key: string): T | undefined {
		return this.data[key] as T;
	}

	/**
	 *
	 * Delete custom data from the player.
	 * @param key The key of the data.
	 * @returns
	 */
	public delete(key: string): this {
		delete this.data[key];
		return this;
	}
}
