import { EventEmitter } from "node:events";
import {
    type ChannelDelete,
    type ChannelDeletePacket,
    type ClientInfo,
    DebugLevels,
    DestroyReasons,
    EventNames,
    type HoshimiEvents,
    type HoshimiOptions,
    type QueryResult,
    type RequiredHoshimiOptions,
    type SearchOptions,
    type VoicePacket,
    type VoiceServer,
    type VoiceState,
} from "../types/Manager";
import { type LavalinkSearchResponse, LoadType, State } from "../types/Node";
import type { LavalinkPlayerVoice, PlayerOptions } from "../types/Player";
import { type NodeManagerStructure, type NodeStructure, type PlayerStructure, Structures, type TrackStructure } from "../types/Structures";
import { Collection } from "../util/collection";
import { HoshimiDefaultOptions } from "../util/constants";
import { isPlainObject, mergeDefault, stringify, validateManagerOptions } from "../util/functions/utils";
import { ManagerError, OptionError } from "./Errors";

/**
 * The packet type for the manager.
 */
type GatewayPackets = VoicePacket | VoiceServer | VoiceState | ChannelDeletePacket;

/**
 * Class representing the Hoshimi manager.
 * @class Hoshimi
 * @extends {EventEmitter<HoshimiEvents>}
 * @example
 * ```ts
 * import { Hoshimi, SearchSources } from "hoshimi";
 *
 * const manager = new Hoshimi({ // or via createHoshimi() function
 *  sendPayload: async (guildId, payload) => {
 *      const guild = await <Client>.guilds.fetch(guildId);
 *      if (!guild) return;
 *
 *      await guild.shard.send(payload); // Adjust this line based on your library's method to send payloads
 *  },
 * 	nodes: [
 * 		{
 * 			host: "localhost",
 * 			port: 2333,
 *          password: "youshallnotpass",
 * 			secure: false,
 * 		},
 *     ],
 * });
 *
 * manager.on("nodeReady", (node) => console.log(`Node ${node.id} is ready.`));
 * manager.on("playerCreate", (player) => console.log(`Player created for guild ${player.guildId}.`));
 * manager.on("error", (error) => console.error("An error occurred:", error));
 *
 * <Client>.on("ready", () => {
 *   manager.init({ id: <Client>.user.id, username: <Client>.user.username });
 * });
 *
 * console.log(manager); // The manager instance
 * ```
 */
export class Hoshimi extends EventEmitter<HoshimiEvents> {
    /**
     * The options for the manager.
     * @type {HoshimiOptions}
     */
    public options: RequiredHoshimiOptions;

    /**
     * The players for the manager.
     * @type {Collection<string, PlayerStructure>}
     * @readonly
     */
    readonly players: Collection<string, PlayerStructure> = new Collection();

    /**
     * THe node manager for the manager.
     * @type {NodeManager}
     * @readonly
     */
    readonly nodeManager: NodeManagerStructure;

    /**
     * If the manager is ready.
     * @type {boolean}
     */
    public ready: boolean = false;

    /**
     * The constructor for the manager.
     * @param {HoshimiOptions} options The options for the manager.
     * @throws {ManagerError} If the options are not provided.
     * @throws {OptionError} If the options are invalid.
     * @example
     * ```ts
     * const manager = new Hoshimi({
     * 	nodes: [
     * 		{
     * 			host: "localhost",
     * 			port: 2333,
     * 			password: "youshallnotpass",
     * 			secure: false,
     * 		},
     * 	],
     * 	client: {
     * 		id: "clientId",
     * 		username: "clientUsername",
     * 	},
     * 	defaultSearchSource: SearchSources.Youtube,
     * 	restOptions: {
     * 		resumeTimeout: 10000,
     * 	},
     * 	nodeOptions: {
     * 		userAgent: HoshimiAgent,
     * 		resumable: false,
     * 		resumeByLibrary: false,
     * 	},
     * 	queueOptions: {
     *      maxHistory: 25,
     *      autoplayFn: autoplayFn,
     *      autoPlay: false,
     *      storage: new MemoryAdapter(),
     *      requesterFn: defaultRequesterFn,
     * 	},
     *   playerOptions: {
     *    	onDisconnect: {
     *        autoDestroy: false,
     *        autoReconnect: false,
     *        autoQueue: false,
     *   	},
     *   	onError: {
     *        autoDestroy: false,
     *        autoSkip: false,
     *        autoStop: false,
     *      },
     *   },
     * });
     *
     * console.log(manager); // The manager instance
     * ```
     */
    constructor(options: HoshimiOptions) {
        super();

        if (!options || !isPlainObject(options)) throw new ManagerError("You must provide the options for the manager.");

        this.options = mergeDefault(HoshimiDefaultOptions, options);

        validateManagerOptions(this.options);

        this.nodeManager = Structures.NodeManager(this);
    }

    /**
     * Check if the manager is useable.
     * @returns {boolean} If the manager is useable.
     * @example
     * ```ts
     * if (manager.isUseable()) {
     * 	console.log("The manager is useable.");
     * } else {
     * 	console.log("The manager is not useable.");
     * }
     * ```
     */
    public isUseable(): boolean {
        const nodes: NodeStructure[] = this.nodeManager.nodes.filter((node): boolean => node.state === State.Connected);
        return this.ready && nodes.length > 0;
    }

    /**
     *
     * Emit a debug event.
     * @param {DebugLevels} level The debug level.
     * @param {string} message The debug message.
     * @returns {void}
     * @example
     * ```ts
     * manager.debug(DebugLevels.Manager, "This is a debug message.");
     * ```
     */
    public debug(level: DebugLevels, message: string): void {
        this.emit(EventNames.Debug, level, message);
    }

    /**
     *
     * Get the player for the guild.
     * @param {string} guildId The guild id to get the player.
     * @returns {PlayerStructure | undefined} The player for the guild.
     * @example
     * ```ts
     * const player = manager.getPlayer(guildId);
     * if (player) {
     * 	console.log(`The player for ${guildId} is ${player}`);
     * } else {
     * 	console.log(`The player for ${guildId} is not found.`);
     * }
     * ```
     */
    public getPlayer(guildId: string): PlayerStructure | undefined {
        return this.players.get(guildId);
    }

    /**
     * Delete the player for the guild.
     * @param {string} guildId The guild id to delete the player.
     * @returns {boolean} If the player was deleted.
     * @example
     * ```ts
     * const player = manager.deletePlayer(guildId);
     * if (player) {
     * 	console.log(`The player for ${guildId} was deleted.`);
     * } else {
     * 	console.log(`The player for ${guildId} was not found.`);
     * }
     * ```
     */
    public deletePlayer(guildId: string): boolean {
        return this.players.delete(guildId);
    }

    /**
     *
     * Handle the raw packet for voice state and voice server updates.
     * @param {GatewayPackets} packet The packet to handle
     * @returns {Promise<void>}
     * @example
     * ```ts
     * client.on("raw", (packet) => manager.updateVoiceState(packet));
     * ```
     */
    public async updateVoiceState(packet: GatewayPackets): Promise<void> {
        if (!this.ready) {
            this.debug(DebugLevels.Player, "[Player] -> [Manager] The manager is not ready.");
            return;
        }

        if (!("t" in packet)) {
            this.debug(DebugLevels.Player, "[Player] -> [Voice] The packet does not have a type.");
            return;
        }

        switch (packet.t) {
            case "CHANNEL_DELETE": {
                const data: ChannelDelete = packet.d;

                const player: PlayerStructure | undefined = this.getPlayer(data.guild_id);
                if (!player) {
                    this.debug(DebugLevels.Player, "[Player] -> [Voice] The player is not found.");
                    return;
                }

                if (player.destroyed) {
                    this.debug(
                        DebugLevels.Player,
                        `[Player] -> [Voice] Player for guild: ${data.guild_id} is being destroyed, skipping voice state update handling.`,
                    );
                    return;
                }

                if (data.id === player.voiceId) {
                    this.debug(DebugLevels.Player, `[Player] -> [Voice] The channel ${data.id} was deleted, disconnecting the player.`);

                    await player.destroy({ reason: DestroyReasons.VoiceChannelDeleted });
                } else {
                    this.debug(
                        DebugLevels.Player,
                        `[Player] -> [Voice] The channel ${data.id} was deleted, but it is not the player's channel.`,
                    );
                }

                break;
            }

            case "VOICE_SERVER_UPDATE":
            case "VOICE_STATE_UPDATE":
                {
                    const data: VoiceServer | VoiceState = packet.d;

                    if (!("guild_id" in data)) {
                        this.debug(DebugLevels.Player, "[Player] -> [Voice] The guild id is missing.");
                        return;
                    }

                    const player: PlayerStructure | undefined = this.getPlayer(data.guild_id);
                    if (!player) {
                        this.debug(DebugLevels.Player, "[Player] -> [Voice] The player is not found.");
                        return;
                    }

                    if (player.destroyed) {
                        this.debug(
                            DebugLevels.Player,
                            `[Player] -> [Voice] Player for guild: ${data.guild_id} is being destroyed, skipping voice state update handling.`,
                        );
                        return;
                    }

                    // this is the most funny thing i've ever made.
                    if ("session_id" in data && "channel_id" in data)
                        player.voice.patch({ channelId: data.channel_id, sessionId: data.session_id });

                    // And also includes some abstract code.
                    if ("token" in data && "endpoint" in data) {
                        if (!player.voice.sessionId) {
                            this.debug(DebugLevels.Player, `[Player] -> [Voice] The session id is missing for: ${data.guild_id}`);

                            return;
                        }

                        player.voice.patch({ token: data.token, endpoint: data.endpoint });

                        const voice: LavalinkPlayerVoice | null = player.voice.toNode();
                        if (!voice) {
                            this.debug(DebugLevels.Player, `[Player] -> [Voice] Voice data is incomplete for: ${data.guild_id}`);

                            return;
                        }

                        await player.updatePlayer({ playerOptions: { voice } });

                        this.debug(
                            DebugLevels.Player,
                            `[Player] -> [Voice] Updated the player voice for: ${data.guild_id} | Session: ${player.voice.sessionId} | Token: ${data.token} | Endpoint: ${data.endpoint}`,
                        );

                        return;
                    }

                    if (data.user_id !== this.options.client.id) {
                        this.debug(DebugLevels.Player, "[Player] -> [Voice] The user id does not match the client id.");
                        return;
                    }

                    if (data.channel_id !== null) {
                        const voiceId: string = player.voiceId ?? player.options.voiceId;
                        if (data.channel_id !== voiceId) {
                            this.debug(
                                DebugLevels.Player,
                                `[Player] -> [Voice] Updating the voice channel for: ${data.guild_id} | Old: ${voiceId} | New: ${data.channel_id}`,
                            );

                            player.voice.sessionId = data.session_id ?? player.voice.sessionId;

                            player.voiceId = data.channel_id;
                            player.options.voiceId = data.channel_id;

                            if (!player.connected) await player.connect();

                            this.debug(
                                DebugLevels.Player,
                                `[Player] -> [VoiceMove] Player moved from channel: ${voiceId} to: ${data.channel_id} for guild: ${data.guild_id}`,
                            );

                            this.emit(EventNames.PlayerMove, player, voiceId, data.channel_id);

                            return;
                        }
                    } else {
                        this.debug(DebugLevels.Player, `[Player] -> [Voice] The channel id is missing for: ${data.guild_id}`);

                        const { autoDestroy, autoReconnect, autoQueue } = this.options.playerOptions.onDisconnect;

                        if (autoDestroy) {
                            await player.destroy({ reason: DestroyReasons.VoiceChannelLeft });
                            return;
                        }

                        if (autoReconnect) {
                            try {
                                const position: number = player.position;
                                const paused: boolean = player.paused;

                                this.debug(
                                    DebugLevels.Player,
                                    `[Player] -> [Voice] Attempting to reconnect the player for: ${data.guild_id}`,
                                );

                                if (autoQueue && player.queue.current && !player.queue.isEmpty()) await player.connect();

                                if (player.queue.current) return player.play({ track: player.queue.current, paused, position });
                                if (!player.queue.isEmpty()) return player.play({ paused });

                                this.debug(
                                    DebugLevels.Player,
                                    `[Player] -> [Voice] No tracks to play after reconnect for: ${data.guild_id}`,
                                );
                            } catch (error) {
                                this.emit(EventNames.PlayerError, player, error);
                                await player.destroy({ reason: DestroyReasons.ReconnectFailed });
                            }
                        }

                        player.connected = false;
                        player.voiceId = undefined;
                        player.voice.reset();

                        return;
                    }
                }
                break;
        }
    }

    /**
     *
     * Initialize the manager.
     * @param {ClientInfo} info The client data to use.
     * @returns {void}
     * @example
     * ```ts
     * manager.init({
     * 	id: "clientId",
     * 	username: "clientUsername",
     * });
     * ```
     */
    public init(info: ClientInfo): void {
        if (this.ready) return;

        this.options.client = {
            ...this.options.client,
            ...info,
        };

        if (!this.options.client.id) throw new ManagerError("You must provide the client id.");
        if (typeof this.options.client.id !== "string") throw new OptionError("The client info 'info.client.id': must be a string.");

        let amount: number = 0;

        for (const options of this.options.nodes) {
            const node = this.nodeManager.create(options);

            try {
                node.connect();
                amount++;
            } catch (error) {
                this.emit(EventNames.NodeError, node, error);
            }
        }

        this.ready = amount > 0;
        this.debug(
            DebugLevels.Player,
            `[Manager] -> [Init] The manager is ready: ${this.ready} | Nodes: ${amount} of ${this.nodeManager.nodes.size}`,
        );
    }

    /**
     *
     * Create a new player.
     * @param {PlayerOptions} options The options for the player.
     * @returns {Player} The created player.
     * @example
     * ```ts
     * const player = manager.createPlayer({
     * 	guildId: "guildId",
     * 	voiceId: "voiceId",
     * });
     *
     * console.log(player); // The created player
     *
     * player.connect();
     * player.play(track);
     * ```
     */
    public createPlayer(options: PlayerOptions): PlayerStructure {
        const oldPlayer: PlayerStructure | undefined = this.getPlayer(options.guildId);
        if (oldPlayer) return oldPlayer;

        const player = Structures.Player(this, options);

        this.players.set(options.guildId, player);
        this.emit(EventNames.PlayerCreate, player);

        return player;
    }

    /**
     *
     * Search for a track or playlist.
     * @param {SearchOptions} options The options for the search.
     * @returns {Promise<QueryResult>} The search result.
     * @example
     * ```ts
     * const result = await manager.search({
     * 	query: "track name",
     * 	source: SearchSources.Youtube,
     * });
     *
     * console.log(result); // The search result
     * ```
     */
    public async search(options: SearchOptions): Promise<QueryResult> {
        let node: NodeStructure | null = null;

        if (options.node) {
            const nodeId: string = typeof options.node === "string" ? options.node : options.node.id;

            node = this.nodeManager.get(nodeId) ?? null;
        } else {
            node = this.nodeManager.getLeastUsed();
        }

        if (!node) throw new ManagerError("No nodes are available.");

        const search: LavalinkSearchResponse | null = await node.search(options);
        if (!search)
            return {
                loadType: LoadType.Empty,
                exception: null,
                playlist: null,
                pluginInfo: null,
                tracks: [],
            };

        this.debug(
            DebugLevels.Manager,
            `[Manager] -> [Search] Searching for: ${options.query} (${options.source ?? "unknown"}) | Result: ${stringify(search)}`,
        );

        const requesterFn = this.options.playerOptions.requesterFn;
        const requester = await requesterFn(options.requester);

        switch (search.loadType) {
            case LoadType.Empty: {
                return {
                    loadType: search.loadType,
                    exception: null,
                    playlist: null,
                    pluginInfo: null,
                    tracks: [],
                };
            }

            case LoadType.Error: {
                return {
                    loadType: search.loadType,
                    exception: search.data,
                    playlist: null,
                    pluginInfo: null,
                    tracks: [],
                };
            }

            case LoadType.Playlist: {
                return {
                    loadType: search.loadType,
                    exception: null,
                    playlist: search.data,
                    pluginInfo: search.data.pluginInfo,
                    tracks: search.data.tracks.map((t): TrackStructure => Structures.Track(t, requester)),
                };
            }

            case LoadType.Search: {
                return {
                    loadType: search.loadType,
                    exception: null,
                    playlist: null,
                    pluginInfo: null,
                    tracks: search.data.map((t): TrackStructure => Structures.Track(t, requester)),
                };
            }

            case LoadType.Track: {
                return {
                    loadType: search.loadType,
                    exception: null,
                    playlist: null,
                    pluginInfo: search.data.pluginInfo,
                    tracks: [Structures.Track(search.data, requester)],
                };
            }
        }
    }
}

/**
 * Create a new Hoshimi instance.
 * @param {ConstructorParameters<typeof Hoshimi>} args The arguments for the constructor.
 * @returns {Hoshimi} The new Hoshimi instance.
 */
export function createHoshimi(...args: ConstructorParameters<typeof Hoshimi>): Hoshimi {
    return new Hoshimi(...args);
}
