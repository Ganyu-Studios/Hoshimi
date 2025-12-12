import { NodeError, OptionError, ResolveError } from "../../classes/Errors";
import type { Node } from "../../classes/node/Node";
import { StorageAdapter } from "../../classes/queue/adapters/adapter";
import { Track, UnresolvedTrack } from "../../classes/Track";
import { type HoshimiOptions, SearchEngines } from "../../types/Manager";
import type { LavalinkTrack, NodeOptions, PluginNames, SearchQuery, SourceNames, UnresolvedLavalinkTrack } from "../../types/Node";
import type { PlayerOptions } from "../../types/Player";
import type { UpdatePlayerInfo } from "../../types/Rest";
import type { NodeStructure, PlayerStructure } from "../../types/Structures";
import { UrlRegex, ValidEngines, ValidSources } from "../constants";

/**
 *
 * Validate the manager options.
 * @param {HoshimiOptions} options The options to validate.
 * @returns {void} Nothing, yeah, nothing.
 */
export function validateManagerOptions(options: HoshimiOptions): void {
    if (!Array.isArray(options.nodes) || !options.nodes.every(isNode) || !options.nodes.length)
        throw new OptionError("The manager option 'options.nodes' must be a valid array of nodes and atleast one valid node.");
    if (typeof options.sendPayload !== "function")
        throw new OptionError("The manager option 'options.sendPayload' must be a vaid function.");

    if (typeof options.queueOptions !== "undefined" && typeof options.queueOptions.maxPreviousTracks !== "number")
        throw new OptionError("The manager option 'options.queueOptions.maxPreviousTracks' must be a number.");
    if (typeof options.queueOptions !== "undefined" && typeof options.queueOptions.autoplayFn !== "function")
        throw new OptionError("The manager option 'options.queueOptions.autoplayFn' must be a function.");

    if (typeof options.queueOptions?.storage !== "undefined" && !(options.queueOptions.storage instanceof StorageAdapter))
        throw new OptionError("The manager option 'options.queueOptions.storage' must be a valid storage manager.");

    if (typeof options.defaultSearchEngine !== "undefined" && !ValidEngines.includes(options.defaultSearchEngine))
        throw new OptionError("The manager option 'options.defaultSearchEngine' Must be a valid search engine.");
    if (typeof options.client !== "undefined" && typeof options.client !== "object")
        throw new OptionError("The manager option 'options.client' Must be a valid object.");
    if (typeof options.client !== "undefined" && typeof options.client.id !== "undefined" && typeof options.client.id !== "string")
        throw new OptionError("The manager option 'options.client.id' Must be a valid string.");
    if (typeof options.client !== "undefined" && typeof options.client.id !== "undefined" && typeof options.client.username !== "string")
        throw new OptionError("The manager option 'options.client.username' must be a valid string.");
}

/**
 *
 * Validate the query for the node.
 * @param {SearchQuery} search The query to validate.
 * @returns {string} The validated query.
 */
export function validateQuery(search: SearchQuery): string {
    if (typeof search !== "object") throw new OptionError("The 'query' must be a valid object.");
    if (typeof search.query !== "string") throw new OptionError("The query option 'query.query' must be a valid string.");

    if (typeof search.engine !== "string") throw new OptionError("The query option 'query.engine' must be a valid search engine.");

    search.engine = validateEngine(search.engine);

    if (!ValidEngines.includes(search.engine)) throw new OptionError(`The query option 'query.engine' must be a valid search engine.`);

    const query = search.query.trim();

    const engineKey = Object.values(SearchEngines).find((key) => query.toLowerCase().startsWith(key));
    if (engineKey && query.toLowerCase().startsWith(`${engineKey}:`)) {
        const sliced = query.slice(engineKey.length + 1).trim();
        const isUrl = UrlRegex.test(sliced);

        if (isUrl) return sliced;

        return `${engineKey}:${sliced}`;
    }

    const isUrl = UrlRegex.test(query);
    if (isUrl) return query;

    if (search.engine === SearchEngines.FloweryTTS) return `${search.engine}://${query}`;
    if (search.engine !== SearchEngines.Local) return `${search.engine}:${query}`;

    return query;
}

/**
 *
 * Validate the player options.
 * @param {PlayerOptions} options The player options.
 * @returns {void} Nothing, yeah, nothing, again.
 */
export function validatePlayerOptions(options: PlayerOptions): void {
    if (typeof options.guildId !== "string") throw new OptionError("The player option 'options.guildId' must be a string.");
    if (typeof options.voiceId !== "string") throw new OptionError("The player option 'options.voiceId' Must be a string.");
    if (typeof options.textId !== "undefined" && typeof options.textId !== "string")
        throw new OptionError("The player option 'options.textId' Must be a string.");

    if (typeof options.selfDeaf !== "undefined" && typeof options.selfDeaf !== "boolean")
        throw new OptionError("The player option 'options.selfDeaf' Must be a boolean.");
    if (typeof options.selfMute !== "undefined" && typeof options.selfMute !== "boolean")
        throw new OptionError("The player option 'options.selfMute' Mute must be a boolean.");
    if (typeof options.volume !== "undefined" && typeof options.volume !== "number")
        throw new OptionError("The player option 'options.volume' Must be a number.");
}

/**
 *
 * Validate the player data.
 * @param {NodeStructure} this The node to validate the player data for.
 * @param {Partial<UpdatePlayerInfo>} data The data to validate.
 * @returns {void} Nothing.
 */
export function validatePlayerData(this: NodeStructure, data: Partial<UpdatePlayerInfo>): void {
    if (
        typeof data === "object" &&
        typeof data.playerOptions === "object" &&
        typeof data.guildId === "string" &&
        Object.keys(data.playerOptions).length > 0
    ) {
        const player = this.nodeManager.manager.getPlayer(data.guildId);
        if (!player) return;

        if (typeof data.playerOptions.voice === "object") player.voice = data.playerOptions.voice;
        if (typeof data.playerOptions.paused === "boolean") {
            player.paused = data.playerOptions.paused;
            player.playing = !data.playerOptions.paused;
        }

        if (typeof data.playerOptions.volume === "number") player.volume = data.playerOptions.volume;
        if (typeof data.playerOptions.position === "number") player.position = data.playerOptions.position;
    }
}

/**
 *
 * Validate the plugins in the node.
 * @param {Node} node The node to validate the plugins for.
 * @param {RestOrArray<string>} plugins The plugins to validate.
 */
export function validateNodePlugins(node: Node, plugins: PluginNames[]): void {
    const info = node.info;
    if (!info) throw new NodeError({ id: node.id, message: "Node is not ready yet." });

    if (!info.plugins.length)
        throw new NodeError({
            id: node.id,
            message: "No plugins found in the node.",
        });

    const missings = plugins.filter((name) => !info.plugins.some((p) => p.name === name));
    if (missings.length)
        throw new NodeError({
            id: node.id,
            message: `The node does not support the following plugins: ${missings.join(", ")}.`,
        });
}

/**
 *
 * Validate the engine type.
 * @param {SearchEngines | SourceNames} type The type to validate.
 * @returns {SearchEngines} The validated engine type.
 */
export function validateEngine(type: SearchEngines | SourceNames): SearchEngines {
    const source = ValidEngines.find((engine) => engine === type) ?? ValidSources.get(type as SourceNames);
    if (!source) throw new OptionError(`The engine '${type}' is not a valid engine.`);

    return source;
}

/**
 *
 * Resolve a track to a valid track instance.
 * @param {Player} player The player to resolve the track for.
 * @param {Track | UnresolvedTrack | null} track The track to resolve.
 * @returns {Promise<Track | null>} The resolved track.
 * @throws {ResolveError} If the track is not a valid unresolved track.
 */
export function validateTrack(player: PlayerStructure, track: Track | UnresolvedTrack | null): Promise<Track | null> {
    if (!track) return Promise.resolve(null);

    if (isTrack(track)) return Promise.resolve(new Track(track, track.requester));

    if (!isUnresolvedTrack(track)) throw new ResolveError("The track is not a valid unresolved track.");

    if (!track.resolve || typeof track.resolve !== "function") return new UnresolvedTrack(track, track.requester).resolve(player);

    return track.resolve(player);
}

/**
 *
 * Check if the track is a Lavalink track.
 * @param {Track | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} If the track is a Lavalink track.
 */
export const isTrack = (track: Track | LavalinkTrack | UnresolvedLavalinkTrack): track is Track | LavalinkTrack => {
    if (!track) return false;
    return (
        typeof track.encoded === "string" && typeof track.info === "object" && !("resolve" in track && typeof track.resolve === "function")
    );
};

/**
 *
 * Check if the track is an unresolved track.
 * @param {Track | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} If the track is an unresolved track.
 */
export function isUnresolvedTrack(
    track: Track | LavalinkTrack | UnresolvedLavalinkTrack,
): track is UnresolvedTrack | UnresolvedLavalinkTrack {
    if (!track) return false;

    return (
        typeof track.encoded === "string" ||
        (typeof track.info === "object" &&
            typeof track.info.title === "string" &&
            "resolve" in track &&
            typeof track.resolve === "function")
    );
}

/**
 *
 * Check if the value is valid (not undefined or null).
 * @param {unknown} value
 * @returns {boolean} True if the value is valid, false otherwise.
 */
export function isValid(value: unknown): boolean {
    return typeof value !== "undefined" && value !== null;
}

/**
 *
 * Stringify a value, handling circular references, functions, symbols, and bigints.
 * @param {unknown} value The value to stringify.
 * @param {string | number} [space] The space to use for indentation.
 * @returns {string} The stringified value.
 */
export function stringify(value: unknown, space?: string | number): string {
    const seen = new WeakSet();

    return JSON.stringify(
        value,
        (_, value) => {
            if (typeof value === "function") return undefined;
            if (typeof value === "symbol") return undefined;

            if (typeof value === "bigint") return value.toString();
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) return undefined;

                seen.add(value);

                return value;
            }

            return value;
        },
        space,
    );
}

/**
 *
 * Validate if the node options are correct.
 * @param {NodeOptions} options The node options to validate.
 * @returns {boolean} If the node options are correct.
 */
function isNode(options: NodeOptions): boolean {
    return (
        typeof options.host === "string" &&
        typeof options.port === "number" &&
        typeof options.password === "string" &&
        (typeof options.id === "string" || typeof options.id === "undefined") &&
        (typeof options.secure === "boolean" || typeof options.secure === "undefined") &&
        (typeof options.sessionId === "string" || typeof options.sessionId === "undefined") &&
        (typeof options.retryAmount === "number" || typeof options.retryAmount === "undefined") &&
        (typeof options.retryDelay === "number" || typeof options.retryDelay === "undefined")
    );
}
