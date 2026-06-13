import type { IncomingMessage } from "node:http";
import { DebugLevels, EventNames } from "../../types/Manager";
import { type LavalinkEventPayload, NodeDestroyReasons, type NodeInfo, OpCodes, State, WebsocketCloseCodes } from "../../types/Node";
import { PlayerEventType } from "../../types/Player";
import { type LavalinkPlayer, RestRoutes } from "../../types/Rest";
import type { NodeStructure, PlayerStructure } from "../../types/Structures";
import { stringify } from "../functions/utils";
import {
    lyricsFound,
    lyricsLine,
    lyricsNotFound,
    playerUpdate,
    resumeByLibrary,
    socketClosed,
    trackEnd,
    trackError,
    trackStart,
    trackStuck,
} from "./player";

/**
 *
 * Emitted when the socket connection is opened.
 * @param {NodeStructure} this The node that emitted the event.
 * @param {IncomingMessage} res The response from the socket connection.
 * @returns {void}
 */
export function onOpen(this: NodeStructure, res: IncomingMessage): void {
    const isResume = res.headers["session-resumed"] === "true";
    const apiVersion = res.headers["lavalink-api-version"] ?? "unknown";

    this.retryAmount = this.options.retryAmount;

    if (this.ws) this.ws.on("pong", onPong.bind(this));

    startHeartbeat.call(this);
    resetStatsTimeout.call(this);

    this.nodeManager.manager.emit(
        EventNames.Debug,
        DebugLevels.Node,
        `[Socket] -> [${this.id}]: Connection handshake complete with ${this.address}. | API Version: ${apiVersion} | Resumed: ${isResume}`,
    );
}

/**
 *
 * Emitted when the socket connection is closed.
 * @param {NodeStructure} this The node that emitted the event.
 * @param {number} code The close code of the connection.
 * @param {string} reason The close reason message.
 * @returns {void}
 */
export async function onClose(this: NodeStructure, code: number, reason: string): Promise<void> {
    clearLivenessTimers.call(this);

    this.nodeManager.manager.emit(
        EventNames.Debug,
        DebugLevels.Node,
        `[Socket] -> [${this.id}]: Connection closed with ${this.address}. | Code: ${code} | Reason: ${reason}`,
    );

    this.nodeManager.manager.emit(EventNames.NodeDisconnect, this);

    // Invalidate session immediately to prevent stale REST calls
    this.sessionId = null;
    this.state = State.Idle;

    const { moveOptions } = this.nodeManager.manager.options.nodeOptions;

    if (moveOptions.move) {
        const players: PlayerStructure[] = this.nodeManager.manager.players.filter((player): boolean => player.node.id === this.id);
        if (players.length) {
            try {
                let targetNode: NodeStructure | null = null;

                if (typeof moveOptions.filterBy === "function") {
                    const nodes: NodeStructure[] = this.nodeManager.nodes.filter(
                        (node): boolean => node.state === State.Connected && node.id !== this.id,
                    );

                    if (!nodes.length) {
                        this.nodeManager.manager.emit(
                            EventNames.Debug,
                            DebugLevels.Node,
                            `[PlayerMove] -> [${this.id}]: No connected nodes available to move players to.`,
                        );
                    } else {
                        const filterFn = moveOptions.filterBy;

                        targetNode = nodes.reduce((best, current): NodeStructure => {
                            const bestScore: number = filterFn(best);
                            const currentScore: number = filterFn(current);

                            return currentScore < bestScore ? current : best;
                        });
                    }
                } else {
                    targetNode = this.nodeManager.getLeastUsed(moveOptions.filterBy);
                }

                if (!targetNode || targetNode.id === this.id) {
                    this.nodeManager.manager.emit(
                        EventNames.Debug,
                        DebugLevels.Node,
                        `[PlayerMove] -> [${this.id}]: No valid target node available to move players to.`,
                    );
                } else {
                    const results: PromiseSettledResult<void>[] = await Promise.allSettled(
                        players.map((player): Promise<void> => player.move(targetNode)),
                    );

                    const successful: number = results.filter((r) => r.status === "fulfilled").length;
                    const failed: number = results.length - successful;

                    this.nodeManager.manager.emit(
                        EventNames.Debug,
                        DebugLevels.Node,
                        `[PlayerMove] -> [${this.id}]: Moved ${successful} players to ${targetNode.id} from disconnected node. Failed: ${failed}`,
                    );
                }
            } catch (error) {
                this.nodeManager.manager.emit(
                    EventNames.Debug,
                    DebugLevels.Node,
                    `[PlayerMove] -> [${this.id}]: Error while moving players. Error: ${error}`,
                );
            }
        }
    }

    if (code !== WebsocketCloseCodes.NormalClosure || reason !== NodeDestroyReasons.Destroy) {
        if (this.nodeManager.nodes.has(this.id)) this.reconnect();
    }
}

/**
 *
 * Emitted when an error occurs.
 * @param {NodeStructure} this The node that emitted the event.
 * @param {Error} [error] The error that occurred.
 * @returns {void}
 */
export function onError(this: NodeStructure, error?: Error): void {
    this.nodeManager.manager.emit(EventNames.NodeError, this, error);
    this.nodeManager.manager.emit(
        EventNames.Debug,
        DebugLevels.Node,
        `[Socket] -> [${this.id}]: Connection error with ${this.address}. | Error: ${error?.message ?? "Unknown error"}`,
    );

    if (this.options.closeOnError && this.ws) {
        this.nodeManager.manager.emit(
            EventNames.Debug,
            DebugLevels.Node,
            `[Socket] -> [${this.id}]: closeOnError is enabled. Closing socket to force reconnect.`,
        );
        this.ws.close(WebsocketCloseCodes.NormalClosure, "Node-Error - Force Reconnect");
    }
}

/**
 *
 * Emitted when a message is received from the socket.
 * @param {NodeStructure} this The node that emitted the event.
 * @param {Buffer | string} message The message received from the socket.
 * @returns {Promise<void>} I'm running out of ideas for this.
 */
export async function onMessage(this: NodeStructure, message: Buffer | string): Promise<void> {
    if (Array.isArray(message)) message = Buffer.concat(message);
    else if (message instanceof ArrayBuffer) message = Buffer.from(message);

    try {
        const payload: LavalinkEventPayload = JSON.parse(message.toString());
        if (!payload.op) return;

        this.nodeManager.manager.emit(EventNames.NodeRaw, this, payload);

        if (this.message) await this.message(payload);

        switch (payload.op) {
            case OpCodes.Stats:
                {
                    this.stats = payload;
                    resetStatsTimeout.call(this);
                    this.nodeManager.manager.emit(
                        EventNames.Debug,
                        DebugLevels.Node,
                        `[Socket] <- [${this.id}]: Received stats. | System load: ${this.penalties}`,
                    );
                }
                break;

            case OpCodes.Ready:
                {
                    if (!payload.sessionId) {
                        this.nodeManager.manager.emit(
                            EventNames.Debug,
                            DebugLevels.Node,
                            `[Socket] -> [${this.id}]: Session id was not provided. Breaking up the connection...`,
                        );

                        this.nodeManager.manager.emit(EventNames.NodeDestroy, this, {
                            code: WebsocketCloseCodes.AbnormalClosure,
                            reason: NodeDestroyReasons.MissingSession,
                        });

                        return this.disconnect();
                    }

                    this.state = State.Connected;
                    this.sessionId = payload.sessionId;
                    this.session.resuming = payload.resumed;

                    const { sessionOptions } = this.nodeManager.manager.options.nodeOptions;

                    if (payload.resumed) {
                        const players: LavalinkPlayer[] = await this.rest.getPlayers();
                        const timeout: number = sessionOptions.timeout;

                        this.nodeManager.manager.emit(EventNames.NodeResumed, this, players, payload);
                        this.nodeManager.manager.emit(
                            EventNames.Debug,
                            DebugLevels.Node,
                            `[Socket] <- [${this.id}]: Resumed session. | Session id: ${payload.sessionId} | Players: ${players.length} | Resumed: ${payload.resumed} | Timeout: ${timeout}ms`,
                        );
                    }

                    const players: PlayerStructure[] = this.nodeManager.manager.players.filter((p): boolean => p.node.id === this.id);
                    const isLibrary: boolean = sessionOptions.byLibrary;

                    if (!payload.resumed && isLibrary && players.length) await resumeByLibrary.call(this, players);

                    this.info = await this.rest.request<NodeInfo>({ endpoint: RestRoutes.NodeInfo });

                    if (this.info) this.info.isNodelink = !!this.info.isNodelink;

                    const resuming: boolean = sessionOptions.resumable;
                    if (resuming) {
                        const timeout: number = sessionOptions.timeout;

                        this.nodeManager.manager.emit(
                            EventNames.Debug,
                            DebugLevels.Node,
                            `[Socket] -> [${this.id}]: Setting timeout to resume session. | Timeout: ${timeout}ms`,
                        );

                        await this.updateSession({ resuming, timeout });
                    }

                    this.nodeManager.manager.emit(
                        EventNames.Debug,
                        DebugLevels.Node,
                        `[Socket] <- [${this.id}]: Received ready event. | Session id: ${payload.sessionId} | Resumed: ${payload.resumed}`,
                    );
                    this.nodeManager.manager.emit(EventNames.NodeReady, this, this.retryAmount, payload);
                }
                break;

            case OpCodes.Event: {
                const player: PlayerStructure | undefined = this.nodeManager.manager.getPlayer(payload.guildId);
                if (!player) return;

                switch (payload.type) {
                    //
                    // Events related to tracks.
                    //
                    case PlayerEventType.TrackEnd:
                        await trackEnd.call(player, payload);
                        break;
                    case PlayerEventType.TrackStart:
                        await trackStart.call(player, payload);
                        break;
                    case PlayerEventType.TrackException:
                        await trackError.call(player, payload);
                        break;
                    case PlayerEventType.TrackStuck:
                        await trackStuck.call(player, payload);
                        break;

                    //
                    // Events related to lyrics.
                    //
                    case PlayerEventType.LyricsFound:
                        await lyricsFound.call(player, payload);
                        break;
                    case PlayerEventType.LyricsNotFound:
                        await lyricsNotFound.call(player, payload);
                        break;
                    case PlayerEventType.LyricsLine:
                        await lyricsLine.call(player, payload);
                        break;

                    //
                    // Events related to the websocket.
                    //
                    case PlayerEventType.WebsocketClosed:
                        await socketClosed.call(player, payload);
                        break;
                }

                break;
            }

            case OpCodes.PlayerUpdate: {
                await playerUpdate.call(this, payload);
                break;
            }
        }

        this.nodeManager.manager.emit(
            EventNames.Debug,
            DebugLevels.Node,
            `[Socket] -> [${this.id}]: Received payload: ${stringify(payload)}`,
        );
    } catch (error) {
        this.nodeManager.manager.emit(EventNames.NodeError, this, error);
    }
}

/**
 * Start the heartbeat ping/pong cycle for the node socket.
 * @param {NodeStructure} this The node that owns the socket.
 * @returns {void}
 */
export function startHeartbeat(this: NodeStructure): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    const interval: number = this.options.heartbeat.interval;
    if (!interval || interval <= 0) return;

    this.isAlive = true;

    this.heartbeatInterval = setInterval((): void => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        if (!this.isAlive) {
            this.nodeManager.manager.emit(
                EventNames.Debug,
                DebugLevels.Node,
                `[Socket] -> [${this.id}]: No pong received within ${interval}ms. Terminating socket.`,
            );
            this.ws.terminate();
            return;
        }

        this.isAlive = false;

        try {
            this.ws.ping();
        } catch (error) {
            this.nodeManager.manager.emit(
                EventNames.Debug,
                DebugLevels.Node,
                `[Socket] -> [${this.id}]: Ping failed. Terminating socket. | Error: ${(error as Error).message}`,
            );
            this.ws.terminate();
        }
    }, interval);
}

/**
 * Handle the WebSocket pong event. Marks the socket as alive.
 * @param {NodeStructure} this The node that owns the socket.
 * @returns {void}
 */
export function onPong(this: NodeStructure): void {
    this.isAlive = true;
    this.nodeManager.manager.emit(
        EventNames.Debug,
        DebugLevels.Node,
        `[Socket] -> [${this.id}]: Received pong from ${this.address}. Marking socket as alive.`,
    );
}

/**
 * Reset the stats watchdog. Called every time a `stats` payload arrives.
 * @param {NodeStructure} this The node that owns the socket.
 * @returns {void}
 */
export function resetStatsTimeout(this: NodeStructure): void {
    if (this.statsTimeout) clearTimeout(this.statsTimeout);

    const ms: number = this.options.heartbeat.statsTimeout;
    if (!ms || ms <= 0) return;

    this.statsTimeout = setTimeout((): void => {
        this.nodeManager.manager.emit(
            EventNames.Debug,
            DebugLevels.Node,
            `[Socket] -> [${this.id}]: No stats message received in ${ms}ms. Terminating socket.`,
        );
        this.ws?.terminate();
    }, ms);
}

/**
 * Clear all liveness timers. Called on close/disconnect/destroy.
 * @param {NodeStructure} this The node that owns the socket.
 * @returns {void}
 */
export function clearLivenessTimers(this: NodeStructure): void {
    if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
    }
    if (this.statsTimeout) {
        clearTimeout(this.statsTimeout);
        this.statsTimeout = null;
    }
}
