import type { LavalinkSearchResponse, LavalinkTrack, LyricsResult, NodeInfo, Stats } from "./Node";
import type { LavalinkPlayOptions } from "./Player";
import type { LavalinkPlayer, LavalinkSession, SessionResumingOptions } from "./Rest";

/**
 * A value accepted in a query string. `undefined` and `null` are skipped,
 * but `false` and `0` are kept, because Lavalink cares about `noReplace=false`.
 */
export type RouteQueryValue = string | number | boolean | null | undefined;

/**
 * Options available in every route call.
 */
export interface RouteOptions {
    /**
     * Extra headers for this request.
     * @type {Record<string, string> | undefined}
     */
    headers?: Record<string, string>;
}

/**
 * The arguments of a route call with an optional query.
 * @template Q The query shape. Omit it for routes without query.
 */
export type RouteArgs<Q extends object = never> = RouteOptions & ([Q] extends [never] ? unknown : { query?: Q });

/**
 * The arguments of a route call with a **required** query.
 * @template Q The query shape.
 */
export type RouteQueryArgs<Q extends object> = RouteOptions & { query: Q };

/**
 * The arguments of a route call with a **required** body and an optional query.
 * @template B The body shape.
 * @template Q The query shape.
 */
export type RouteBodyArgs<B, Q extends object = never> = RouteArgs<Q> & { body: B };

/**
 * Query of the routes that can skip the track source on the lyrics plugin.
 */
export interface LyricsQuery {
    skipTrackSource?: boolean;
}

/**
 * Routes under `/sessions/:sessionId/players/:guildId`.
 *
 * Augment it to add your own plugin routes at player level:
 * @example
 * ```ts
 * declare module "hoshimi" {
 *     interface LavalinkPlayerRoutes {
 *         sponsorblock: { get(args?: RouteArgs): Promise<string[] | null> };
 *     }
 * }
 * ```
 */
export interface LavalinkPlayerRoutes {
    get(args?: RouteArgs): Promise<LavalinkPlayer | null>;
    patch(args: RouteBodyArgs<LavalinkPlayOptions, { noReplace?: boolean }>): Promise<LavalinkPlayer | null>;
    delete(args?: RouteArgs): Promise<null>;
    track: {
        lyrics: {
            get(args?: RouteArgs<LyricsQuery>): Promise<LyricsResult | null>;
        };
    };
    lyrics: {
        subscribe: {
            post(args?: RouteArgs<LyricsQuery>): Promise<null>;
            delete(args?: RouteArgs): Promise<null>;
        };
    };
}

/**
 * Routes under `/sessions/:sessionId/players`.
 */
export interface LavalinkPlayersRoutes {
    get(args?: RouteArgs): Promise<LavalinkPlayer[] | null>;
    (guildId: string): LavalinkPlayerRoutes;
}

/**
 * Routes under `/sessions/:sessionId`.
 */
export interface LavalinkSessionRoutes {
    patch(args: RouteBodyArgs<SessionResumingOptions>): Promise<LavalinkSession | null>;
    players: LavalinkPlayersRoutes;
}

/**
 * The typed Lavalink v4 routes, the type of `node.rest.route`.
 *
 * It is an interface on purpose, so you can add your own routes with module augmentation:
 * @example
 * ```ts
 * declare module "hoshimi" {
 *     interface LavalinkRoutes {
 *         loadsearch: {
 *             get(args: RouteQueryArgs<{ query: string; types?: string }>): Promise<MySearchResult | null>;
 *         };
 *     }
 * }
 *
 * const result = await node.rest.route.loadsearch.get({ query: { query: "faded" } });
 * ```
 */
export interface LavalinkRoutes {
    sessions(sessionId: string): LavalinkSessionRoutes;
    loadtracks: {
        get(args: RouteQueryArgs<{ identifier: string }>): Promise<LavalinkSearchResponse | null>;
    };
    decodetrack: {
        get(args: RouteQueryArgs<{ encodedTrack: string }>): Promise<LavalinkTrack | null>;
    };
    decodetracks: {
        post(args: RouteBodyArgs<string[]>): Promise<LavalinkTrack[] | null>;
    };
    info: {
        get(args?: RouteArgs): Promise<NodeInfo | null>;
    };
    stats: {
        get(args?: RouteArgs): Promise<Omit<Stats, "op"> | null>;
    };
    lyrics: {
        get(args: RouteQueryArgs<{ track: string } & LyricsQuery>): Promise<LyricsResult | null>;
    };
}
