import type { Hoshimi } from "../..";
import { DebugLevels } from "../../types/Manager";
import type { UserAgent } from "../../types/Node";
import { State } from "../../types/Node";
import {
    type FetchOptions,
    HttpMethods,
    HttpStatusCodes,
    type LavalinkPlayer,
    type LavalinkRestError,
    type LavalinkSession,
    type RestOptions,
    RestPathType,
    RestRoutes,
    type SessionResumingOptions,
    type UpdatePlayerInfo,
} from "../../types/Rest";
import type { NodeStructure } from "../../types/Structures";
import { HoshimiAgent } from "../../util/constants";
import { stringify, updatePlayerState } from "../../util/functions/utils";
import { RestError } from "../Errors";

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

        if (![HttpMethods.Get, HttpMethods.Head].includes(options.method) && options.body) {
            if (typeof options.body === "string") fetchOptions.body = options.body;
            else fetchOptions.body = stringify(options.body);
        }

        this.node.nodeManager.manager.debug(
            DebugLevels.Rest,
            `[Rest] -> [${this.node.id} : ${options.method}]: Url: ${this.restUrl} | Endpoint: ${options.endpoint} | Params: ${url.search} | Body: ${options.body ? stringify(options.body) : "None"} | Headers: ${stringify(headers)}`,
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
     * @param {Partial<UpdatePlayerInfo>} data The player data to update.
     * @returns {LavalinkPlayer | null} The updated player data.
     * @example
     * ```ts
     * const player = await node.rest.updatePlayer({
     * 	guildId: "guildId",
     * 	noReplace: true,
     * 	playerOptions: {
     * 		paused: false,
     * 		track: { encoded: "encoded track" },
     * 	},
     * });
     *
     * console.log(player); // The updated lavalink player data
     * ```
     */
    public updatePlayer(data: Partial<UpdatePlayerInfo>): Promise<LavalinkPlayer | null> {
        if (!this.sessionId || this.node.state !== State.Connected) {
            this.node.nodeManager.manager.debug(
                DebugLevels.Rest,
                `[Rest] -> [${this.node.id}]: Skipped updatePlayer because session is not ready. | Session: ${this.node.sessionId ?? "none"} | State: ${this.node.state}`,
            );
            return Promise.resolve(null);
        }

        this.node.nodeManager.manager.debug(
            DebugLevels.Rest,
            `[Rest] -> [${this.node.id}]: Updated player data for guild: ${data.guildId} | Payload: ${stringify(data)}`,
        );

        updatePlayerState(this.node, data);

        return this.request<LavalinkPlayer>({
            method: HttpMethods.Patch,
            endpoint: RestRoutes.UpdatePlayer(this.sessionId, data.guildId!),
            body: { ...data.playerOptions },
            params: { noReplace: `${data.noReplace ?? false}` },
        });
    }

    /**
     *
     * Stop the track in player for the guild.
     * @param {string} guildId The guild id to stop the player.
     * @returns {Promise<LavalinkPlayer | null>} The updated player data.
     * @example
     * ```ts
     * const player = await node.rest.stopPlayer("guildId");
     * if (player) console.log(player); // The lavalink player
     * ```
     */
    public stopPlayer(guildId: string): Promise<LavalinkPlayer | null> {
        if (!this.sessionId || this.node.state !== State.Connected) {
            this.node.nodeManager.manager.debug(
                DebugLevels.Rest,
                `[Rest] -> [${this.node.id}]: Skipped stopPlayer because session is not ready. | Session: ${this.node.sessionId ?? "none"} | State: ${this.node.state}`,
            );
            return Promise.resolve(null);
        }

        this.node.nodeManager.manager.debug(DebugLevels.Rest, `[Rest] -> [${this.node.id}]: Stopped player for guild: ${guildId}`);

        return this.updatePlayer({
            guildId,
            playerOptions: {
                paused: false,
                track: { encoded: null },
            },
        });
    }

    /**
     *
     * Destroy the player for the guild.
     * @param {string} guildId The guild id to destroy the player.
     * @returns {Promise<void>} The updated player data.
     * @example
     * ```ts
     * await node.rest.destroyPlayer("guildId");
     * ```
     * @example
     */
    public async destroyPlayer(guildId: string): Promise<void> {
        if (!this.sessionId || this.node.state !== State.Connected) {
            this.node.nodeManager.manager.debug(
                DebugLevels.Rest,
                `[Rest] -> [${this.node.id}]: Skipped destroyPlayer because session is not ready. | Session: ${this.node.sessionId ?? "none"} | State: ${this.node.state}`,
            );
            return;
        }

        this.node.nodeManager.manager.debug(DebugLevels.Rest, `[Rest] -> [${this.node.id}]: Destroyed player for guild: ${guildId}`);

        await this.request({
            method: HttpMethods.Delete,
            endpoint: RestRoutes.UpdatePlayer(this.sessionId, guildId),
        });
    }

    /**
     *
     * Update the session for the node
     * @param {SessionResumingOptions} options The session resuming options.
     * @returns {Promise<LavalinkSession | null>} The updated session data.
     * @example
     * ```ts
     * const session = await node.rest.updateSession({ resuming: true, timeout: 30000 });
     * if (session) console.log(session); // The lavalink session data
     * ```
     */
    public updateSession(options: SessionResumingOptions): Promise<LavalinkSession | null> {
        if (!this.sessionId || this.node.state !== State.Connected) {
            this.node.nodeManager.manager.debug(
                DebugLevels.Rest,
                `[Rest] -> [${this.node.id}]: Skipped updateSession because session is not ready. | Session: ${this.node.sessionId ?? "none"} | State: ${this.node.state}`,
            );
            return Promise.resolve(null);
        }

        const { resuming, timeout } = options;

        this.node.nodeManager.manager.debug(
            DebugLevels.Rest,
            `[Rest] -> [${this.node.id}]: Updated session for resumed: ${resuming} | Timeout: ${timeout ?? "None"}`,
        );

        return this.request<LavalinkSession>({
            method: HttpMethods.Patch,
            endpoint: RestRoutes.UpdateSession(this.sessionId),
            body: { resuming, timeout },
        });
    }

    /**
     *
     * Get all players for the current session.
     * @returns {Promise<LavalinkPlayer[]>} The players for the current session.
     * @example
     * ```ts
     * const players = await node.rest.getPlayers();
     * console.log(players); // The lavalink players for the current session
     * ```
     */
    public async getPlayers(): Promise<LavalinkPlayer[]> {
        if (!this.sessionId || this.node.state !== State.Connected) {
            this.node.nodeManager.manager.debug(
                DebugLevels.Rest,
                `[Rest] -> [${this.node.id}]: Skipped getPlayers because session is not ready. | Session: ${this.node.sessionId ?? "none"} | State: ${this.node.state}`,
            );
            return [];
        }

        this.node.nodeManager.manager.debug(
            DebugLevels.Rest,
            `[Rest] -> [${this.node.id}]: Fetching all players for session id: ${this.sessionId}`,
        );

        const players: LavalinkPlayer[] =
            (await this.request<LavalinkPlayer[]>({
                endpoint: RestRoutes.GetPlayers(this.sessionId),
            })) ?? [];

        if (!players.length) {
            this.node.nodeManager.manager.debug(
                DebugLevels.Rest,
                `[Rest] <- [${this.node.id}]: No players found for session id: ${this.sessionId}`,
            );

            return [];
        }

        return players;
    }
}
