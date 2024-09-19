import { type Manager, ManagerError, PlayerError } from "../../classes";
import { type ManagerOptions, type NonNodePlayerOptions, SearchEngines } from "../../types";

/**
 *
 * Validate the manager options.
 * @param options The manager options.
 */
export function validateManagerOptions(options: ManagerOptions): void {
	const validEngines = Object.values(SearchEngines);

	if (
		typeof options.defaultSearchEngine !== "undefined" &&
		!validEngines.includes(options.defaultSearchEngine)
	)
		throw new ManagerError(
			`Invalid search engine: ${options.defaultSearchEngine} is not a valid search engine.`,
		);
	if (
		typeof options.maxPreviousTracks !== "undefined" &&
		typeof options.maxPreviousTracks !== "number"
	)
		throw new ManagerError("Queue options maxPreviousTracks must be a number.");

	if (typeof options.sendPayload !== "function")
		throw new ManagerError("Send payload must be a function.");
	if (typeof options.autoplayFn !== "undefined" && typeof options.autoplayFn !== "function")
		throw new ManagerError("Autoplay function must be a function.");

	if (!Array.isArray(options.nodes)) throw new ManagerError("Nodes must be an array.");

	if (options.nodes.length === 0) throw new ManagerError("Nodes must have at least one node.");

	for (const node of options.nodes) {
		if (typeof node.name !== "string") throw new ManagerError("Node name must be a string.");
		if (typeof node.url !== "string") throw new ManagerError("Node url must be a string.");
		if (typeof node.auth !== "string") throw new ManagerError("Node auth must be a string.");
		if (typeof node.secure !== "undefined" && typeof node.secure !== "boolean")
			throw new ManagerError("Node secure must be a boolean.");
		if (typeof node.group !== "undefined" && typeof node.group !== "string")
			throw new ManagerError("Node group must be a string.");
	}
}

/**
 *
 * Validate the player options.
 * @param options The player options.
 */
export function validatePlayerOptions(options: NonNodePlayerOptions): void {
	if (typeof options.guildId !== "string") throw new PlayerError("Guild id must be a string.");
	if (typeof options.voiceId !== "string") throw new PlayerError("Voice id must be a string.");
	if (typeof options.textId !== "undefined" && typeof options.textId !== "string")
		throw new PlayerError("Text id must be a string.");
	if (typeof options.shardId !== "undefined" && typeof options.shardId !== "number")
		throw new PlayerError("Shard id must be a number.");

	if (typeof options.selfDeaf !== "undefined" && typeof options.selfDeaf !== "boolean")
		throw new PlayerError("Self deaf must be a boolean.");
	if (typeof options.selfMute !== "undefined" && typeof options.selfMute !== "boolean")
		throw new PlayerError("Self mute must be a boolean.");
	if (typeof options.volume !== "undefined" && typeof options.volume !== "number")
		throw new PlayerError("Volume must be a number.");
}
