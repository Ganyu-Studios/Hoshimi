import type { Hoshimi } from "../..";
import { DebugLevels } from "../../types/Manager";
import type { UserAgent } from "../../types/Node";
import {
    type FetchOptions,
    HttpMethods,
    HttpStatusCodes,
    type LavalinkPlayer,
    type LavalinkRestError,
    type LavalinkSession,
    type RestOptions,
    RestPathType,
    type SessionResumingOptions,
    type UpdatePlayerInfo,
} from "../../types/Rest";
import type { LavalinkRoutes } from "../../types/Route";
import type { NodeStructure } from "../../types/Structures";
import { HoshimiAgent } from "../../util/constants";
import { stringify } from "../../util/functions/utils";
import { RestError } from "../Errors";
import { createRoute } from "./Route";

/**
 * Class representing the REST for the node.
 * @class Rest
 */
export class Rest {
    /**
     * The URL for the REST.
     * @type {string}
     */
    readonly url: string;

    /**
     * The version for the REST.
     * @type {string}
     */
    readonly version: string = "v4";

    /**
     * The timeout for the REST.
     * @type {number}
     */
    readonly restTimeout: number;

    /**
     * The user agent for the REST.
     * @type {UserAgent}
     */
    readonly userAgent: UserAgent;

    /**
     * The node for the REST.
     * @type {Node}
     */
    readonly node: NodeStructure;

    /**
     *
     * Create a new REST.
     * @param {NodeStructure} node The node for the REST.
     * @example
     * ```ts
     * const node = new Node({
     * 	host: "localhost",
     * 	port: 2333,
     * 	password: "youshallnotpass",
     * 	secure: false,
     * });
     *
     * const rest = new Rest(node);
     * console.log(rest.restUrl); // http://localhost:2333/v4
     * ```
     */
    constructor(node: NodeStructure) {
        const manager: Hoshimi = node.nodeManager.manager;

        this.url = `${node.options.secure ? "https" : "http"}://${node.options.host}:${node.options.port}`;
        this.restTimeout = node.options.restTimeout ?? manager.options.restOptions.restTimeout ?? 10000;
        this.userAgent = manager.options.nodeOptions.userAgent ?? HoshimiAgent;
        this.node = node;
    }

    /**
     * Typed route builder under `/v4`, shaped by {@link LavalinkRoutes}.
     * Extend it with module augmentation to type your plugin routes.
     * @type {LavalinkRoutes}
     * @readonly
     * @example
     * ```ts
     * const players = await node.rest.route.sessions(node.sessionId!).players.get();
     * await node.rest.route.sessions(sessionId).players(guildId).patch({ body: { paused: true }, query: { noReplace: true } });
     * ```
     */
    readonly route: LavalinkRoutes = createRoute<LavalinkRoutes>((options) => this.request(options));

    /**
     * The REST URL to make requests.
     * @type {string}
     */
    public get restUrl(): string {
        return this.url;
    }

    /**
     * The session id of the node.
     * @type {string | null}
     */
    public get sessionId(): string | null {
        return this.node.sessionId;
    }

    /**
     *
     * Make a request to the node.
     * @param {RestOptions} options The options to make the request.
     * @returns {Promise<T | null>} The response from the node.
     */
    public async request<T>(options: RestOptions): Promise<T | null> {
        const headers = {
            ...options.headers,
            "Content-Type": "application/json",
            "User-Agent": this.userAgent,
            Authorization: this.node.options.password,
        };

        options.method ??= HttpMethods.Get;
        options.pathType ??= RestPathType.V4;

        // normalize the path instead of normalize the whole url
        const path: string = `${options.pathType}${options.endpoint}`.replace(/\/+/g, "/");
        const url: URL = new URL(`${this.url}${path}`);

        if (options.params) {
            for (const [key, value] of Object.entries(options.params)) {
                url.searchParams.append(key, value);
            }
        }

        url.searchParams.append("trace", "true");

        const abortController = new AbortController();
        const timeout = setTimeout((): void => abortController.abort(), this.restTimeout);

        const fetchOptions: FetchOptions = {
            headers,
            method: options.method,
            signal: abortController.signal,
        };

        // Serialized once, here: the same string goes on the wire and into the debug line.
        const body: string | undefined =
            typeof options.body === "string" ? options.body : options.body ? stringify(options.body) : undefined;

        if (![HttpMethods.Get, HttpMethods.Head].includes(options.method) && body) fetchOptions.body = body;

        this.node.nodeManager.manager.debug(
            DebugLevels.Rest,
            () =>
                `[Rest] -> [${this.node.id} : ${options.method}]: Url: ${this.restUrl} | Endpoint: ${options.endpoint} | Params: ${url.search} | Body: ${body ?? "None"}`,
        );

        const response = await fetch(url.toString(), fetchOptions).finally((): void => clearTimeout(timeout));
        if (!response.ok) {
            const restError = (await response.json().catch((): null => null)) as LavalinkRestError | null;

            throw new RestError(
                restError ?? {
                    timestamp: Date.now(),
                    status: response.status,
                    error: "Unknown Error",
                    message: "Unexpected error response from Lavalink server",
                    path: options.endpoint,
                },
            );
        }

        if (response.status === HttpStatusCodes.NoContent) return null;

        return response.json() as Promise<T>;
    }

    /**
     *
     * Update the player data.
     * @deprecated Use {@link Node.updatePlayer}, or `rest.route` for the raw request. Will be removed in a future release.
     * @param {Partial<UpdatePlayerInfo>} data The player data to update.
     * @returns {Promise<LavalinkPlayer | null>} The updated player data.
     */
    public updatePlayer(data: Partial<UpdatePlayerInfo>): Promise<LavalinkPlayer | null> {
        return this.node.updatePlayer(data);
    }

    /**
     *
     * Stop the track in player for the guild.
     * @deprecated Use {@link Node.stopPlayer}. Will be removed in a future release.
     * @param {string} guildId The guild id to stop the player.
     * @returns {Promise<LavalinkPlayer | null>} The updated player data.
     */
    public stopPlayer(guildId: string): Promise<LavalinkPlayer | null> {
        return this.node.stopPlayer(guildId);
    }

    /**
     *
     * Destroy the player for the guild.
     * @deprecated Use {@link Node.destroyPlayer}. Will be removed in a future release.
     * @param {string} guildId The guild id to destroy the player.
     * @returns {Promise<void>}
     */
    public destroyPlayer(guildId: string): Promise<void> {
        return this.node.destroyPlayer(guildId);
    }

    /**
     *
     * Update the session for the node.
     * @deprecated Use {@link Node.updateSession}, which also stores the session it gets back. Will be removed in a future release.
     * @param {SessionResumingOptions} options The session resuming options.
     * @returns {Promise<LavalinkSession | null>} The updated session data.
     */
    public updateSession(options: SessionResumingOptions): Promise<LavalinkSession | null> {
        return this.node.updateSession(options);
    }

    /**
     *
     * Get all players for the current session.
     * @deprecated Use {@link Node.getPlayers}. Will be removed in a future release.
     * @returns {Promise<LavalinkPlayer[]>} The players for the current session.
     */
    public getPlayers(): Promise<LavalinkPlayer[]> {
        return this.node.getPlayers();
    }
}
