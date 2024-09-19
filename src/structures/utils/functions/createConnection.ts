import { Connection, Constants, type Node, Player, type VoiceChannelOptions } from "shoukaku";
import type { PlayerOptions } from "../../types";
import type { Manager } from "../../classes/manager/Manager";
import { PlayerError } from "../../classes";

/**
 *
 * Create a connection of Shoukaku.
 * @param this The manager instance.
 * @param options The options of the player.
 * @returns {Promise<Player>} The shoukaku player instance.
 */
export async function createConnection(this: Manager, options: PlayerOptions): Promise<Player> {
	if (
		this.shoukaku.connections.has(options.guildId) &&
		this.shoukaku.players.has(options.guildId)
	)
		return this.shoukaku.players.get(options.guildId)!;
	if (
		this.shoukaku.connections.has(options.guildId) &&
		!this.shoukaku.players.has(options.guildId)
	) {
		this.shoukaku.connections.get(options.guildId)!.disconnect();
	}

	const connection = new Connection(this.shoukaku, {
		channelId: options.voiceId,
		guildId: options.guildId,
		shardId: options.shardId && !Number.isNaN(options.shardId) ? options.shardId : 0,
		deaf: options.selfDeaf,
		mute: options.selfMute,
	});

	this.shoukaku.connections.set(connection.guildId, connection);
	this.emit(
		"debug",
		`[Connection -> Create] Creating connection for guild: ${connection.guildId}.`,
	);

	try {
		await connection.connect();
		this.emit(
			"debug",
			`[Connection -> Create] Connection created for guild: ${connection.guildId}.`,
		);
	} catch (error) {
		this.shoukaku.connections.delete(options.guildId);
		throw error;
	}

	try {
		let node: Node | undefined = undefined;

		if (options.node) {
			const nodeName = typeof options.node === "string" ? options.node : options.node.name;

			node = this.shoukaku.nodes.get(nodeName) ?? (await this.getLeastUsedNode());
		} else {
			node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
		}

		if (!node) throw new PlayerError("No node found.");

		this.emit(
			"debug",
			`[Connection -> Player] Creating new player for guild: ${connection.guildId}`,
		);

		const player = new Player(connection.guildId, node);

		await player.sendServerUpdate(connection);

		connection.on("connectionUpdate", (state: Constants.VoiceState) => {
			if (state !== Constants.VoiceState.SESSION_READY) return;
			player.sendServerUpdate(connection);
		});

		this.shoukaku.players.set(player.guildId, player);
		this.emit("debug", `[Connection -> Player] Player created for guild: ${player.guildId}.`);

		return player;
	} catch (error) {
		connection.disconnect();
		this.emit(
			"debug",
			`[Connection -> Manager] Connection failed for guild: ${options.guildId}.`,
		);
		this.shoukaku.connections.delete(options.guildId);
		throw error;
	}
}
