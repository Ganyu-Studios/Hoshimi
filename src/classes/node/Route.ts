import { HttpMethods, type RestEndpoint, type RestOptions } from "../../types/Rest";

/**
 * The function that actually sends the request, usually `rest.request`.
 */
export type RouteSender = <T>(options: RestOptions) => Promise<T | null>;

/**
 * The property names that send the request instead of adding a segment.
 */
const METHODS: Readonly<Record<string, HttpMethods>> = {
    get: HttpMethods.Get,
    head: HttpMethods.Head,
    delete: HttpMethods.Delete,
    post: HttpMethods.Post,
    put: HttpMethods.Put,
    patch: HttpMethods.Patch,
};

/**
 * The arguments every method receives at runtime. The types of each route decide which ones are valid.
 */
interface RuntimeArgs {
    /**
     * The query string values. `undefined` and `null` are skipped.
     * @type {Record<string, unknown> | undefined}
     */
    query?: Record<string, unknown>;
    /**
     * The request body, serialized by the sender.
     * @type {RestOptions["body"]}
     */
    body?: RestOptions["body"];
    /**
     * Extra headers for this request.
     * @type {Record<string, string> | undefined}
     */
    headers?: Record<string, string>;
}

/**
 *
 * Encode a value as a single path segment.
 * @param {string | number} value The value to encode.
 * @returns {string} The encoded segment.
 */
const encode = (value: string | number): string => encodeURIComponent(String(value));

/**
 *
 * Build the query string values of a request, keeping `false` and `0`.
 * @param {Record<string, unknown>} [query={}] The query values.
 * @returns {Record<string, string>} The values as strings.
 */
function toParams(query: Record<string, unknown> = {}): Record<string, string> {
    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) params[key] = String(value);
    }

    return params;
}

/**
 *
 * Create a typed route builder on top of a sender.
 *
 * Nothing here knows the routes, `T` is only a cast: the shape comes from interfaces like
 * `LavalinkRoutes`, that you can extend with module augmentation. Property access adds a segment,
 * calling it adds values, and `get`, `post`, `put`, `patch`, `delete` and `head` send the request.
 * Every step returns a **new** route, so partial routes can be reused safely.
 *
 * A segment named like a method (`delete`, `get`...) cannot be reached as a property, since that sends
 * the request: pass it as a value instead, `route.plugin("delete").post()`.
 * @template T The routes interface.
 * @param {RouteSender} send The function that makes the request.
 * @param {readonly string[]} [segments=[]] The segments built so far.
 * @returns {T} The root route.
 * @example
 * ```ts
 * const route = createRoute<LavalinkRoutes>((options) => rest.request(options));
 *
 * await route.sessions(sessionId).players(guildId).patch({ body: { paused: true }, query: { noReplace: true } });
 * String(route.sessions(sessionId).players); // "/sessions/<sessionId>/players"
 * ```
 */
export function createRoute<T extends object>(send: RouteSender, segments: readonly string[] = []): T {
    const endpoint = `/${segments.join("/")}` as RestEndpoint;

    return new Proxy((() => {}) as unknown as T, {
        get(_, prop) {
            // A route reads as its endpoint: in a template literal, `String(route)`, a log or JSON.
            if (prop === Symbol.toPrimitive || prop === "toString" || prop === "toJSON") return () => endpoint;

            // Other symbols (inspect, iterator...) are never segments. `then` is skipped too, so
            // `await route` does not treat the proxy as a thenable.
            if (typeof prop === "symbol" || prop === "then") return undefined;

            const method: HttpMethods | undefined = METHODS[prop];
            if (method)
                return ({ query, body, headers }: RuntimeArgs = {}) => send({ endpoint, method, params: toParams(query), headers, body });

            return createRoute(send, [...segments, encode(prop)]);
        },

        apply(_, __, args: (string | number)[]) {
            return createRoute(send, [...segments, ...args.map(encode)]);
        },
    });
}
