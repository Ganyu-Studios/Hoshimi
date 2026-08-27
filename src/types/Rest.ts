import type { TrackRequester } from "../classes/Track";
import type { FilterSettings } from "./Filters";
import type { PickNullable } from "./Manager";
import type { LavalinkTrack } from "./Node";
import type { LavalinkPlayerVoice, LavalinkPlayOptions } from "./Player";
import type { TrackStructure } from "./Structures";

/**
 * The methods for http requests
 */
export enum HttpMethods {
    /**
     * The GET method requests a representation of the specified resource. Requests using GET should only retrieve data.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET
     * @type {string}
     */
    Get = "GET",
    /**
     * The POST method is used to submit an entity to the specified resource, often causing a change in state or side effects on the server.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST
     * @type {string}
     */
    Post = "POST",
    /**
     * The PUT method replaces all current representations of the target resource with the request payload.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT
     * @type {string}
     */
    Put = "PUT",
    /**
     * The PATCH method is used to apply partial modifications to a resource.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH
     * @type {string}
     */
    Patch = "PATCH",
    /**
     * The DELETE method deletes the specified resource.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE
     * @type {string}
     */
    Delete = "DELETE",
    /**
     * The HEAD method asks for a response identical to that of a GET request, but without the response body.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD
     * @type {string}
     */
    Head = "HEAD",
}

export enum RestPathType {
    /**
     * The raw path of the request.
     * @type {string}
     */
    Raw = "/",
    /**
     * The versioned path v4 of the request.
     * @type {string}
     */
    V4 = "/v4",
}

/**
 * The status codes for the REST.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
 */
export enum HttpStatusCodes {
    /**
     * The request has succeeded.
     * @type {number}
     */
    OK = 200,
    /**
     * The request has been fulfilled and resulted in a new resource being created.
     * @type {number}
     */
    Created = 201,
    /**
     * The request has been accepted for processing, but the processing has not been completed.
     * @type {number}
     */
    Accepted = 202,
    /**
     * The server successfully processed the request, but is not returning any content.
     * @type {number}
     */
    NoContent = 204,
    /**
     * The resource has been moved permanently to a new URI.
     * @type {number}
     */
    MovedPermanently = 301,
    /**
     * The requested resource has been found at a different URI.
     * @type {number}
     */
    Found = 302,
    /**
     * The resource has not been modified since the last request.
     * @type {number}
     */
    NotModified = 304,
    /**
     * The request cannot be processed due to bad syntax.
     * @type {number}
     */
    BadRequest = 400,
    /**
     * The request requires user authentication.
     * @type {number}
     */
    Unauthorized = 401,
    /**
     * The request was valid, but the server is refusing action.
     * @type {number}
     */
    Forbidden = 403,
    /**
     * The server cannot find the requested resource.
     * @type {number}
     */
    NotFound = 404,
    /**
     * The request method is known by the server but has been disabled and cannot be used.
     * @type {number}
     */
    MethodNotAllowed = 405,
    /**
     * The server timed out waiting for the request.
     * @type {number}
     */
    RequestTimeout = 408,
    /**
     * The request could not be completed due to a conflict with the current state of the resource.
     * @type {number}
     */
    Conflict = 409,
    /**
     * The requested resource is no longer available and will not be available again.
     * @type {number}
     */
    Gone = 410,
    /**
     * The user has sent too many requests in a given amount of time.
     * @type {number}
     */
    TooManyRequests = 429,
    /**
     * A generic error message, given when no more specific message is suitable.
     * @type {number}
     */
    InternalServerError = 500,
    /**
     * The server does not recognize the request method or lacks the ability to fulfill it.
     * @type {number}
     */
    NotImplemented = 501,
    /**
     * The server was acting as a gateway and received an invalid response.
     * @type {number}
     */
    BadGateway = 502,
    /**
     * The server is currently unavailable (overloaded or down).
     * @type {number}
     */
    ServiceUnavailable = 503,
    /**
     * The server did not receive a timely response from an upstream server.
     * @type {number}
     */
    GatewayTimeout = 504,
}

/**
 * The REST routes.
 */
export const RestRoutes = {
    /**
     *
     * Get the updated player endpoint.
     * @param {string} sessionId The session id of the node.
     * @param {string} guildId The guild id of the player.
     * @returns {RestEndpoint} The endpoint for updating the player.
     */
    UpdatePlayer(sessionId: string, guildId: string) {
        return `/sessions/${sessionId}/players/${guildId}` as const;
    },
    /**
     *
     * Get the update session endpoint.
     * @param {string} sessionId The session id of the node.
     * @returns {RestEndpoint} The endpoint for updating the session.
     */
    UpdateSession(sessionId: string) {
        return `/sessions/${sessionId}` as const;
    },
    /**
     *
     * Get the get players endpoint.
     * @param {string} sessionId The session id of the node.
     * @returns {RestEndpoint} The endpoint for getting the players.
     */
    GetPlayers(sessionId: string) {
        return `/sessions/${sessionId}/players` as const;
    },
    /**
     *
     * Get the current lyrics endpoint.
     * @param {string} sessionId The session id of the node.
     * @param {string} guildId The guild id of the player.
     * @returns {RestEndpoint} The endpoint for getting the current lyrics.
     */
    CurrentLyrics(sessionId: string, guildId: string) {
        return `/sessions/${sessionId}/players/${guildId}/track/lyrics` as const;
    },
    /**
     *
     * Subscribe to lyrics endpoint.
     * @param {string} sessionId The session id of the node.
     * @param {string} guildId The guild id of the player.
     * @returns {RestEndpoint} The endpoint for subscribing to lyrics.
     */
    SubscribeLyrics(sessionId: string, guildId: string) {
        return `/sessions/${sessionId}/players/${guildId}/lyrics/subscribe` as const;
    },
    /**
     * Get the lyrics endpoint.
     * @type {RestEndpoint}
     */
    GetLyrics: "/lyrics" as const,
    /**
     * Get the decode track endpoint.
     * @type {RestEndpoint}
     */
    DecodeTrack: "/decodetrack" as const,
    /**
     * Get the decode tracks endpoint.
     * @type {RestEndpoint}
     */
    DecodeTracks: "/decodetracks" as const,
    /**
     * Get the load tracks endpoint.
     * @type {RestEndpoint}
     */
    LoadTracks: "/loadtracks" as const,
    /**
     * Get the node info endpoint.
     * @type {RestEndpoint}
     */
    NodeInfo: "/info" as const,

    /**
     * Get the load lyrics endpoint.
     * @type {RestEndpoint}
     * @description Used in NodelinkLyricsManager, only for nodelink nodes.
     */
    LoadLyrics: "/loadlyrics" as const,
    /**
     * Get the connection endpoint.
     * @type {RestEndpoint}
     * @description Used for checking the connection status of the node, only for nodelink nodes.
     */
    Connection: "/connection" as const,
};

/**
 * The options for the REST.
 */
export interface RestOptions {
    /**
     * The endpoint for the REST.
     * @type {RestEndpoint}
     */
    endpoint: RestEndpoint;
    /**
     * The method for the REST.
     * @type {HttpMethods}
     */
    method?: HttpMethods;
    /**
     * The headers for the REST.
     * @type {Record<string, string>}
     */
    headers?: Record<string, string>;
    /**
     * The body for the REST.
     * @type {Record<string, unknown> | string | undefined}
     */
    body?: Record<string, unknown> | string;
    /**
     * The query parameters for the REST.
     * @type {Record<string, string>}
     */
    params?: Record<string, string>;
    /**
     * The path type for the REST.
     * @type {RestPathType}
     */
    pathType?: RestPathType;
}

/**
 * The fetch options for the request.
 */
export interface FetchOptions extends Omit<RestOptions, "endpoint" | "body"> {
    /**
     * The signal for the request.
     */
    signal: AbortSignal;
    /**
     * The stringified body for the request.
     */
    body?: string;
}

/**
 * The error for the REST.
 */
export interface LavalinkRestError {
    /**
     * The timestamp for the REST.
     * @type {number}
     */
    timestamp: number;
    /**
     * The status for the REST.
     * @type {number}
     */
    status: number;
    /**
     * The error for the REST.
     * @type {string}
     */
    error: string;
    /**
     * The trace for the REST.
     * @type {string}
     */
    trace?: string;
    /**
     * The message for the REST.
     * @type {string}
     */
    message: string;
    /**
     * The path for the REST.
     * @type {string}
     */
    path: string;
}

/**
 * The player response from the Lavalink REST API.
 */
export interface LavalinkPlayer {
    /**
     * The guild ID associated with the player.
     * @type {string}
     */
    guildId: string;
    /**
     * The track currently being played.
     * @type {LavalinkTrack}
     */
    track?: LavalinkTrack;
    /**
     * The volume of the player.
     * @type {number}
     */
    volume: number;
    /**
     * Whether the player is paused.
     * @type {boolean}
     */
    paused: boolean;
    /**
     * The voice connection details.
     * @type {LavalinkPlayerVoice}
     */
    voice: LavalinkPlayerVoice;
    /**
     * The filter options applied to the player.
     * @type {FilterSettings}
     */
    filters: FilterSettings;
    /**
     * The state of the player.
     * @type {LavalinkPlayerState}
     */
    state: LavalinkPlayerState;
}

/**
 * The state of the player.
 */
export interface LavalinkPlayerState {
    /**
     * The time since the connection was established.
     * @type {number}
     */
    time: number;
    /**
     * The position of the current track in milliseconds.
     * @type {number}
     */
    position: number;
    /**
     * Whether the player is connected to the voice channel.
     * @type {boolean}
     */
    connected: boolean;
    /**
     * The ping to the voice server in milliseconds.
     * @type {number}
     */
    ping: number;
}

/**
 * The options to update the player.
 */
export interface UpdatePlayerInfo {
    /**
     * The guild id associated with the player.
     * @type {string}
     */
    guildId: string;
    /**
     * The options to update the player.
     * @type {LavalinkPlayOptions}
     */
    playerOptions: LavalinkPlayOptions;
    /**
     * Whether to replace the current track.
     * @type {boolean | undefined}
     * @default false
     */
    noReplace?: boolean;
}

/**
 * The updated session of the current session.
 */
export interface LavalinkSession {
    /**
     * Whether the session is resuming.
     * @type {boolean}
     */
    resuming: boolean;
    /**
     * The timeout for the session.
     * @type {number}
     */
    timeout: number;
}

/**
 * The rest options.
 */
export interface HoshimiRestOptions {
    /**
     * The amount of time to wait for the player to resume. (in milliseconds)
     * @type {number}
     * @default 10000
     */
    resumeTimeout?: number;
    /**
     * The default REST request timeout applied to nodes that do not set their own `restTimeout`. (in milliseconds)
     * @type {number}
     * @default 10000
     */
    restTimeout?: number;
}

/**
 * The methods for decoding base64 encoded tracks.
 */
export interface DecodeMethods {
    /**
     *
     * Decodes a single base64 encoded track.
     * @param {string} track The base64 encoded track.
     * @param {TrackRequester} requester The requester of the track.
     * @returns {Promise<TrackStructure>} The decoded track.
     * @example
     * ```ts
     * const node = player.node;
     * const track = await node.decode.single("base64EncodedTrack");
     * console.log(track.info.title); // Track Title
     * ```
     */
    single(track: string, requester: TrackRequester): Promise<TrackStructure>;
    /**
     * Decodes multiple base64 encoded tracks.
     * @param {string[]} tracks The base64 encoded tracks.
     * @param {TrackRequester} requester The requester of the tracks.
     * @returns {Promise<TrackStructure[]>} The decoded tracks.
     * @example
     * ```ts
     * const node = player.node;
     * const tracks = await node.decode.multiple(["base64EncodedTrack1", "base64EncodedTrack2"]);
     * console.log(tracks[0].info.title); // Track Title 1
     * console.log(tracks[1].info.title); // Track Title 2
     * ```
     */
    multiple(tracks: string[], requester: TrackRequester): Promise<TrackStructure[]>;
}

/**
 * The options for resuming a session.
 */
export interface SessionResumingOptions {
    /**
     * Whether the session is resuming.
     * @type {boolean}
     */
    resuming: boolean;
    /**
     * The timeout for resuming the session in seconds.
     * @type {number | null | undefined}
     */
    timeout?: number | null;
}

/**
 * The session of the node.
 */
export type NullableLavalinkSession = PickNullable<LavalinkSession, "timeout">;

/**
 * The REST endpoint type.
 */
export type RestEndpoint = `/${string}`;
