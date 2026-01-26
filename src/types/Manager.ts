import type { Node } from "../classes/node/Node";
import type { Queue } from "../classes/queue/Queue";
import type { Track, TrackRequester } from "../classes/Track";
import type {
    Exception,
    HoshimiNodeOptions,
    LavalinkPayload,
    LoadType,
    NodeDestroyInfo,
    NodeOptions,
    Playlist,
    PluginInfo,
    Ready,
    SearchQuery,
} from "./Node";
import type { NodelinkEvents, NodelinkSupport } from "./Nodelink";
import type {
    HoshimiPlayerOptions,
    LyricsFoundEvent,
    LyricsLineEvent,
    LyricsNotFoundEvent,
    PlayerJson,
    PlayerUpdate,
    TrackEndEvent,
    TrackExceptionEvent,
    TrackStartEvent,
    TrackStuckEvent,
    WebSocketClosedEvent,
} from "./Player";
import type { HoshimiQueueOptions } from "./Queue";
import type { HoshimiRestOptions, LavalinkPlayer } from "./Rest";
import type { NodeStructure, PlayerStructure } from "./Structures";

/**
 * The search engines to use.
 */
export enum SearchEngines {
    /**
     * Search on YouTube.
     * @description Provided by youtube-source plugin.
     */
    Youtube = "ytsearch",
    /**
     * Search on YouTube Music.
     * @description Provided by youtube-source plugin.
     */
    YoutubeMusic = "ytmsearch",

    /**
     * Search on Spotify.
     * @description Provided by lava-src plugin.
     */
    Spotify = "spsearch",
    /**
     * Search on Spotify recommendations.
     * @description Provided by lava-src plugin.
     */
    SpotifyRecommendations = "sprec",
    /**
     * Search on Spotify artist recommendations.
     * @description Provided by lava-src plugin.
     */
    SpotifyArtistMix = "sprec:mix:artist",
    /**
     * Search on Spotify album recommendations.
     * @description Provided by lava-src plugin.
     */
    SpotifyAlbumMix = "sprec:mix:album",
    /**
     * Search on Spotify track recommendations.
     * @description Provided by lava-src plugin.
     */
    SpotifyTrackMix = "sprec:mix:track",
    /**
     * Search on Spotify using ISRC code.
     * @description Provided by lava-src plugin.
     */
    SpotifyISRCMix = "sprec:mix:isrc",

    /**
     * Search on SoundCloud.
     * @description Provided by lavalink.
     */
    SoundCloud = "scsearch",
    /**
     * Search on Apple Music.
     * @description Provided by lava-src plugin.
     */
    AppleMusic = "amsearch",
    /**
     * Search on Bandcamp.
     * @description Provided by lava-src plugin.
     */
    BandCamp = "bcsearch",

    /**
     * Search on Deezer.
     * @description Provided by lava-src plugin.
     */
    Deezer = "dzsearch",
    /**
     * Search on Deezer using ISRC code.
     * @description Provided by lava-src plugin.
     */
    DeezerISRC = "dzisrc",
    /**
     * Search on Deezer recommendations.
     * @description Provided by lava-src plugin.
     */
    DeezerRecommendations = "dzrec",

    /**
     * Search on Yandex Music.
     * @description Provided by lava-src plugin.
     */
    YandexMusic = "ymsearch",
    /**
     * Search on Yandex Music for recommendations.
     * @description Provided by lava-src plugin.
     */
    YandexMusicRecommendations = "ymrec",

    /**
     * Search on VK Music.
     * @description Provided by lava-src plugin.
     */
    VKMusic = "vksearch",
    /**
     * Search on VK Music for recommendations.
     * @description Provided by lava-src plugin.
     */
    VKMusicRecommendations = "vkrec",

    /**
     * Search on Tidal.
     * @description Provided by lava-src plugin.
     */
    Tidal = "tdsearch",
    /**
     * Search on Tidal for recommendations.
     * @description Provided by lava-src plugin.
     */
    TidalRecommendations = "tdrec",

    /**
     * Search on Qobuz.
     * @description Provided by lava-src plugin.
     */
    Qobuz = "qbsearch",
    /**
     * Search on Qobuz using ISRC code.
     * @description Provided by lava-src plugin.
     */
    QobuzISRC = "qbisrc",
    /**
     * Search on Qobuz for recommendations.
     * @description Provided by lava-src plugin.
     */
    QobuzRecommendations = "qbrec",

    /**
     * Search on JioSaavn.
     * @description Provided by lava-src plugin.
     */
    JioSaavn = "jssearch",
    /**
     * Search on JioSaavn using ISRC code.
     * @description Provided by lava-src plugin.
     */
    JioSaavnRecommendations = "jsrec",

    /**
     * Search on Twitch.
     * @description Provided by lavalink.
     */
    Twitch = "twsearch",
    /**
     * Search on Mixer.
     * @description Provided by lavalink.
     */
    Mixer = "mxsearch",
    /**
     * Search on Vimeo.
     * @description Provided by lavalink.
     */
    Vimeo = "vmsearch",
    /**
     * Play voice using flowery tts.
     */
    FloweryTTS = "ftts",
    /**
     * Play a local file.
     */
    Local = "local",
    /**
     * This is self-explanatory.
     * @description Provided by skybot-lavalink-plugin plugin.
     */
    PornHub = "phsearch",
    /**
     * Play voice using text to speech.
     * @description Provided by skybot-lavalink-plugin plugin.
     */
    TextToSpeech = "speak",
}

/**
 * The debug levels for the manager.
 */
export enum DebugLevels {
    /**
     * Debug level for the manager.
     */
    Manager = 1,
    /**
     * Debug level for the node.
     */
    Node = 2,
    /**
     * Debug level for the player.
     */
    Player = 3,
    /**
     * Debug level for the rest.
     */
    Rest = 4,
    /**
     * Debug level for the queue.
     */
    Queue = 5,
    /**
     * Debug level for testing purposes.
     */
    Test = 6,
}

/**
 * The events for the manager.
 */
export enum EventNames {
    /**
     * Emitted when the manager emits a debug message.
     */
    Debug = "debug",
    /**
     * Emitted when the manager emits an error.
     */
    Error = "error",
    /**
     * Emitted when the node gives a response.
     */
    NodeRaw = "nodeRaw",
    /**
     * Emitted when the node gives an error.
     */
    NodeError = "nodeError",
    /**
     * Emitted when the node is ready.
     */
    NodeReady = "nodeReady",
    /**
     * Emitted when the node is disconnected.
     */
    NodeDisconnect = "nodeDisconnect",
    /**
     * Emitted when the node reconnects.
     */
    NodeReconnecting = "nodeReconnecting",
    /**
     * Emitted when the node is destroyed.
     */
    NodeDestroy = "nodeDestroy",
    /**
     * Emitted when the node is resumed.
     */
    NodeResumed = "nodeResumed",
    /**
     * Emitted when the node is created.
     */
    NodeCreate = "nodeCreate",

    /**
     * Emitted when the player is created.
     */
    PlayerCreate = "playerCreate",
    /**
     * Emitted when the player updates.
     */
    PlayerUpdate = "playerUpdate",
    /**
     * Emitted when the player is destroyed.
     */
    PlayerDestroy = "playerDestroy",
    /**
     * Emitted when the player has an error.
     */
    PlayerError = "playerError",

    /**
     * Emitted when a track starts playing.
     */
    TrackStart = "trackStart",
    /**
     * Emitted when a track ends.
     */
    TrackEnd = "trackEnd",
    /**
     * Emitted when a track is stuck.
     */
    TrackStuck = "trackStuck",
    /**
     * Emitted when a track is errored.
     */
    TrackError = "trackError",

    /**
     * Emitted when lyrics are found.
     */
    LyricsFound = "lyricsFound",
    /**
     * Emitted when lyrics are not found.
     */
    LyricsNotFound = "lyricsNotFound",
    /**
     * Emitted when a line of lyrics is updated.
     */
    LyricsLine = "lyricsLine",

    /**
     * Emitted when the queue ends.
     */
    QueueEnd = "queueEnd",
    /**
     * Emitted when the queue updates.
     */
    QueueUpdate = "queueUpdate",

    /**
     * Emitted when the socket is closed.
     */
    WebSocketClosed = "socketClosed",
}

/**
 * The destroy reasons for the player.
 */
export enum DestroyReasons {
    /**
     * The player was stopped.
     */
    Stop = "Player-Stop",
    /**
     * The player was destroyed by user request.
     */
    Requested = "Player-Requested",
    /**
     * The player was destroyed because the queue was empty.
     */
    Empty = "Player-Empty",
    /**
     * The player was destroyed because the node was disconnected.
     */
    NodeDisconnected = "Player-NodeDisconnected",
    /**
     * The player was destroyed because the node was destroyed.
     */
    NodeDestroy = "Player-NodeDestroy",
    /**
     * The player was destroyed because the voice channel was deleted.
     */
    VoiceChannelDeleted = "Player-VoiceChannelDeleted",
    /**
     * The player was destroyed because it left the voice channel.
     */
    VoiceChannelLeft = "Player-VoiceChannelLeft",
    /**
     * The player was destroyed because it failed to reconnect.
     */
    ReconnectFailed = "Player-ReconnectFailed",
}

/**
 * The client data for the manager.
 */
export interface ClientData extends Record<string | number | symbol, unknown> {
    /**
     * The id of the client.
     * @type {string}
     */
    id: string;
    /**
     * The username of the client.
     * @type {string}
     */
    username?: string;
}

/**
 * Gateway send payload.
 */
export interface GatewaySendPayload {
    /**
     * Payload op code.
     * @type {number}
     */
    op: number;
    /**
     * Payload data.
     * @type {GatewayPayload}
     */
    d: GatewayPayload;
}

/**
 * Gateway payload.
 */
export interface GatewayPayload {
    /**
     * Payload guild id.
     * @type {string}
     */
    guild_id: string;
    /**
     * Payload channel id.
     * @type {string | null}
     */
    channel_id: string | null;
    /**
     * Payload self mute.
     * @type {boolean}
     */
    self_mute: boolean;
    /**
     * Payload self deafen.
     * @type {boolean}
     */
    self_deaf: boolean;
}

/**
 * The options for the manager.
 */
export interface HoshimiOptions {
    /**
     *
     * Send the payload to discord.
     * @param {string} guildId The guild id to send the payload to.
     * @param {GatewaySendPayload} payload The payload to send.
     */
    sendPayload(guildId: string, payload: GatewaySendPayload): Awaitable<void>;
    /**
     * The nodes to use.
     * @type {NodeOptions[]}
     */
    nodes: NodeOptions[];
    /**
     * The client data to use.
     * @type {ClientData}
     */
    client?: Partial<ClientData>;
    /**
     * The default search engine to use.
     * @type {SearchEngines}
     * @default SearchEngines.Youtube
     */
    defaultSearchEngine?: SearchEngines;
    /**
     * The queue options to use.
     * @type {HoshimiQueueOptions}
     */
    queueOptions?: HoshimiQueueOptions;
    /**
     * The node options to use.
     * @type {HoshimiNodeOptions}
     */
    nodeOptions?: HoshimiNodeOptions;
    /**
     * The rest options to use.
     * @type {HoshimiRestOptions}
     */
    restOptions?: HoshimiRestOptions;
    /**
     * The player options to use.
     * @type {HoshimiPlayerOptions}
     */
    playerOptions?: HoshimiPlayerOptions;
}

/**
 * The events for the manager.
 */
export interface HoshimiEvents extends If<NodelinkSupport, NodelinkEvents, object> {
    /**
     * Emitted when the manager emits a debug message.
     * @param {DebugLevels} level The debug level of the message.
     * @param {string} message The message that was emitted.
     */
    debug: [level: DebugLevels, message: string];
    /**
     * Emitted when the manager emits an error.
     * @param {Error | unknown} error The error that was emitted.
     */
    error: [error: Error | unknown];

    /**
     * Emitted when the node gives a response.
     * @param {Node} node The node that emitted the event.
     * @param {LavalinkPayload} message The message that was received.
     */
    nodeRaw: [node: Node, message: LavalinkPayload];
    /**
     * Emitted when the node gives an error.
     * @param {Node} node The node that emitted the event.
     * @param {Error | unknown} error The error that was received.
     */
    nodeError: [node: Node, error: Error | unknown];
    /**
     * Emitted when the node is ready.
     * @param {Node} node The node that emitted the event.
     * @param {number} retries The number of retries after the node was ready.
     * @param {Ready} payload The payload of the event.
     */
    nodeReady: [node: Node, retries: number, payload: Ready];
    /**
     * Emitted when the node is disconnected.
     * @param {Node} node The node that was disconnected.
     */
    nodeDisconnect: [node: Node];
    /**
     * Emitted when the node reconnects.
     * @param {Node} node The node that was reconnected.
     * @param {number} retriesLeft The number of retries left.
     * @param {number} delay The delay before the next retry.
     */
    nodeReconnecting: [node: Node, retriesLeft: number, delay: number];
    /**
     * Emitted when the node is destroyed.
     * @param {Node} node The node that was destroyed.
     * @param {NodeDestroyInfo} options The options for the destroy.
     */
    nodeDestroy: [node: Node, destroy: NodeDestroyInfo];
    /**
     * Emitted when the node is resumed.
     * @param {Node} node The node that was resumed.
     * @param {LavalinkPlayer[]} players The players that were resumed.
     * @param {Ready} payload The payload of the event.
     */
    nodeResumed: [node: Node, players: LavalinkPlayer[], payload: Ready];
    /**
     * Emitted when the node is created.
     * @param {Node} node The node that was created.
     */
    nodeCreate: [node: Node];

    /**
     * Emitted when the player is created.
     * @param {PlayerStructure} player The player that was created.
     */
    playerCreate: [player: PlayerStructure];
    /**
     * Emitted when the player updates.
     * @param {PlayerStructure} newPlayer The new player.
     * @param {PlayerJson} oldPlayer The old player.
     */
    playerUpdate: [newPlayer: PlayerStructure, oldPlayer: PlayerJson, payload: PlayerUpdate];
    /**
     * Emitted when the player is destroyed.
     * @param {PlayerStructure} player The player that was destroyed.
     * @param {string} reason The reason for the destroy.
     */
    playerDestroy: [player: PlayerStructure, reason: string];
    /**
     * Emitted when the player has an error.
     * @param {PlayerStructure} player The player that emitted the event.
     * @param {Error | unknown} error The error that was emitted.
     */
    playerError: [player: PlayerStructure, error: Error | unknown];

    /**
     * Emitted when a track starts playing.
     * @param {PlayerStructure} player The player that emitted the event.
     * @param {Track | null} track The track that was started.
     * @param {TrackStartEvent} payload The payload of the event.
     */
    trackStart: [player: PlayerStructure, track: Track | null, payload: TrackStartEvent];
    /**
     * Emitted when a track ends.
     * @param {PlayerStructure} player The player that emitted the event.
     * @param {Track | null} track The track that ended.
     * @param {TrackEndEvent} payload The payload of the event.
     */
    trackEnd: [player: PlayerStructure, track: Track | null, payload: TrackEndEvent];
    /**
     * Emitted when the track is stuck.
     * @param {PlayerStructure} player The player that emitted the event.
     * @param {Track | null} track The track that was stuck.
     * @param {TrackEndEvent} payload The payload of the event.
     */
    trackStuck: [player: PlayerStructure, track: Track | null, payload: TrackStuckEvent];
    /**
     * Emitted when a track is errored.
     * @param {PlayerStructure} player The player that emitted the event.
     * @param {Track | null} track The track that was errored.
     * @param {TrackEndEvent} payload The payload of the event.
     */
    trackError: [player: PlayerStructure, track: Track | null, payload: TrackExceptionEvent];

    /**
     * Emitted when lyrics are found.
     * @param {PlayerStructure} player The player that emitted the event.
     * @param {Track | null} track The track that was found.
     * @param {LyricsFoundEvent} payload The lyrics that were found.
     */
    lyricsFound: [player: PlayerStructure, track: Track | null, payload: LyricsFoundEvent];
    /**
     * Emitted when lyrics are not found.
     * @param {PlayerStructure} player The player that emitted the event.
     * @param {Track | null} track The track that was not found.
     * @param {LyricsFoundEvent} payload The lyrics that were not found.
     */
    lyricsNotFound: [player: PlayerStructure, track: Track | null, payload: LyricsNotFoundEvent];
    /**
     * Emitted when a line of lyrics is updated.
     * @param {PlayerStructure} player The player that emitted the event.
     * @param {Track | null} track The track that was updated.
     * @param {LyricsFoundEvent} payload The lyrics that were updated.
     */
    lyricsLine: [player: PlayerStructure, track: Track | null, payload: LyricsLineEvent];

    /**
     * Emitted when the queue ends.
     * @param {PlayerStructure} player The player that emitted the event.
     * @param {Queue} queue The queue that ended.
     */
    queueEnd: [player: PlayerStructure, queue: Queue];
    /**
     * Emitted when the queue updates.
     * @param {PlayerStructure} player The player that emitted the event.
     * @param {Queue} queue The queue that updated.
     */
    queueUpdate: [player: PlayerStructure, queue: Queue];

    /**
     * Emitted when the socket is closed.
     * @param {PlayerStructure} player The player that emitted the event.
     * @param {WebSocketClosedEvent} payload The payload of the event.
     */
    socketClosed: [player: PlayerStructure, payload: WebSocketClosedEvent];
}

/**
 * The manager search result.
 */
export interface QueryResult {
    /**
     * The load type of the search result.
     * @type {LoadType}
     */
    loadType: LoadType;
    /**
     * The playlist of the search result.
     * @type {Playlist | null}
     */
    playlist: Playlist | null;
    /**
     * The exception of the search result.
     * @type {Exception | null}
     */
    exception: Exception | null;
    /**
     * The tracks of the search result.
     * @type {Track[]}
     */
    tracks: Track[];
    /**
     * The plugin info of the search result.
     * @type {PluginInfo}
     */
    pluginInfo: PluginInfo | null;
}

/**
 * The query options.
 */
export interface SearchOptions extends SearchQuery {
    /**
     * The requester of the query.
     * @type {TrackRequester}
     */
    requester: TrackRequester;
    /**
     * The node or the node id to make the query.
     * @type {NodeIdentifier}
     */
    node?: NodeIdentifier;
}

/**
 * The channel deleted data packet.
 */
export interface ChannelDelete {
    /**
     * Guild id
     * @type {string}
     */
    guild_id: string;
    /**
     * Channel id
     * @type {string}
     */
    id: string;
}

/**
 * The voice state packet.
 */
export interface VoiceState {
    /**
     * The op code for the voice state.
     * @type {string}
     */
    op: "voiceUpdate";
    /**
     * The guild id of the voice state.
     * @type {string}
     */
    guildId: string;
    /**
     * The voice state event.
     * @type {VoiceServer}
     */
    event: VoiceServer;
    /**
     * The guild id of the voice state.
     * @type {string}
     */
    guild_id: string;
    /**
     * The user id of the voice state.
     * @type {string}
     */
    user_id: string;
    /**
     * The session id of the voice state.
     * @type {string}
     */
    session_id: string;
    /**
     * The channel id of the voice state.
     * @type {string}
     */
    channel_id: string;
    /**
     * The server mute status of the voice state.
     * @type {boolean}
     */
    mute: boolean;
    /**
     * The server deaf status of the voice state.
     * @type {boolean}
     */
    deaf: boolean;
    /**
     * The self mute status of the voice state.
     * @type {boolean}
     */
    self_deaf: boolean;
    /**
     * The self video status of the voice state.
     * @type {boolean}
     */
    self_mute: boolean;
    /**
     * The self video status of the voice state.
     * @type {boolean}
     */
    self_video: boolean;
    /**
     * The self stream status of the voice state.
     * @type {boolean}
     */
    self_stream: boolean;
    /**
     * Whatetever the user is requesting to speak in a stage channel.
     * @type {boolean}
     */
    request_to_speak_timestamp: boolean;
    /**
     * The suppress status of the voice state stage channel.
     * @type {boolean}
     */
    suppress: boolean;
}

/**
 * The voice server packet.
 */
export interface VoiceServer {
    /**
     * The voice server token.
     * @type {string}
     */
    token: string;
    /**
     * The voice server guild id.
     * @type {string}
     */
    guild_id: string;
    /**
     * The voice server endpoint.
     * @type {string}
     */
    endpoint: string;
}

/**
 * The voice packet.
 */
export interface VoicePacket {
    /**
     * The packet type.
     * @type {string}
     */
    t: "VOICE_SERVER_UPDATE" | "VOICE_STATE_UPDATE";
    /**
     * The packet data.
     * @type {VoiceState | VoiceServer}
     */
    d: VoiceState | VoiceServer;
}

/**
 * The channel delete packet.
 */
export interface ChannelDeletePacket {
    /**
     * The packet type
     * @type {string}
     */
    t: "CHANNEL_DELETE";
    /**
     * The packet data.
     * @type {ChannelDelete}
     */
    d: ChannelDelete;
}

/**
 * Make a function awaitable by returning a promise or the value.
 */
export type Awaitable<T> = Promise<T> | T;

/**
 * Create a type that infers the value of a key from an object.
 */
export type Inferable<T, K extends string> = T extends { [key in K]: infer R } ? R : unknown;

/**
 * Create a type that infers the value of a key from an object.
 */
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/**
 * Create a type that can be a rest or an array.
 */
export type RestOrArray<T> = T[] | [T[]];

/**
 * Conditional type to check if T is true, then A, else B or A | null.
 */
export type If<T extends boolean, A, B = null> = T extends true ? A : B extends null ? A | null : B;

/**
 * Make a type required.
 */
export type PickRequired<T, K extends keyof T> = {
    [P in K]-?: T[P];
} & Omit<T, K>;

/**
 * Make a type nullable.
 */
export type PickNullable<T, K extends keyof T> = {
    [P in K]: T[P] | null;
} & Omit<T, K>;

/**
 * Make a type nullable.
 */
export type Nullable<T> = {
    [P in keyof T]: T[P] | null;
};

/**
 * Make a type required.
 */
export type DeepRequired<T> = {
    [P in keyof T]-?: T[P] extends (...args: any[]) => any
        ? T[P]
        : T[P] extends any[]
          ? T[P]
          : T[P] extends object
            ? DeepRequired<T[P]>
            : Required<T[P]>;
};

/**
 * A node identifier can be either a string or a node structure.
 */
export type NodeIdentifier = string | NodeStructure;

/**
 * Custom structures for Hoshimi.
 */
export interface CustomizableStructures {}

/**
 * Customizable options for Hoshimi.
 */
export interface CustomizableOptions {}
