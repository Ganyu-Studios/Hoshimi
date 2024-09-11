import type { Queue, Player, Track } from "../../classes";
import type {
	Exception,
	LoadType,
	Node,
	Playlist,
	TrackEndEvent,
	TrackExceptionEvent,
	TrackStartEvent,
	TrackStuckEvent,
	WebSocketClosedEvent,
	PlayerUpdate,
} from "shoukaku";

/**
 * Manager search engines enum.
 */
export enum SearchEngines {
	Youtube = "ytsearch",
	SoundCloud = "scsearch",
	YoutubeMusic = "ytmsearch",
	Spotify = "spsearch",
	SpotifyRecommendations = "sprec",
}

/**
 * Lavalink node source names.
 */
export enum SourceNames {
	Youtube = "youtube",
	YoutubeMusic = "youtubemusic",
	SoundCloud = "soundcloud",
	Bandcamp = "bandcamp",
	Twitch = "twitch",
	Deezer = "deezer",
	Spotify = "spotify",
	AppleMusic = "applemusic",
	YandexMusic = "yandexmusic",
	FloweryTTS = "flowery-tts",
}

/**
 * Make a function awaitable or not.
 */
export type Awaitable<T> = Promise<T> | T;

/**
 * Gateway send payload.
 */
export type GatewaySendPayload = {
	/**
	 * Payload op code.
	 */
	op: number;
	/**
	 * Payload data.
	 */
	d: {
		/**
		 * Payload guild id.
		 */
		guild_id: string;
		/**
		 * Payload channel id.
		 */
		channel_id: string | null;
		/**
		 * Payload self mute.
		 */
		self_mute: boolean;
		/**
		 * Payload self deafen.
		 */
		self_deaf: boolean;
	};
};

/**
 * Search result object.
 */
export type SearchResult = {
	/**
	 * Load type of the search.
	 */
	loadType: LoadType;
	/**
	 * Tracks of the search.
	 */
	tracks: Track[];
	/**
	 * Playlist of the search.
	 */
	playlist?: Playlist["info"];
	/**
	 * Error of the search.
	 */
	error?: Exception;
};

/**
 * Query options.
 */
export type QueryOptions = {
	/**
	 * Requester to make the search.
	 */
	requester: unknown;
	/**
	 * Engine to make the search.
	 */
	engine?: SearchEngines;
	/**
	 * Node to make the search.
	 */
	node?: Node | string;
};

/**
 * Manager events.
 */
export type ManagerEvents = {
	/**
	 * Player track start event.}
	 * @event Emitted when the player starts playing a track.
	 */
	trackStart: [player: Player, track: Track | null, payload: TrackStartEvent];
	/**
	 * Player track end event.
	 * @event Emitted when the player ends playing a track.
	 */
	trackEnd: [player: Player, track: Track | null, payload: TrackEndEvent];
	/**
	 * Player track stuck event.
	 * @event Emitted when the player stucks on a track.
	 */
	trackStuck: [player: Player, track: Track | null, payload: TrackStuckEvent];
	/**
	 * Player track error event.
	 * @event Emitted when the player encounters an error while playing a track.
	 */
	trackError: [player: Player, track: Track | null, payload: TrackExceptionEvent];

	/**
	 * Player queue end / empty event.
	 * @event Emitted when the player queue ends or is empty.
	 */
	queueEnd: [player: Player, queue: Queue];
	/**
	 * Player queue update event.
	 * @event Emitted when the player queue is updated.
	 */
	queueUpdate: [queue: Queue];

	/**
	 * Player create event.
	 * @event Emitted when a new player is created.
	 */
	playerCreate: [player: Player];
	/**
	 * Player update event.
	 * @event Emitted when a player updates.
	 */
	playerUpdate: [player: PlayerUpdate];
	/**
	 * Player resumed event.
	 * @event Emitted when a player resumes.
	 */
	playerResumed: [player: Player];
	/**
	 * Player destroy event.
	 * @event Emitted when a player is destroyed.
	 */
	playerDestroy: [player: Player, reason: string];

	/**
	 * Manager debug event.
	 * @event Emitted when the manager emits a debug message. (self explanatory)
	 */
	debug: [message: string];
	/**
	 * Manager socket closed event.
	 * @event Emitted when the lavalink node closes the websocket.
	 */
	socketClosed: [payload: WebSocketClosedEvent];
};

/**
 * Manager options.
 */
export type ManagerOptions = {
	/**
	 *
	 * Send payload function.
	 * @param guildId The guild id.
	 * @param payload The payload to send.
	 * @returns
	 */
	sendPayload: (guildId: string, payload: GatewaySendPayload) => Awaitable<void>;
	/**
	 *
	 * Autoplay function.
	 * @param player The player instance.
	 * @param lastTrack The last track.
	 * @returns
	 */
	autoplayFn?: (player: Player, lastTrack: Track | null) => Awaitable<void>;
	/**
	 * Default manager search engine.
	 */
	defaultSearchEngine?: SearchEngines;
	/**
	 * Max previous tracks amount.
	 * @default 25
	 */
	maxPreviousTracks?: number;
};
