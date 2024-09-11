import {
	Shoukaku,
	type Connector,
	Utils,
	type NodeOption,
	type ShoukakuOptions,
	type Node,
	Constants,
	LoadType,
} from "shoukaku";
import type {
	ManagerEvents,
	ManagerOptions,
	PlayerOptions,
	QueryOptions,
	SearchResult,
} from "../../types";
import { applyDefaultOptions, createConnection, validateManagerOptions } from "../../utils";
import { Player } from "./Player";
import { Track } from "./Track";
import { PlayerError } from "./Error";

/**
 * Main Manager class.
 */
export class Manager extends Utils.TypedEventEmitter<ManagerEvents> {
	/**
	 * Shoukaku instance.
	 */
	readonly shoukaku: Shoukaku;
	/**
	 * Options of the manager.
	 */
	public options: ManagerOptions;
	/**
	 * Players of the manager.
	 */
	readonly players: Map<string, Player> = new Map();

	/**
	 *
	 * Constructor of the manager.
	 * @param connector Shoukaku connector.
	 * @param nodes Node array to use.
	 * @param options Manager options.
	 * @param shoukakuOptions Shoukaku options.
	 */
	constructor(
		connector: Connector,
		nodes: NodeOption[],
		options: ManagerOptions,
		shoukakuOptions?: ShoukakuOptions,
	) {
		super();

		validateManagerOptions(options);

		this.options = options;
		this.shoukaku = new Shoukaku(connector, nodes, shoukakuOptions);

		applyDefaultOptions.call(this, options);
	}

	/**
	 *
	 * Get the least used node.
	 * @returns {Promise<Node>} Least used node.
	 */
	public async getLeastUsedNode(): Promise<Node> {
		if (!this.isUseable()) throw new PlayerError("No nodes are online.");

		const temp = await Promise.all(
			this.nodes
				.filter((n) => n.state === Constants.State.CONNECTED)
				.map(async (node) => ({
					node,
					players: (await node.rest.getPlayers())
						.map((x) => this.players.get(x.guildId)!)
						.filter((x) => x.shoukaku.node.name === node.name).length,
				})),
		);

		return temp.reduce((a, b) => (a.players < b.players ? a : b)).node;
	}

	/**
	 * Get the nodes of the manager.
	 */
	public get nodes(): Node[] {
		return [...this.shoukaku.nodes.values()];
	}

	/**
	 *
	 * Check if the manager has at least one node connected.
	 * @returns {boolean} True if at least one node is connected.
	 */
	public isUseable(): boolean {
		return this.nodes.filter((n) => n.state === Constants.State.CONNECTED).length > 0;
	}

	/**
	 *
	 * Get a player using the guildId.
	 * @param guildId The guild id.
	 * @returns {Player | undefined} The player if it exists.
	 */
	public getPlayer(guildId: string): Player | undefined {
		return this.players.get(guildId);
	}

	/**
	 *
	 * Delete a player using the guildId.
	 * @param guildId The guild id.
	 * @param reason The reason of the destroy.
	 * @returns
	 */
	public async deletePlayer(guildId: string, reason?: string): Promise<void> {
		const player = this.players.get(guildId);
		if (!player) return;

		await player.destroy(reason);
		this.players.delete(guildId);

		return;
	}

	/**
	 *
	 * Create a new player.
	 * @param options The options of the player.
	 * @returns {Promise<Player>} The new player created.
	 */
	public async createPlayer(options: PlayerOptions): Promise<Player> {
		if (this.players.has(options.guildId)) return this.players.get(options.guildId)!;

		options.selfDeaf ??= false;
		options.selfMute ??= false;

		const shoukaku = await createConnection.call(this, options, {
			guildId: options.guildId,
			channelId: options.voiceId,
			deaf: options.selfDeaf,
			mute: options.selfMute,
			shardId: options.shardId && !Number.isNaN(options.shardId) ? options.shardId : 0,
		});

		const player = new Player(this, shoukaku, {
			guildId: options.guildId,
			voiceId: options.voiceId,
			textId: options.textId,
			selfDeaf: options.selfDeaf,
			selfMute: options.selfDeaf,
			shardId: options.shardId && !Number.isNaN(options.shardId) ? options.shardId : 0,
			volume: Number.isNaN(Number(options.volume)) ? 100 : options.volume,
		});

		this.players.set(player.guildId, player);
		this.emit("playerCreate", player);

		return player;
	}

	/**
	 *
	 * Make a new search with a specific query.
	 * @param query The query to search.
	 * @param options The options of the search.
	 * @returns {Promise<SearchResult>} Seach result object.
	 */
	public async search(query: string, options: QueryOptions): Promise<SearchResult> {
		let node: Node | undefined = undefined;

		const engine = options.engine ?? this.options.defaultSearchEngine!;
		const isUrl = /^https?:\/\/.*/.test(query);
		const search = isUrl ? query : `${engine}:${query}`;

		if (options.node) {
			if (typeof options.node === "string") node = this.shoukaku.nodes.get(options.node);
			else node = this.shoukaku.nodes.get(options.node.name);
		} else {
			node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
		}

		if (!node) throw new PlayerError("No nodes avaible.");

		const res = await node.rest.resolve(search);
		if (!res)
			return {
				loadType: LoadType.EMPTY,
				tracks: [],
				playlist: undefined,
			};

		switch (res.loadType) {
			case LoadType.ERROR: {
				return {
					loadType: res.loadType,
					tracks: [],
					playlist: undefined,
					error: res.data,
				};
			}

			case LoadType.EMPTY: {
				return {
					loadType: res.loadType,
					tracks: [],
					playlist: undefined,
					error: undefined,
				};
			}

			case LoadType.PLAYLIST: {
				return {
					loadType: res.loadType,
					playlist: res.data.info,
					tracks: res.data.tracks.map((t) => new Track(t, options.requester)),
				};
			}

			case LoadType.TRACK: {
				return {
					loadType: res.loadType,
					tracks: [new Track(res.data, options.requester)],
					error: undefined,
					playlist: undefined,
				};
			}

			case LoadType.SEARCH: {
				return {
					loadType: res.loadType,
					error: undefined,
					playlist: undefined,
					tracks: res.data.map((t) => new Track(t, options.requester)),
				};
			}
		}
	}
}
