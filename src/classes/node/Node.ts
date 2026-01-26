import { WebSocket } from "ws";
import { DebugLevels, EventNames } from "../../types/Manager";
import {
    type LavalinkSearchResponse,
    type LavalinkTrack,
    type NodeDestroyInfo,
    NodeDestroyReasons,
    type NodeDisconnectInfo,
    type NodeInfo,
    type NodeJson,
    type NodeOptions,
    type ResumableHeaders,
    type SearchQuery,
    State,
    type Stats,
    WebsocketCloseCodes,
} from "../../types/Node";
import {
    type DecodeMethods,
    HttpMethods,
    type LavalinkPlayer,
    type LavalinkSession,
    type NullableLavalinkSession,
    type SessionResumingOptions,
    type UpdatePlayerInfo,
} from "../../types/Rest";
import {
    type LyricsManagerStructure,
    type NodelinkNodeStructure,
    type NodeManagerStructure,
    type NodeStructure,
    type RestStructure,
    Structures,
} from "../../types/Structures";
import { onClose, onError, onMessage, onOpen } from "../../util/events/websocket";
import { stringify, validateQuery } from "../../util/functions/utils";
import { NodeError } from "../Errors";
import { Track } from "../Track";

/**
 * Class representing a Lavalink node.
 * @class Node
 */
export class Node {
    /**
     * The options for the node.
     * @type {Required<NodeOptions>}
     */
    readonly options: Required<NodeOptions>;

    /**
     * The REST for the node.
     * @type {RestStructure}
     */
    readonly rest: RestStructure;

    /**
     * The manager for the node.
     * @type {NodeManagerStructure}
     */
    readonly nodeManager: NodeManagerStructure;

    /**
     * The lyrics manager for the node.
     * @type {LyricsManager}
     */
    readonly lyricsManager: LyricsManagerStructure;

    /**
     * The delay between reconnect attempts.
     * @type {number}
     */
    readonly retryDelay: number;

    /**
     * The amount of reconnect attempts left.
     * @type {number}
     */
    public retryAmount: number;

    /**
     * The WebSocket for the node.
     * @type {WebSocket | null}
     */
    public ws: WebSocket | null = null;

    /**
     * The state of the node.
     * @type {State}
     */
    public state: State = State.Idle;

    /**
     * The session id of the node.
     */
    public sessionId: string | null = null;

    /**
     * The interval for the reconnect.
     * @type {NodeJS.Timeout | null}
     */
    public reconnectTimeout: NodeJS.Timeout | null = null;

    /**
     * The public stats of the node.
     * @type {Stats | null}
     */
    public stats: Stats | null = null;

    /**
     * The public info of the node.
     * @type {NodeInfo | null}
     */
    public info: NodeInfo | null = null;

    /**
     * The session of the node.
     * @type {NullableLavalinkSession}
     */
    public session: NullableLavalinkSession = {
        timeout: null,
        resuming: false,
    };

    /**
     *
     * Create a new Lavalink node.
     * @param {NodeManagerStructure} nodeManager The manager for the node.
     * @param {NodeOptions} options The options for the node.
     * @example
     * ```ts
     * const node = new Node(nodeManager, {
     * 	host: "localhost",
     * 	port: 2333,
     * 	password: "youshallnotpass",
     * 	id: "node1",
     * 	secure: false,
     * 	retryAmount: 5,
     * 	retryDelay: 20000,
     * 	restTimeout: 10000,
     * 	sessionId: null,
     * });
     *
     * node.connect();
     * console.log(node.id); // node1
     * console.log(node.address); // ws://localhost:2333/v4/websocket
     * console.log(node.penalties); // the penalties of the node
     * console.log(node.state); // the state of the node
     * ```
     */
    constructor(nodeManager: NodeManagerStructure, options: NodeOptions) {
        this.options = {
            ...options,
            sessionId: options.sessionId ?? "",
            id: options.id ?? `${options.host}:${options.port}`,
            restTimeout: options.restTimeout ?? 10000,
            secure: options.secure ?? false,
            retryAmount: options.retryAmount ?? 5,
            retryDelay: options.retryDelay ?? 20000,
        };

        this.retryAmount = this.options.retryAmount;
        this.retryDelay = this.options.retryDelay;
        this.nodeManager = nodeManager;

        if (this.options.secure && this.options.port !== 443) this.options.port = 443;

        this.rest = Structures.Rest(this);
        this.lyricsManager = Structures.LyricsManager(this);
    }

    /**
     * The decode methods for the node.
     * @type {DecodeMethods}
     * @readonly
     */
    readonly decode: DecodeMethods = {
        single: async (track, requester): Promise<Track> => {
            const raw = await this.rest.request<LavalinkTrack>({
                endpoint: "/decodetrack",
                params: { encodedTrack: track },
            });

            return new Track(raw, requester);
        },
        multiple: async (tracks, requester): Promise<Track[]> => {
            const raw =
                (await this.rest.request<LavalinkTrack[]>({
                    endpoint: "/decodetracks",
                    method: HttpMethods.Post,
                    body: stringify(tracks),
                })) ?? [];

            return raw.map((track): Track => new Track(track, requester));
        },
    };

    /**
     * The id of the node.
     * @type {string}
     * @readonly
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) {
     * 	console.log(node.id); // node1
     * }
     * ```
     */
    public get id(): string {
        return this.options.id;
    }

    public isNodelink(): this is NodelinkNodeStructure {
        return this.info?.isNodelink ?? false;
    }

    public isLavalink(): this is NodeStructure {
        return !this.isNodelink();
    }

    /**
     * The socket address to connect the node.
     * @type {string}
     * @readonly
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) {
     * 	console.log(node.id); // node1
     * 	console.log(node.address); // ws://localhost:2333/v4/websocket
     * }
     * }
     */
    public get address(): string {
        return `${this.options.secure ? "wss" : "ws"}://${this.options.host}:${this.options.port}/${this.rest.version}/websocket`;
    }

    /**
     * The penalties of the node.
     * @type {number}
     * @readonly
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) {
     * 	console.log(node.id); // node1
     * 	console.log(node.address); // ws://localhost:2333/v4/websocket
     * 	console.log(node.penalties); // the penalties of the node
     * }
     * ```
     */
    public get penalties(): number {
        if (!this.stats) return 0;

        const { players, cpu, frameStats } = this.stats;

        const cpuPenalty = Math.round(1.05 ** (100 * cpu.systemLoad) * 10 - 10);
        const framePenalty = frameStats ? frameStats.deficit + frameStats.nulled * 2 : 0;

        return players + cpuPenalty + framePenalty;
    }

    /**
     *
     * Search for a query.
     * @param {SearchQuery} search The query to search for.
     * @returns {Promise<LavalinkSearchResponse | null>}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) {
     * 	const search = await node.search({
     * 		query: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
     * 		engine: SearchEngines.Youtube,
     * 	});
     *
     * 	console.log(search); // the search result
     * }
     * ```
     */
    public search(search: SearchQuery): Promise<LavalinkSearchResponse | null> {
        search.engine ??= this.nodeManager.manager.options.defaultSearchEngine;

        const identifier = validateQuery(search);

        return this.rest.request<LavalinkSearchResponse>({
            endpoint: "/loadtracks",
            params: {
                identifier,
                ...search.params,
            },
        });
    }

    /**
     * Connect the node to the websocket.
     * @returns {void}
     * @throws {NodeError} If the client data is not valid
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.connect();
     * ```
     */
    public connect(): void {
        if (this.state === State.Connected || this.state === State.Connecting) return;

        if (!this.nodeManager.manager.options.client)
            throw new NodeError({
                message: "No valid client data provided.",
                id: this.id,
            });

        if (!this.nodeManager.manager.options.client.id)
            throw new NodeError({
                message: "No valid client id provided.",
                id: this.id,
            });

        this.state = State.Connecting;

        const headers: ResumableHeaders = {
            Authorization: this.options.password,
            "User-Id": this.nodeManager.manager.options.client.id,
            "Client-Name": this.nodeManager.manager.options.client.username!,
            "User-Agent": this.rest.userAgent,
        };

        if (this.options.sessionId) {
            headers["Session-Id"] = this.options.sessionId;
            this.sessionId = this.options.sessionId;

            this.nodeManager.manager.emit(
                EventNames.Debug,
                DebugLevels.Node,
                `[Socket] -> [${this.id}]: The session id is present. | Session: ${this.sessionId} | Resuming: ${this.session.resuming}`,
            );
        }

        this.ws = new WebSocket(this.address, { headers: { ...headers } });

        this.ws.on("upgrade", onOpen.bind(this));
        this.ws.on("close", onClose.bind(this));
        this.ws.on("error", onError.bind(this));
        this.ws.on("message", onMessage.bind(this));

        this.nodeManager.manager.emit(
            EventNames.Debug,
            DebugLevels.Node,
            `[Socket] -> [${this.id}]: Connecting to ${this.address} | State: ${this.state} | Session: ${this.sessionId} | Resumed: ${this.session.resuming} | Penalties: ${this.penalties} | Reconnects: ${this.retryAmount} | Headers: ${stringify(headers)}`,
        );
    }

    /**
     *
     * Stop the track in player for the guild.
     * @param {string} guildId the guild id to stop the player
     * @returns {Promise<LavalinkPlayer | null>}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) {
     * 	const player = await node.stopPlayer("guildId");
     * 	console.log(player); // the lavalink player
     * }
     * ```
     */
    public stopPlayer(guildId: string): Promise<LavalinkPlayer | null> {
        return this.rest.stopPlayer(guildId);
    }

    /**
     *
     * Update the player data.
     * @param {Partial<UpdatePlayerInfo>} data The player data to update.
     * @returns {Promise<LavalinkPlayer | null>}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) {
     * 	const player = await node.updatePlayer({
     * 		guildId: "guildId",
     * 		noReplace: true,
     * 		playerOptions: {
     * 			paused: false,
     * 			track: { encoded: "encoded track" },
     * 		},
     * 	});
     *
     * 	console.log(player); // the lavalink player
     * }
     * ```
     */
    public updatePlayer(data: Partial<UpdatePlayerInfo>): Promise<LavalinkPlayer | null> {
        return this.rest.updatePlayer(data);
    }

    /**
     * Destroy the player.
     * @returns {Promise<void>}
     * @param {string} guildId The guild id to destroy the player.
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) await node.destroyPlayer("guildId");
     * console.log("Player destroyed");
     * ```
     */
    public destroyPlayer(guildId: string): Promise<void> {
        return this.rest.destroyPlayer(guildId);
    }

    /**
     *
     * Disconnect the node from the websocket.
     * @param {NodeDisconnectInfo} [disconnect] The disconnect options for the node.
     * @returns {void}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.disconnect();
     * console.log("Node disconnected");
     * ```
     */
    public disconnect(disconnect: NodeDisconnectInfo = {}): void {
        if (this.state !== State.Connected) return;

        if (this.ws) {
            this.ws.close(disconnect.code, disconnect.reason);
            this.ws.removeAllListeners();
            this.ws = null;
        }

        this.state = State.Disconnected;
        this.retryAmount = this.options.retryAmount;

        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

        this.nodeManager.manager.emit(EventNames.NodeDisconnect, this);
    }

    /**
     *
     * Destroy the node.
     * @param {NodeDestroyInfo} [destroy] The destroy options for the node.
     * @returns {void}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.destroy();
     * console.log("Node destroyed");
     * ```
     */
    public destroy(destroy: NodeDestroyInfo = {}): void {
        if (this.state !== State.Connected) return;

        if (this.ws) {
            this.ws.close(destroy.code, destroy.reason);
            this.ws.removeAllListeners();
            this.ws = null;
        }

        this.state = State.Destroyed;
        this.retryAmount = 0;

        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

        this.nodeManager.manager.emit(EventNames.NodeDestroy, this, destroy);
        this.nodeManager.delete(this.id);
    }

    /**
     *
     * Update the session for the node
     * @param {SessionResumingOptions} options The session resuming options.
     * @returns {Promise<LavalinkSession | null>}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) {
     * 	const session = await node.updateSession({ resuming: true, timeout: 30000 });
     * 	console.log(session); // the lavalink session
     * }
     * ```
     */
    public async updateSession(options: SessionResumingOptions): Promise<LavalinkSession | null> {
        if (!this.sessionId) return null;

        const session: LavalinkSession | null = await this.rest.updateSession(options);
        if (session) this.session = session;

        return session;
    }

    /**
     * Reconnect the node.
     * @returns {void}
     * @throws {NodeError} If the node is not connected
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.reconnect();
     * console.log("Node reconnected");
     * ```
     */
    public reconnect(): void {
        if (this.state === State.Disconnected || this.state === State.Destroyed) return;

        this.state = State.Idle;

        this.nodeManager.manager.emit(EventNames.NodeReconnecting, this, this.retryAmount, this.retryDelay);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;

            if (this.retryAmount === 0) {
                this.destroy({
                    code: WebsocketCloseCodes.NormalClosure,
                    reason: NodeDestroyReasons.Destroy,
                });

                this.nodeManager.manager.emit(
                    EventNames.NodeError,
                    this,
                    new NodeError({
                        message: `Failed to reconnect after ${this.options.retryAmount} retries.`,
                        id: this.id,
                    }),
                );

                return;
            }

            if (this.ws) {
                this.ws.removeAllListeners();
                this.ws = null;
            }

            this.retryAmount--;
            this.connect();
        }, this.options.retryDelay);
    }

    /**
     *
     * Convert the node to JSON.
     * @returns {NodeJson} The JSON representation of the node.
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) {
     * 	const json = node.toJSON();
     * 	console.log(json);
     * }
     * ```
     */
    toJSON(): NodeJson {
        return {
            id: this.id,
            sessionId: this.sessionId,
            options: this.options,
        };
    }
}
