import type { IncomingMessage } from "node:http";
import type { Player } from "../../classes/player/Player";
import { DebugLevels, EventNames } from "../../types/Manager";
import { type LavalinkPayload, NodeDestroyReasons, type NodeInfo, OpCodes, State, WebsocketCloseCodes } from "../../types/Node";
import { PlayerEventType } from "../../types/Player";
import type { LavalinkPlayer } from "../../types/Rest";
import { type NodeStructure, Structures } from "../../types/Structures";
import { stringify } from "../functions/utils";
import { onNodelink } from "./nodelink";
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
 * @returns {void} Nothing new.
 */
export function onOpen(this: NodeStructure, res: IncomingMessage): void {
    const isResume = res.headers["session-resumed"] === "true";
    const apiVersion = res.headers["lavalink-api-version"] ?? "unknown";

    this.retryAmount = this.options.retryAmount;

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
 * @returns {void} The same thing as above.
 */
export function onClose(this: NodeStructure, code: number, reason: string): void {
    this.nodeManager.manager.emit(
        EventNames.Debug,
        DebugLevels.Node,
        `[Socket] -> [${this.id}]: Connection closed with ${this.address}. | Code: ${code} | Reason: ${reason}`,
    );

    this.nodeManager.manager.emit(EventNames.NodeDisconnect, this);

    if (code !== WebsocketCloseCodes.NormalClosure || reason !== NodeDestroyReasons.Destroy) {
        if (this.nodeManager.nodes.has(this.id)) this.reconnect();
    }
}

/**
 *
 * Emitted when an error occurs.
 * @param {NodeStructure} this The node that emitted the event.
 * @param {Error} [error] The error that occurred.
 * @returns {void} Did you know that void is a type in TypeScript?
 */
export function onError(this: NodeStructure, error?: Error): void {
    if (!error) return;

    if (this.reconnectTimeout) {
        clearInterval(this.reconnectTimeout);
        this.reconnectTimeout = null;
    }

    this.nodeManager.manager.emit(
        EventNames.Debug,
        DebugLevels.Node,
        `[Socket] -> [${this.id}]: Connection error with ${this.address}. | Error: ${error.message}`,
    );
    this.nodeManager.manager.emit(EventNames.NodeError, this, error);
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
        const payload: LavalinkPayload = JSON.parse(message.toString());
        if (!payload.op) return;

        this.nodeManager.manager.emit(EventNames.NodeRaw, this, payload);

        onNodelink.call(this, payload as never);

        switch (payload.op) {
            case OpCodes.Stats:
                {
                    this.stats = payload;
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

                    if (payload.resumed) {
                        const players: LavalinkPlayer[] = await this.rest.getPlayers();
                        const timeout: number = this.nodeManager.manager.options.nodeOptions.resumeTimeout;

                        this.nodeManager.manager.emit(EventNames.NodeResumed, this, players, payload);
                        this.nodeManager.manager.emit(
                            EventNames.Debug,
                            DebugLevels.Node,
                            `[Socket] <- [${this.id}]: Resumed session. | Session id: ${payload.sessionId} | Players: ${players.length} | Resumed: ${payload.resumed} | Timeout: ${timeout}ms`,
                        );
                    }

                    const players: Player[] = this.nodeManager.manager.players.filter((p) => p.node.id === this.id);
                    const isLibrary: boolean = this.nodeManager.manager.options.nodeOptions.resumeByLibrary;

                    if (!payload.resumed && isLibrary && players.length) await resumeByLibrary.call(this, players);

                    this.info = await this.rest.request<NodeInfo>({ endpoint: "/info" });

                    if (this.info) this.info.isNodelink = !!this.info.isNodelink;

                    if (this.isNodelink()) {
                        const nodelinkInstance = Structures.NodelinkNode(this.nodeManager, this.options);
                        const nodelinkPrototype = Object.getPrototypeOf(nodelinkInstance);

                        const lyricsManager = Structures.NodelinkLyricsManager(this);
                        const lyricsPrototype = Object.getPrototypeOf(lyricsManager);

                        Object.setPrototypeOf(this, nodelinkPrototype);
                        Object.setPrototypeOf(this.lyricsManager, lyricsPrototype);

                        this.nodeManager.manager.emit(
                            EventNames.Debug,
                            DebugLevels.Node,
                            `[Socket] -> [${this.id}]: Switched to NodelinkNode structure.`,
                        );
                    }

                    if (this.isLavalink()) {
                        const lavalinkInstance = Structures.Node(this.nodeManager, this.options);
                        const lavalinkPrototype = Object.getPrototypeOf(lavalinkInstance);

                        const lyricsManager = Structures.LyricsManager(this);
                        const lyricsPrototype = Object.getPrototypeOf(lyricsManager);

                        Object.setPrototypeOf(this, lavalinkPrototype);
                        Object.setPrototypeOf(this.lyricsManager, lyricsPrototype);

                        this.nodeManager.manager.emit(
                            EventNames.Debug,
                            DebugLevels.Node,
                            `[Socket] -> [${this.id}]: Switched to Node structure.`,
                        );
                    }

                    const resuming: boolean = this.nodeManager.manager.options.nodeOptions.resumable;
                    if (resuming) {
                        const timeout: number = this.nodeManager.manager.options.nodeOptions.resumeTimeout;

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
                const player: Player | undefined = this.nodeManager.manager.getPlayer(payload.guildId);
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
                        await lyricsFound.call(player, player.queue.current, payload);
                        break;
                    case PlayerEventType.LyricsNotFound:
                        await lyricsNotFound.call(player, player.queue.current, payload);
                        break;
                    case PlayerEventType.LyricsLine:
                        await lyricsLine.call(player, player.queue.current, payload);
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
