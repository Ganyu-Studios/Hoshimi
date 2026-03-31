import { NodeError, OptionError } from "../../classes/Errors";
import type { Node } from "../../classes/node/Node";
import { PlayerStorageAdapter } from "../../classes/storage/adapters/PlayerAdapter";
import { QueueStorageAdapter } from "../../classes/storage/adapters/QueueAdapter";
import type { TrackRequester } from "../../classes/Track";
import type { TimescaleSettings } from "../../types/Filters";
import { DebugLevels, EventNames, type HoshimiOptions, type SearchSource } from "../../types/Manager";
import type { NodeInfo, NodeOptions, PluginNames, SearchQuery, SourceName } from "../../types/Node";
import type { PlayerOptions } from "../../types/Player";
import type { UpdatePlayerInfo } from "../../types/Rest";
import { SourceRegistry } from "../../types/Sources";
import type { NodeStructure, PlayerStructure } from "../../types/Structures";
import { UrlRegex } from "../constants";

/**
 *
 * Validate the manager options.
 * @param {HoshimiOptions} options The options to validate.
 * @returns {void}
 */
export function validateManagerOptions(options: HoshimiOptions): void {
    if (!Array.isArray(options.nodes) || !options.nodes.every(isNode) || !options.nodes.length)
        throw new OptionError("The manager option 'options.nodes' must be a valid array of nodes and atleast one valid node.");
    if (typeof options.sendPayload !== "function")
        throw new OptionError("The manager option 'options.sendPayload' must be a vaid function.");
    if (typeof options.defaultSearchSource !== "undefined" && !SourceRegistry.isRegistered(options.defaultSearchSource))
        throw new OptionError("The manager option 'options.defaultSearchSource' Must be a valid search source.");

    if (typeof options.queueOptions !== "undefined") {
        if (typeof options.queueOptions.maxHistory !== "number")
            throw new OptionError("The manager option 'options.queueOptions.maxPreviousTracks' must be a number.");
        if (typeof options.queueOptions.autoplayFn !== "function")
            throw new OptionError("The manager option 'options.queueOptions.autoplayFn' must be a function.");
        if (typeof options.queueOptions.storage !== "undefined" && !(options.queueOptions.storage instanceof QueueStorageAdapter))
            throw new OptionError("The manager option 'options.queueOptions.storage' must be a valid storage manager.");
        if (typeof options.queueOptions.autoPlay !== "undefined" && typeof options.queueOptions.autoPlay !== "boolean")
            throw new OptionError("The manager option 'options.queueOptions.autoPlay' must be a boolean.");
    }

    if (typeof options.playerOptions !== "undefined") {
        if (!(options.playerOptions.storage instanceof PlayerStorageAdapter))
            throw new OptionError("The manager option 'options.playerOptions.storage' must be a valid storage manager.");
        if (typeof options.playerOptions.requesterFn !== "function")
            throw new OptionError("The manager option 'options.playerOptions.requesterFn' must be a valid function.");

        if (typeof options.playerOptions.onError !== "undefined") {
            if (typeof options.playerOptions.onError.autoDestroy !== "boolean")
                throw new OptionError("The manager option 'options.playerOptions.onError.autoDestroy' must be a boolean.");
            if (typeof options.playerOptions.onError.autoSkip !== "boolean")
                throw new OptionError("The manager option 'options.playerOptions.onError.autoSkip' must be a boolean.");
            if (typeof options.playerOptions.onError.autoStop !== "boolean")
                throw new OptionError("The manager option 'options.playerOptions.onError.autoStop' must be a boolean.");
        }
    }

    if (typeof options.client !== "undefined") {
        if (typeof options.client !== "object") throw new OptionError("The manager option 'options.client' Must be a valid object.");
        if (typeof options.client.id !== "undefined" && typeof options.client.id !== "string")
            throw new OptionError("The manager option 'options.client.id' Must be a valid string.");
        if (typeof options.client.username !== "undefined" && typeof options.client.username !== "string")
            throw new OptionError("The manager option 'options.client.username' must be a valid string.");
    }

    if (typeof options.nodeOptions !== "undefined") {
        if (typeof options.nodeOptions.resumable !== "undefined" && typeof options.nodeOptions.resumable !== "boolean")
            throw new OptionError("The manager option 'options.nodeOptions.resumable' must be a boolean.");
        if (typeof options.nodeOptions.resumeTimeout !== "undefined" && typeof options.nodeOptions.resumeTimeout !== "number")
            throw new OptionError("The manager option 'options.nodeOptions.resumeTimeout' must be a number.");
        if (typeof options.nodeOptions.resumeByLibrary !== "undefined" && typeof options.nodeOptions.resumeByLibrary !== "boolean")
            throw new OptionError("The manager option 'options.nodeOptions.resumeByLibrary' must be a boolean.");
        if (typeof options.nodeOptions.userAgent !== "undefined" && typeof options.nodeOptions.userAgent !== "string")
            throw new OptionError("The manager option 'options.nodeOptions.userAgent' must be a string.");
    }

    if (typeof options.restOptions !== "undefined") {
        if (typeof options.restOptions.resumeTimeout !== "undefined" && typeof options.restOptions.resumeTimeout !== "number")
            throw new OptionError("The manager option 'options.restOptions.resumeTimeout' must be a number.");
    }
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

    if (typeof search.source !== "string") throw new OptionError("The query option 'query.source' must be a valid search source.");

    search.source = validateSource(search.source);

    if (!SourceRegistry.isRegistered(search.source))
        throw new OptionError(`The query option 'query.source' must be a valid search source.`);

    const query: string = search.query.trim();

    const parsed = SourceRegistry.parseQuery(query);
    if (parsed) {
        if (UrlRegex.test(parsed.value)) return parsed.value;
        return SourceRegistry.createIdentifier(parsed.source, parsed.value);
    }

    const isUrl: boolean = UrlRegex.test(query);
    if (isUrl) return query;

    return SourceRegistry.createIdentifier(search.source, query);
}

/**
 *
 * Validate the player options.
 * @param {PlayerOptions} options The player options.
 * @returns {void}
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
 * @param {NodeStructure} node The node to validate the player data for.
 * @param {Partial<UpdatePlayerInfo>} data The data to validate.
 * @returns {void}
 */
export function updatePlayerData(node: NodeStructure, data: Partial<UpdatePlayerInfo>): void {
    if (
        typeof data === "object" &&
        typeof data.playerOptions === "object" &&
        typeof data.guildId === "string" &&
        Object.keys(data.playerOptions).length > 0
    ) {
        const player: PlayerStructure | undefined = node.nodeManager.manager.getPlayer(data.guildId);
        if (!player) return;

        if (typeof data.playerOptions.voice === "object") player.voice.patch(data.playerOptions.voice);
        if (typeof data.playerOptions.paused === "boolean") {
            player.paused = data.playerOptions.paused;
            player.playing = !data.playerOptions.paused;
        }

        if (typeof data.playerOptions.volume === "number") player.volume = data.playerOptions.volume;
        if (typeof data.playerOptions.position === "number") {
            player.lastPosition = data.playerOptions.position;
            player.lastPositionUpdate = Date.now();
        }

        if (typeof data.playerOptions.filters === "object") {
            const timescale: Readonly<TimescaleSettings> = Object.freeze({ ...player.filterManager.data.timescale });

            Object.assign(player.filterManager.data, data.playerOptions.filters);
            player.filterManager.check(timescale);
        }
    }
}

/**
 *
 * Validate the plugins in the node.
 * @param {Node} node The node to validate the plugins for.
 * @param {RestOrArray<string>} plugins The plugins to validate.
 */
export function validateNodePlugins(node: Node, plugins: PluginNames[]): void {
    const info: NodeInfo | null = node.info;
    if (!info) throw new NodeError({ id: node.id, message: "Node is not ready yet." });

    if (node.isNodelink()) {
        node.nodeManager.manager.emit(
            EventNames.Debug,
            DebugLevels.Node,
            `[Node] Skipping plugin validation for node ${node.id} because it is a Nodelink node.`,
        );

        return;
    }

    if (!info.plugins.length)
        throw new NodeError({
            id: node.id,
            message: "No plugins found in the node.",
        });

    const missings: PluginNames[] = plugins.filter((name): boolean => !info.plugins.some((p): boolean => p.name === name));
    if (missings.length)
        throw new NodeError({
            id: node.id,
            message: `The node does not support the following plugins: ${missings.join(", ")}.`,
        });
}

/**
 *
 * Validate the source type.
 * @param {SearchSource | SourceName | string} type The type to validate.
 * @returns {SearchSource} The validated source type.
 */
export function validateSource(type: SearchSource | SourceName | string): SearchSource {
    const source: string | undefined = SourceRegistry.resolve(type);
    if (!source) throw new OptionError(`The source '${type}' is not a valid source.`);

    return source as SearchSource;
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

            if (typeof value === "symbol") return value.toString();
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
 * Get the default requester.
 * @param {TrackRequester} requester The requester to default.
 * @returns {TrackRequester} The default requester.
 */
export function requesterFn<T extends TrackRequester = TrackRequester>(requester: TrackRequester): T {
    if (!requester) return {} as T;
    return requester as T;
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
