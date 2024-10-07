import {
	Shoukaku,
	type Connector,
	Utils,
	type ShoukakuOptions,
	type Node,
	Constants,
	LoadType,
} from "shoukaku";
import {
	SearchEngines,
	type ManagerEvents,
	type ManagerOptions,
	type PlayerOptions,
	type QueryOptions,
	type SearchResult,
} from "../../types";
import { validateManagerOptions, validatePlayerOptions } from "../../utils";
import { Player } from "./Player";
import { Track } from "./Track";
import { PlayerError } from "./Error";
import { LocalStorage } from "../queue/Storage";

/**
 * The purpose of this, is to make the ManagerEvents interface extendable.
 * To add new events, just add them to the ManagerEvents interface.
 */
type Events = {
	[K in keyof ManagerEvents]: ManagerEvents[K];
};

/**
 * Main Manager class.
 */
export class Manager extends Utils.TypedEventEmitter<Events> {
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
	 * @param options Manager options.
	 * @param shoukaku Shoukaku options.
	 */
	constructor(connector: Connector, options: ManagerOptions, shoukaku?: ShoukakuOptions) {
		super();

		this.options = {
			...options,
			sendPayload: options.sendPayload,
			autoplayFn: options.autoplayFn ?? undefined,
			defaultSearchEngine: options.defaultSearchEngine ?? SearchEngines.Youtube,
			maxPreviousTracks: options.maxPreviousTracks ?? 25,
			storage: options.storage ?? new LocalStorage(),
		};

		validateManagerOptions(this.options);

		this.shoukaku = new Shoukaku(connector, options.nodes, shoukaku);
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
		validatePlayerOptions(options);

		if (this.players.has(options.guildId)) return this.players.get(options.guildId)!;

		options.selfDeaf ??= true;
		options.selfMute ??= false;

		if (this.shoukaku.connections.has(options.guildId) && this.players.has(options.guildId))
			return this.getPlayer(options.guildId)!;

		if (
			this.shoukaku.connections.has(options.guildId) &&
			!this.shoukaku.players.has(options.guildId)
		) {
			this.shoukaku.connections.get(options.guildId)!.disconnect();
		}

		const shoukaku = await this.shoukaku.joinVoiceChannel({
			guildId: options.guildId,
			channelId: options.voiceId,
			shardId: options.shardId && !Number.isNaN(options.shardId) ? options.shardId : 0,
			deaf: options.selfDeaf,
			mute: options.selfMute,
		});

		const player = new Player(this, shoukaku, {
			guildId: options.guildId,
			voiceId: options.voiceId,
			textId: options.textId,
			selfDeaf: options.selfDeaf,
			selfMute: options.selfMute,
			shardId: options.shardId && !Number.isNaN(options.shardId) ? options.shardId : 0,
			volume: options.volume && !Number.isNaN(options.volume) ? options.volume : 100,
		});

		player.connected = true;

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
			const nodeName = typeof options.node === "string" ? options.node : options.node.name;
			node = this.shoukaku.nodes.get(nodeName) ?? (await this.getLeastUsedNode());
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
