import { NodeError, OptionError } from "../../classes/Errors";
import type { Node } from "../../classes/node/Node";
import { PlayerStorageAdapter } from "../../classes/storage/adapters/PlayerAdapter";
import { QueueStorageAdapter } from "../../classes/storage/adapters/QueueAdapter";
import type { TrackRequester, TrackResolvableStructure } from "../../classes/Track";
import { Track, UnresolvedTrack } from "../../classes/Track";
import type { TimescaleSettings } from "../../types/Filters";
import { DebugLevels, EventNames, type HoshimiOptions, type SearchSource } from "../../types/Manager";
import type { LavalinkTrack, NodeInfo, NodeOptions, PluginNames, SearchQuery, SourceName, UnresolvedLavalinkTrack } from "../../types/Node";
import type { AnyLavalinkTrack, PlayerOptions } from "../../types/Player";
import type { UpdatePlayerInfo } from "../../types/Rest";
import { type ParsedQuery, SourceRegistry } from "../../types/Sources";
import type { NodeStructure, PlayerStructure, TrackStructure } from "../../types/Structures";
import { UrlRegex } from "../constants";

interface ValidateNodePluginsOptions {
    /**
     * The node to validate the plugins for.
     * @type {Node}
     */
    node: Node;
    /**
     * Array of required plugins that must all be present.
     * @type {PluginNames[]}
     * @default []
     */
    required?: PluginNames[];
    /**
     * Array of optional plugins where at least one must be present (when atleastOne is true).
     * @type {PluginNames[]}
     * @default []
     */
    optional?: PluginNames[];
    /**
     * Whether to validate that at least one optional plugin is available.
     * If false, validates that all required plugins are available.
     * @type {boolean}
     * @default false
     */
    atleastOne?: boolean;
}

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

    const parsed: ParsedQuery | null = SourceRegistry.parseQuery(query);
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
 * Validates that all required plugins are present in the node.
 * @param {NodeInfo} info The node information containing plugin list.
 * @param {PluginNames[]} required Array of required plugin names.
 * @param {string} nodeId The node ID for error reporting.
 * @throws {NodeError} If any required plugin is missing.
 * @example
 * ```ts
 * validateRequiredPlugins(node.info, [PluginNames.LavaLyrics], node.id);
 * ```
 */
function validateRequiredPlugins(info: NodeInfo, required: PluginNames[], nodeId: string): void {
    const missings: PluginNames[] = required.filter((name): boolean => !info.plugins.some((p): boolean => p.name === name));

    if (missings.length) {
        throw new NodeError({
            id: nodeId,
            message: `The node does not support the following plugins: ${missings.join(", ")}.`,
        });
    }
}

/**
 * Validates that at least one optional plugin is present in the node.
 * @param {NodeInfo} info The node information containing plugin list.
 * @param {PluginNames[]} optional Array of optional plugin names (at least one must be present).
 * @param {string} nodeId The node ID for error reporting.
 * @throws {NodeError} If none of the optional plugins are available.
 * @example
 * ```ts
 * validateOptionalPlugins(node.info, [PluginNames.LavaLyrics, PluginNames.JavaLyrics], node.id);
 * ```
 */
function validateOptionalPlugins(info: NodeInfo, optional: PluginNames[], nodeId: string): void {
    const isAnyPluginActive: boolean = optional.some((name): boolean => info.plugins.some((p): boolean => p.name === name));
    if (!isAnyPluginActive) {
        throw new NodeError({
            id: nodeId,
            message: `The node does not support at least one of the following plugins: ${optional.join(", ")}.`,
        });
    }
}

/**
 * Validate the plugins in the node based on required and optional specifications.
 * Ensures the node supports the necessary plugins for operation.
 * @param {ValidateNodePluginsOptions} options The options to validate the node plugins.
 * @throws {NodeError} If the node is not ready, has no plugins, or validation fails.
 * @returns {void}
 * @example
 * ```ts
 * // Validate that all required plugins are present
 * validateNodePlugins({
 *   node,
 *   required: [PluginNames.LavaLyrics]
 * });
 *
 * // Validate that at least one optional plugin is present
 * validateNodePlugins({
 *   node,
 *   optional: [PluginNames.LavaLyrics, PluginNames.JavaLyrics],
 *   atleastOne: true
 * });
 *
 * // Validate both required and optional plugins
 * validateNodePlugins({
 *   node,
 *   required: [PluginNames.LavaLyrics],
 *   optional: [PluginNames.JavaLyrics],
 *   atleastOne: true
 * });
 * ```
 */
export function validateNodePlugins(options: ValidateNodePluginsOptions): void {
    // Check if node information is available
    const info: NodeInfo | null = options.node.info;
    if (!info) throw new NodeError({ id: options.node.id, message: "Node is not ready yet." });

    // Skip plugin validation for Nodelink nodes (they handle plugins differently)
    if (options.node.isNodelink()) {
        options.node.nodeManager.manager.emit(
            EventNames.Debug,
            DebugLevels.Node,
            `[Node] Skipping plugin validation for node ${options.node.id} because it is a Nodelink node.`,
        );

        return;
    }

    // Ensure the node has at least one plugin available
    if (!info.plugins.length) {
        throw new NodeError({
            id: options.node.id,
            message: "No plugins found in the node.",
        });
    }

    // Validate required plugins (must all be present)
    if (options.required?.length) {
        validateRequiredPlugins(info, options.required, options.node.id);
    }

    // Validate optional plugins (at least one must be present when atleastOne is true)
    if (options.atleastOne && options.optional?.length) {
        validateOptionalPlugins(info, options.optional, options.node.id);
    }
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
 * Check whether a track is a local Track instance (resolved).
 * Only returns true for Track class instances (not generic LavalinkTrack objects).
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a local resolved Track instance.
 */
export function isResolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is TrackStructure {
    if (!track) return false;
    // Use instanceof to ensure it's a Track class instance, not just a LavalinkTrack object
    // A resolved track has encoded and info, and no resolve function
    return (
        track instanceof Track &&
        typeof track.encoded === "string" &&
        typeof track.info === "object" &&
        !("resolve" in track && typeof track.resolve === "function") &&
        typeof track.requester !== "undefined" &&
        typeof track.info.title === "string"
    );
}

/**
 * Check whether a track is a local UnresolvedTrack instance (unresolved).
 * Only returns true for UnresolvedTrack class instances.
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a local unresolved UnresolvedTrack instance.
 */
export function isUnresolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is UnresolvedTrack {
    if (!track) return false;
    // Use instanceof to ensure it's an UnresolvedTrack class instance
    return (
        track instanceof UnresolvedTrack &&
        "resolve" in track &&
        typeof track.resolve === "function" &&
        typeof track.requester !== "undefined" &&
        typeof track.info === "object" &&
        typeof track.info.title === "string"
    );
}

/**
 * Check whether a track is a Lavalink-compatible resolved track (not a local Track instance).
 * Returns true for LavalinkTrack objects that have encoded and info but are not Track class instances.
 * This is for raw Lavalink track objects from the API or other sources.
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a Lavalink resolved track (not a local Track).
 */
export function isLavalinkResolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is LavalinkTrack {
    if (!track || typeof track !== "object") return false;
    // Must have encoded and info, and NOT be a Track instance, and NOT have resolve
    return (
        !(track instanceof Track) &&
        typeof track.encoded === "string" &&
        typeof track.info === "object" &&
        !("resolve" in track && typeof track.resolve === "function")
    );
}

/**
 * Check whether a track is a Lavalink-compatible unresolved track (not a local UnresolvedTrack instance).
 * Returns true for UnresolvedLavalinkTrack objects that have a resolve-like structure but are not UnresolvedTrack instances.
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a Lavalink unresolved track (not a local UnresolvedTrack).
 */
export function isLavalinkUnresolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is UnresolvedLavalinkTrack {
    if (!track || typeof track !== "object") return false;
    // Must have info and NOT be an UnresolvedTrack instance, and should not have the resolve function
    return (
        !(track instanceof UnresolvedTrack) &&
        "info" in track &&
        typeof track.info === "object" &&
        typeof track.info?.title === "string" &&
        !("resolve" in track && typeof track.resolve === "function")
    );
}

/**
 *
 * Check if the value is defined (not undefined or null).
 * @param {unknown} value
 * @returns {boolean} True if the value is defined, false otherwise.
 */
export function isDefined(value: unknown): boolean {
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
export function requesterFn<T>(requester: TrackRequester): T {
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
