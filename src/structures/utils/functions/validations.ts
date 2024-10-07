import type { NodeOption } from "shoukaku";
import { ManagerError, PlayerError, StorageManager, Track } from "../../classes";
import { type ManagerOptions, type NonNodePlayerOptions, SearchEngines } from "../../types";

/**
 *
 * Validate the manager options.
 * @param options The manager options.
 */
export function validateManagerOptions(options: ManagerOptions): void {
	const validEngines = Object.values(SearchEngines);

	if (!options.nodes) throw new ManagerError("options.nodes: The nodes array is required.");

	if (typeof options.storage !== "undefined" && !(options.storage instanceof StorageManager))
		throw new ManagerError(
			"options.storage: Storage manager must be an instance of StorageManager.",
		);
	if (
		typeof options.defaultSearchEngine !== "undefined" &&
		!validEngines.includes(options.defaultSearchEngine)
	)
		throw new ManagerError(
			`options.defaultSearchEngine: Invalid search engine: ${options.defaultSearchEngine} is not a valid search engine.`,
		);
	if (
		typeof options.maxPreviousTracks !== "undefined" &&
		typeof options.maxPreviousTracks !== "number"
	)
		throw new ManagerError(
			"options.maxPreviousTracks: Queue options maxPreviousTracks must be a number.",
		);

	if (typeof options.sendPayload !== "function")
		throw new ManagerError("options.sendPayload: Send payload must be a function.");
	if (typeof options.autoplayFn !== "undefined" && typeof options.autoplayFn !== "function")
		throw new ManagerError("options.autoplayFn: Autoplay function must be a function.");

	if (
		!options.nodes.every((node) => isNode(node)) ||
		!Array.isArray(options.nodes) ||
		!options.nodes.length
	)
		throw new ManagerError(
			"options.nodes: Invalid array of nodes. Nodes must be an array and needs atleast one valid node.",
		);
}

/**
 *
 * Validate the player options.
 * @param options The player options.
 */
export function validatePlayerOptions(options: NonNodePlayerOptions): void {
	if (typeof options.guildId !== "string")
		throw new PlayerError("options.guildId: Guild id must be a string.");
	if (typeof options.voiceId !== "string")
		throw new PlayerError("options.voiceId: Voice id must be a string.");
	if (typeof options.textId !== "undefined" && typeof options.textId !== "string")
		throw new PlayerError("options.textId: Text id must be a string.");
	if (typeof options.shardId !== "undefined" && typeof options.shardId !== "number")
		throw new PlayerError("options.shardId: Shard id must be a number.");

	if (typeof options.selfDeaf !== "undefined" && typeof options.selfDeaf !== "boolean")
		throw new PlayerError("options.selfDeaf: Self deaf must be a boolean.");
	if (typeof options.selfMute !== "undefined" && typeof options.selfMute !== "boolean")
		throw new PlayerError("options.selfMute: Self mute must be a boolean.");
	if (typeof options.volume !== "undefined" && typeof options.volume !== "number")
		throw new PlayerError("options.volume: Volume must be a number.");
}

/**
 *
 * Check if the node is valid.
 * @param node The node to check.
 */
export function isNode(node: NodeOption): boolean {
	return (
		typeof node === "object" &&
		typeof node.name === "string" &&
		typeof node.url === "string" &&
		typeof node.auth === "string" &&
		(typeof node.secure === "undefined" || typeof node.secure === "boolean") &&
		(typeof node.group === "undefined" || typeof node.group === "string")
	);
}

/**
 *
 * Check if the track is valid.
 * @param track The track to check.
 */
export const isTrack = (track: Track): this is Track => track instanceof Track;
