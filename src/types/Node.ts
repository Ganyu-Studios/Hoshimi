import type { TrackUserData } from "../classes/Track";
import type { FilterType } from "./Filters";
import type { Hint, PickRequired, Prettify, SearchSource } from "./Manager";
import type {
    LyricsFoundEvent,
    LyricsLineEvent,
    LyricsNotFoundEvent,
    PlayerUpdate,
    TrackEndEvent,
    TrackExceptionEvent,
    TrackStartEvent,
    TrackStuckEvent,
    WebSocketClosedEvent,
} from "./Player";
import type { CustomizableSources } from "./Sources";

/**
 * The states.
 */
export enum State {
    /**
     * The node is connecting.
     */
    Connecting = 1,
    /**
     * The node is connected.
     */
    Connected = 2,
    /**
     * The node is disconnected.
     */
    Disconnected = 3,
    /**
     * The node is reconnecting.
     */
    Reconnecting = 4,
    /**
     * The node is reconnected.
     */
    Reconnected = 5,
    /**
     * The node is destroyed.
     */
    Destroyed = 6,
    /**
     * The node is idle.
     */
    Idle = 7,
}

/**
 * The op codes for the node.
 */
export enum OpCodes {
    /**
     * The op code for the ready event for the node.
     */
    Ready = "ready",
    /**
     * The op code for the player update event for the node.
     */
    PlayerUpdate = "playerUpdate",
    /**
     * The op code for the stats event for the node.
     */
    Stats = "stats",
    /**
     * The op code for the event event for the node.
     */
    Event = "event",
}

/**
 * The load types for the result.
 */
export enum LoadType {
    /**
     * The load type for the track.
     */
    Track = "track",
    /**
     * The load type for the playlist.
     */
    Playlist = "playlist",
    /**
     * The load type for the search.
     */
    Search = "search",
    /**
     * The load type for the empty.
     */
    Empty = "empty",
    /**
     * The load type for the error.
     */
    Error = "error",
}

/**
 * The sources available for the result.
 */
export enum SourceNames {
    /**
     * The lavalink built-in source name for Youtube.
     * @description Provided by lavalink
     */
    Youtube = "youtube",
    /**
     * The lavalink built-in source name for Youtube Music.
     * @description Provided by lavalink
     */
    YoutubeMusic = "youtubemusic",
    /**
     * The lavalink built-in source name for Soundcloud.
     * @description Provided by lavalink
     */
    Soundcloud = "soundcloud",
    /**
     * The lavalink built-in source name for Bandcamp.
     * @description Provided by lavalink
     */
    Bandcamp = "bandcamp",
    /**
     * The lavalink built-in source name for Twitch.
     * @description Provided by lavalink
     */
    Twitch = "twitch",
    /**
     * The lavalink built-in source name for Vimeo.
     * @description Provided by lavalink
     */
    Vimeo = "vimeo",
    /**
     * The lavalink built-in source name for Mixer.
     * @description Provided by lavalink
     */
    Mixer = "mixer",

    /**
     * The lavasrc built-in source name for Spotify.
     * @description Provided by lavasrc
     */
    Spotify = "spotify",
    /**
     * The lavasrc built-in source name for Deezer.
     * @description Provided by lavasrc
     */
    Deezer = "deezer",
    /**
     * The lavasrc built-in source name for VK Music.
     * @description Provided by lavasrc
     */
    VKMusic = "vkmusic",
    /**
     * The lavasrc built-in source name for Tidal.
     * @description Provided by lavasrc
     */
    Tidal = "tidal",
    /**
     * The lavasrc built-in source name for JioSaavn.
     * @description Provided by lavasrc
     */
    JioSaavn = "jiosaavn",
    /**
     * The lavasrc built-in source name for Apple Music.
     * @description Provided by lavasrc
     */
    AppleMusic = "applemusic",
    /**
     * The lavasrc built-in source name for Yandex Music.
     * @description Provided by lavasrc
     */
    YandexMusic = "yandexmusic",
    /**
     * The lavasrc built-in source name for Flowery TTS.
     * @description Provided by lavasrc
     */
    FloweryTTS = "flowery-tts",
    /**
     * The http source name.
     * @description Generic HTTP source
     */
    HTTP = "http",
    /**
     * This is self-explanatory too.
     * @description Provided by skybot-lavalink-plugin.
     */
    PornHub = "pornhub",
    /**
     * Play voice using text to speech.
     * @description Provided by skybot-lavalink-plugin.
     */
    TextToSpeech = "tts",
    /**
     * Play voice using text to speech.
     * @description Provided by skybot-lavalink-plugin.
     */
    Clypit = "clypit",
    /**
     * Play voice using text to speech.
     * @description Provided by skybot-lavalink-plugin.
     */
    StreamDeckAudio = "StreamDeckAudio",
    /**
     * Play voice using text to speech.
     * @description Provided by skybot-lavalink-plugin.
     */
    GetYarn = "getyarn.io",
    /**
     * Play voice using text to speech.
     * @description Provided by skybot-lavalink-plugin.
     */
    MixCloud = "mixcloud",
    /**
     * Play voice using text to speech.
     * @description Provided by skybot-lavalink-plugin.
     */
    OCRemix = "ocremix",
    /**
     * Play voice using text to speech.
     * @description Provided by skybot-lavalink-plugin.
     */
    PixelDrain = "pixeldrain",
    /**
     * Play voice using text to speech.
     * @description Provided by skybot-lavalink-plugin.
     */
    Reddit = "reddit",
    /**
     * Play voice using text to speech.
     * @description Provided by skybot-lavalink-plugin.
     */
    SoundGasm = "soundgasm",
    /**
     * Play voice using text to speech.
     * @description Provided by skybot-lavalink-plugin.
     */
    TikTok = "tiktok",
}

/**
 * Source name type supporting built-ins plus custom augmented values.
 */
export type SourceName = SourceNames | CustomizableSources[keyof CustomizableSources];

/**
 * The response severity of the result.
 */
export enum Severity {
    /**
     * The severity of the result is common.
     */
    Common = "common",
    /**
     * The severity of the result is suspicious.
     */
    Suspicious = "suspicious",
    /**
     * The severity of the result is fault.
     */
    Fault = "fault",
}

/**
 * The plugin information type.
 */
export enum PluginInfoType {
    /**
     * The plugin information type is album.
     */
    Album = "album",
    /**
     * The plugin information type is track.
     */
    Playlist = "playlist",
    /**
     * The plugin information type is track.
     */
    Artist = "artist",
    /**
     * The plugin information type is track.
     */
    Recommendations = "recommendations",
}

/**
 * The node destroy reason.
 */
export enum NodeDestroyReasons {
    /**
     * The node is being destroyed by the user or the library.
     */
    Destroy = "Node-Destroy",
    /**
     * The node is missing the session id.
     */
    MissingSession = "Missing-Session",
}

/**
 * The websocket close codes.
 */
export enum WebsocketCloseCodes {
    /**
     * The websocket close code for normal closure.
     */
    NormalClosure = 1000,
    /**
     * The websocket close code for going away.
     */
    GoingAway = 1001,
    /**
     * The websocket close code for protocol error.
     */
    ProtocolError = 1002,
    /**
     * The websocket close code for unsupported data.
     */
    UnsupportedData = 1003,
    /**
     * The websocket close code for no status received.
     */
    NoStatusReceived = 1005,
    /**
     * The websocket close code for abnormal closure.
     */
    AbnormalClosure = 1006,
    /**
     * The websocket close code for invalid frame payload data.
     */
    InvalidFramePayloadData = 1007,
    /**
     * The websocket close code for policy violation.
     */
    PolicyViolation = 1008,
    /**
     * The websocket close code for message too big.
     */
    MessageTooBig = 1009,
    /**
     * The websocket close code for mandatory extension.
     */
    MandatoryExtension = 1010,
    /**
     * The websocket close code for internal error.
     */
    InternalError = 1011,
    /**
     * The websocket close code for service restart.
     */
    ServiceRestart = 1012,
    /**
     * The websocket close code for try again later.
     */
    TryAgainLater = 1013,
    /**
     * The websocket close code for bad gateway.
     */
    BadGateway = 1014,
    /**
     * The websocket close code for TLS handshake failure.
     */
    TLSHandshakeFailure = 1015,
    /**
     * The websocket close code for unauthorized.
     */
    Unauthorized = 3000,
    /**
     * The websocket close code for forbidden.
     */
    Forbidden = 3003,
    /**
     * The websocket close code for timeout.
     */
    Timeout = 3008,
}

/**
 * The plugin names.
 */
export enum PluginNames {
    /**
     * The lavasrc plugin name.
     * @author topi314
     */
    LavaSrc = "lavasrc-plugin",
    /**
     * The java lyrics plugin name.
     * @author duncte123
     */
    JavaLyrics = "java-lyrics-plugin",
    /**
     * The lava lyrics plugin name.
     * @author topi314
     */
    LavaLyrics = "lavalyrics-plugin",
    /**
     * The lavasearch plugin name.
     * @author topi314
     */
    LavaSearch = "lavasearch-plugin",
    /**
     * The sponsorblock plugin name.
     * @author topi314
     */
    SponsorBlock = "sponsorblock-plugin",
    /**
     * The lavadspx plugin name.
     * @author devoxin
     */
    LavaDspx = "lavadspx-plugin",
    /**
     * The youtube source plugin name.
     * @author topi314, devoxin, and more...
     */
    Youtube = "youtube-plugin",
    /**
     * The sky bot plugin name.
     * @author duncte123
     */
    Skybot = "skybot-lavalink-plugin",
    /**
     * The lava xm plugin name
     * @author esmBot
     */
    LavaXm = "lava-xm-plugin",
    /**
     * The jiosaavn plugin name.
     * @author appujet
     */
    Jiosaavn = "jiosaavn-plugin",
    /**
     * The lavalink filter plugin name.
     * @author ???
     */
    FilterPlugin = "lavalink-filter-plugin",
}

/**
 * The node sort types.
 */
export enum NodeSortTypes {
    /**
     * Sort by memory usage.
     * @type {string}
     */
    Memory = "memory",
    /**
     * Sort by cpu usage.
     * @type {string}
     */
    Cpu = "cpu",
    /**
     * Sort by player count.
     * @type {string}
     */
    Players = "players",
    /**
     * Sort by playing player count.
     * @type {string}
     */
    PlayingPlayers = "playingPlayers",
    /**
     * Sort by system load.
     * @type {string}
     */
    SystemLoad = "systemLoad",
    /**
     * Sort by lavalink load.
     * @type {string}
     */
    LavalinkLoad = "lavalinkLoad",
    /**
     * Sort by penalties.
     * @type {string}
     */
    Penalties = "penalties",
}

/**
 * The track result.
 */
interface TrackResult {
    /**
     * The load type of the result.
     * @type {LoadType.Track}
     */
    loadType: LoadType.Track;
    /**
     * The track data of the result.
     * @type {LavalinkTrack}
     */
    data: LavalinkTrack;
}

/**
 * The playlist result.
 */
interface PlaylistResult {
    /**
     * The load type of the result.
     * @type {LoadType.Playlist}
     */
    loadType: LoadType.Playlist;
    /**
     * The playlist data of the result.
     * @type {Playlist}
     */
    data: Playlist;
}

/**
 * The search result.
 */
interface SearchResult {
    /**
     * The load type of the result.
     * @type {LoadType.Search}
     */
    loadType: LoadType.Search;
    /**
     * The search data of the result.
     * @type {LavalinkTrack[]}
     */
    data: LavalinkTrack[];
}

/**
 * The empty result.
 */
interface EmptyResult {
    /**
     * The load type of the result.
     * @type {LoadType.Empty}
     */
    loadType: LoadType.Empty;
    /**
     * The empty data of the result.
     * @type {Record<string, string>}
     */
    data: Record<string, string>;
}

/**
 * The error result.
 */
interface ErrorResult {
    /**
     * The load type of the result.
     * @type {LoadType.Error}
     */
    loadType: LoadType.Error;
    /**
     * The error data of the result.
     * @type {Exception}
     */
    data: Exception;
}

/**
 * The exception of the result.
 */
export interface Exception {
    /**
     * The message of the exception.
     * @type {string}
     */
    message: string;
    /**
     * The severity of the exception.
     * @type {Severity}
     */
    severity: Severity;
    /**
     * The cause of the exception.
     * @type {string}
     */
    cause: string;
    /**
     * The cause stack trace of the exception.
     * @type {string}
     */
    causeStackTrace: string;
}

/**
 * The track.
 */
export interface LavalinkTrack {
    /**
     * The base64 encoded track.
     * @type {string}
     */
    encoded: string;
    /**
     * The plugin information of the track.
     * @type {PluginInfo}
     */
    pluginInfo: PluginInfo;
    /**
     * The track information.
     * @type {TrackInfo}
     */
    info: TrackInfo;
    /**
     * The user data of the track.
     * @type {TrackUserData | undefined}
     */
    userData?: TrackUserData;
}

export interface UnresolvedLavalinkTrack {
    /**
     * The base64 encoded track.
     * @type {string | undefined}
     */
    encoded?: string;
    /**
     * The track information.
     * @type {UnresolvedTrackInfo}
     */
    info: UnresolvedTrackInfo;
    /**
     * The plugin information of the track.
     * @type {Partial<PluginInfo>}
     */
    pluginInfo?: Partial<PluginInfo>;
    /**
     * The user data of the track.
     * @type {TrackUserData | undefined}
     */
    userData?: TrackUserData;
}

/**
 * The track information.
 */
export interface TrackInfo {
    /**
     * The Identifier of the Track.
     * @type {string}
     */
    identifier: string;
    /**
     * The track title
     * @type {string}
     */
    title: string;
    /**
     * The track author..
     * @type {string}
     */
    author: string;
    /**
     * The duration of the Track.
     * @type {number}
     */
    length: number;
    /**
     * The URL of the artwork if available.
     * @type {string | null}
     */
    artworkUrl: string | null;
    /**
     * The URL of the track.
     * @type {string}
     */
    uri: string;
    /**
     * The source name of the track.
     * @type {SourceName}
     */
    sourceName: SourceName;
    /**
     * Whether the track is seekable.
     * @type {boolean}
     */
    isSeekable: boolean;
    /**
     * Whether the track is a stream.
     * @type {boolean}
     */
    isStream: boolean;
    /**
     * If ISRC code is available, it's provided.
     * @type {string | null}
     */
    isrc: string | null;
    /**
     * The position of the track.
     * @type {number}
     */
    position: number;
}

/**
 * The plugin information.
 */
export interface PluginInfo {
    /**
     * The Type provided by a plugin.
     * @type {PluginInfoType | undefined}
     */
    type?: PluginInfoType;
    /**
     * The Identifier provided by a plugin.
     * @type {string | undefined}
     */
    albumName?: string;
    /**
     * The URL of the album.
     * @type {string | undefined}
     */
    albumUrl?: string;
    /**
     * The URL of the album art.
     * @type {string | undefined}
     */
    albumArtUrl?: string;
    /**
     * The URL of the artist.
     * @type {string | undefined}
     */
    artistUrl?: string;
    /**
     * The URL of the artist artwork.
     * @type {string | undefined}
     */
    artistArtworkUrl?: string;
    /**
     * The URL of the preview.
     * @type {string | undefined}
     */
    previewUrl?: string;
    /**
     * Whether the track is a preview.
     * @type {boolean | undefined}
     */
    isPreview?: boolean;
    /**
     * The total number of tracks in the playlist.
     * @type {number | undefined}
     */
    totalTracks?: number;
    /**
     * The Identifier provided by a plugin.
     * @type {string | undefined}
     */
    identifier?: string;
    /**
     * The Artwork URL provided by a plugin.
     * @type {string | undefined}
     */
    artworkUrl?: string;
    /**
     * The Author Information provided by a plugin.
     * @type {string | undefined}
     */
    author?: string;
    /**
     * The URL provided by a plugin.
     * @type {string | undefined}
     */
    url?: string;
}

/**
 * The playlist information.
 */
export interface Playlist {
    /**
     * The plugin information of the playlist.
     * @type {PluginInfo}
     */
    pluginInfo: PluginInfo;
    /**
     * The tracks in the playlist.
     * @type {LavalinkTrack[]}
     */
    tracks: LavalinkTrack[];
    /**
     * The information of the playlist.
     * @type {PlaylistInfo}
     */
    info: PlaylistInfo;
}

export interface PlaylistInfo {
    /**
     * The name of the playlist.
     * @type {string}
     */
    name: string;
    /**
     * The selected track in the playlist.
     * @type {number}
     */
    selectedTrack: number;
}

/**
 * The ready event for the node.
 */
export interface Ready {
    /**
     * The op code for the event.
     * @type {OpCodes.Ready}
     */
    op: OpCodes.Ready;
    /**
     * Return if the node is resumed.
     * @type {boolean}
     */
    resumed: boolean;
    /**
     * Return the session id of the node.
     * @type {string}
     */
    sessionId: string;
}

/**
 * The node memory information.
 */
export interface NodeMemory {
    /**
     * The total memory of the node.
     * @type {number}
     */
    reservable: number;
    /**
     * The used memory of the node.
     * @type {number}
     */
    used: number;
    /**
     * The free memory of the node.
     * @type {number}
     */
    free: number;
    /**
     * The allocated memory of the node.
     * @type {number}
     */
    allocated: number;
}

/**
 * The node frame stats.
 */
export interface NodeFrameStats {
    /**
     * The amount of frames sent.
     * @type {number}
     */
    sent: number;
    /**
     * The amount of frames sent between frames and the expected amount of frames.
     * @type {number}
     */
    deficit: number;
    /**
     * The amount of frames nulled.
     * @type {number}
     */
    nulled: number;
}

/**
 * The node cpu information.
 */
export interface NodeCpu {
    /**
     * The amount of cores of the node.
     * @type {number}
     */
    cores: number;
    /**
     * The system load of the node.
     * @type {number}
     */
    systemLoad: number;
    /**
     * The lavalink load of the node.
     * @type {number}
     */
    lavalinkLoad: number;
}

/**
 * The stats event for the node.
 */
export interface Stats {
    /**
     * The op code for the event.
     * @type {OpCodes.Stats}
     */
    op: OpCodes.Stats;
    /**
     * The amount of players on the node.
     * @type {number}
     */
    players: number;
    /**
     * The amount of playing players on the node.
     * @type {number}
     */
    playingPlayers: number;
    /**
     * The memory stats of the node.
     * @type {NodeMemory}
     */
    memory: NodeMemory;
    /**
     * The frame stats of the node.
     * @type {NodeFrameStats | null}
     */
    frameStats: NodeFrameStats | null;
    /**
     * The cpu stats of the node.
     * @type {NodeCpu}
     */
    cpu: NodeCpu;
    /**
     * The amount of uptime of the node.
     * @type {number}
     */
    uptime: number;
}

/**
 * The information of the node version.
 */
export interface NodeInfoVersion {
    /**
     * The version of the node.
     * @type {string}
     */
    semver: string;
    /**
     * The major version of the node.
     * @type {number}
     */
    major: number;
    /**
     * The minor version of the node.
     * @type {number}
     */
    minor: number;
    /**
     * The patch version of the node.
     * @type {number}
     */
    patch: number;
    /**
     * The pre-release version of the node.
     * @type {string | undefined}
     */
    preRelease?: string;
    /**
     * The build version of the node.
     * @type {string | undefined}
     */
    build?: string;
}

/**
 * The git information of the node.
 */
export interface NodeInfoGit {
    /**
     * The branch of the node.
     * @type {string}
     */
    branch: string;
    /**
     * The commit of the node.
     * @type {string}
     */
    commit: string;
    /**
     * The commit time of the node.
     * @type {number}
     */
    commitTime: number;
}

/**
 * The plugin information of the node.
 */
export interface NodeInfoPlugin {
    /**
     * The name of the plugin.
     * @type {PluginNames}
     */
    name: PluginNames;
    /**
     * The version of the plugin.
     * @type {string}
     */
    version: string;
}

/**
 * The information of the node.
 */
export interface NodeInfo {
    /**
     * The version of the node.
     * @type {NodeInfoVersion}
     */
    version: NodeInfoVersion;
    /**
     * The build time of the node.
     * @type {number}
     */
    buildTime: number;
    /**
     * The git information of the node.
     * @type {NodeInfoGit}
     */
    git: NodeInfoGit;
    /**
     * The build java version of the node.
     * @type {string}
     */
    jvm: string;
    /**
     * The lavaplayer version of the node.
     * @type {string}
     */
    lavaplayer: string;
    /**
     * The source managers available in the node.
     * @type {SourceName[]}
     */
    sourceManagers: SourceName[];
    /**
     * The filters available in the node.
     * @type {FilterType[]}
     */
    filters: FilterType[];
    /**
     * The plugins installed in the node.
     * @type {NodeInfoPlugin[]}
     */
    plugins: NodeInfoPlugin[];
    /**
     * Whether the node is a Nodelink instance.
     * @type {boolean
     */
    isNodelink: boolean;
}

/**
 * The node options.
 */
export interface NodeOptions {
    /**
     * The node host.
     * @type {string}
     */
    host: string;
    /**
     * The node port.
     * @type {number}
     */
    port: number;
    /**
     * The node password.
     * @type {string}
     */
    password: string;
    /**
     * The node id.
     * @type {string}
     */
    id?: string;
    /**
     * Enable if the node is secure.
     * @type {boolean}
     * @default false
     */
    secure?: boolean;
    /**
     * The timeout for the REST in milliseconds.
     * @type {number}
     * @default 10000
     */
    restTimeout?: number;
    /**
     * The amount of retries to reconnect.
     * @type {number}
     * @default 5
     */
    retryAmount?: number;
    /**
     * The delay between retries in milliseconds.
     * @type {number}
     * @default 20000
     */
    retryDelay?: number;
    /**
     * The session id of the node.
     * @type {string}
     */
    sessionId?: string;
}

/**
 * The headers for resumable requests.
 */
export interface ResumableHeaders {
    /**
     * The name of the client.
     * @type {string}
     */
    "Client-Name": string;
    /**
     * The user agent of the client.
     * @type {string}
     */
    "User-Agent": string;
    /**
     * The user id of the client.
     * @type {string}
     */
    "User-Id": string;
    /**
     * The session id of the client.
     * @type {string | undefined}
     */
    "Session-Id"?: string;
    /**
     * The authorization of the client.
     * @type {string}
     */
    Authorization: string;
}

/**
 * The search query to use.
 */
export interface SearchQuery {
    /**
     * The query to search for.
     * @type {string}
     */
    query: string;
    /**
     * The search source to use.
     * @type {SearchSource | SourceName | undefined}
     */
    source?: SearchSource | SourceName;
    /**
     * The search params to use.
     * @type {Record<string, string> | undefined}
     */
    params?: Record<string, string>;
}

/**
 * The manager node options.
 */
export interface HoshimiNodeOptions {
    /**
     * The user agent for the requests.
     * @type {UserAgent}
     * @example `hoshimi/v${string} (${string})`
     */
    userAgent?: UserAgent;
    /**
     * Make the node resumable.
     * @type {boolean}
     * @default false
     */
    resumable?: boolean;
    /**
     * Hoshimi will try to resume the players in the node if it's possible.
     * @type {boolean}
     * @default false
     */
    resumeByLibrary?: boolean;
    /**
     * The timeout for resuming the session in seconds.
     * @type {number}
     * @default 60
     */
    resumeTimeout?: number;
}

/**
 * The interface of the node destroy object.
 */
export interface NodeDestroyInfo {
    /**
     * The code for the destroy.
     * @type {WebsocketCloseCodes | undefined | number}
     */
    code?: WebsocketCloseCodes | number;
    /**
     * The reason for the destroy.
     * @type {NodeDestroyReasons | undefined | string}
     */
    reason?: NodeDestroyReasons | string;
}

/**
 * The interface of the node lyrics result.
 */
export interface LyricsResult {
    /**
     * The source name of the lyric result.
     * @type {string}
     */
    sourceName: string;
    /**
     * The provider name of the lyric result.
     * @type {string}
     */
    provider: string;
    /**
     * The lyrics text of the result.
     * @type {string | null}
     */
    text: string | null;
    /**
     * The lyrics lines of the result.
     * @type {LyricsLine[]}
     */
    lines: LyricsLine[];
    /**
     * The plugin information of the result.
     * @type {PluginInfo}
     */
    plugin: PluginInfo;
}

/**
 * The interface of the node lyrics line.
 */
export interface LyricsLine {
    /**
     * The line start time in milliseconds of the lyric line.
     * @type {number}
     */
    timestamp: number;
    /**
     * The line duration in milliseconds of the lyric line.
     * @type {number | null}
     */
    duration: number | null;
    /**
     * The line text of the lyric line.
     * @type {string}
     */
    line: string;
    /**
     * The plugin information of the lyric line.
     * @type {PluginInfo}
     */
    plugin: PluginInfo;
}

/**
 * The interface of the node json object.
 */
export interface NodeJson {
    /**
     * The node id.
     * @type {string}
     */
    id: string;
    /**
     * The node session id.
     * @type {string | null}
     */
    sessionId: string | null;
    /**
     * The node options.
     * @type {NodeOptions}
     */
    options: NodeOptions;
}

/**
 * The type for the unresolved track info.
 */
export type UnresolvedTrackInfo = Prettify<PickRequired<Partial<TrackInfo>, "title">>;

/**
 * The type of the node disconnect object.
 */
export type NodeDisconnectInfo = NodeDestroyInfo;

/**
 * The type of the user agent for the requests.
 */
export type UserAgent = Hint<`${string}/v${string} (${string})`>;

/**
 * The type of the payload for the socket.
 */
export type LavalinkEventPayload =
    | Ready
    | Stats
    | PlayerUpdate
    | TrackStartEvent
    | TrackEndEvent
    | TrackStuckEvent
    | TrackExceptionEvent
    | LyricsFoundEvent
    | LyricsNotFoundEvent
    | LyricsLineEvent
    | WebSocketClosedEvent;

/**
 * The response of the result.
 */
export type LavalinkSearchResponse = TrackResult | PlaylistResult | SearchResult | EmptyResult | ErrorResult;
