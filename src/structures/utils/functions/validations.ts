import { type Manager, ManagerError, PlayerError } from "../../classes";
import { type ManagerOptions, type NonNodePlayerOptions, SearchEngines } from "../../types";

/**
 *
 * Validate the manager options.
 * @param options The manager options.
 */
export function validateManagerOptions(options: ManagerOptions) {
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
}

/**
 *
 * Validate the player options.
 * @param options The player options.
 */
export function validatePlayerOptions(options: NonNodePlayerOptions) {
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

/**
 *
 * Apply default options to the manager.
 * @param this The manager instance.
 * @param options The manager options.
 * @returns
 */
export function applyDefaultOptions(this: Manager, options: ManagerOptions) {
	// Functions reassign
	this.options.sendPayload ??= options.sendPayload;
	this.options.autoplayFn ??= options.autoplayFn ?? undefined;

	// Values reassign
	this.options.defaultSearchEngine ??= options.defaultSearchEngine ?? SearchEngines.Youtube;
	this.options.maxPreviousTracks ??= options.maxPreviousTracks ?? 25;
}
