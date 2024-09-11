import { Connection, Constants, type Node, Player, type VoiceChannelOptions } from "shoukaku";
import type { PlayerOptions } from "../../types";
import type { Manager } from "../../classes/manager/Manager";
import { PlayerError } from "../../classes";

/**
 *
 * Create a connection of Shoukaku.
 * @param this The manager instance.
 * @param options The options of the player.
 * @param options The options of the voice channel.
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
		shardId: options.shardId!,
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
		let node: Node | undefined;

		if (options.node) {
			if (typeof options.node === "string")
				node = this.shoukaku.nodes.get(options.node) ?? (await this.getLeastUsedNode());
			else
				node =
					this.shoukaku.nodes.get(options.node.name) ?? (await this.getLeastUsedNode());
		} else {
			node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
		}

		if (!node) throw new PlayerError("No node found.");

		this.emit(
			"debug",
			`[Connection -> Player] Creating new player for guild: ${connection.guildId}`,
		);

		const player = new Player(connection.guildId, node);
		const onUpdate = (state: Constants.VoiceState) => {
			if (state !== Constants.VoiceState.SESSION_READY) return;
			player.sendServerUpdate(connection);
		};

		await player.sendServerUpdate(connection);

		connection.on("connectionUpdate", onUpdate);

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
