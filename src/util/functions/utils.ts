import { MergeError, OptionError } from "../../classes/Errors";
import { QueueStorageAdapter } from "../../classes/storage/adapters/QueueAdapter";
import type { TrackRequester, TrackResolvableStructure } from "../../classes/Track";
import { Track, UnresolvedTrack } from "../../classes/Track";
import { type ParsedQuery, SourceRegistry } from "../../registry/SourceRegistry";
import type { DeepRequired, HoshimiOptions, RestOrArray, SearchSource } from "../../types/Manager";
import type { LavalinkTrack, NodeOptions, PlayerMoveFilter, SearchQuery, SourceName, UnresolvedLavalinkTrack } from "../../types/Node";
import type { AnyLavalinkTrack, PlayerOptions } from "../../types/Player";
import type { TrackJSON } from "../../types/Queue";
import type { UpdatePlayerInfo } from "../../types/Rest";
import type { NodeStructure, PlayerStructure, TrackStructure } from "../../types/Structures";
import type { PromiseWithResolvers } from "../../types/Utility";
import { UrlRegex } from "../constants";

/**
 * Check whether a track is a local Track instance (resolved).
 * Only returns true for Track class instances (not generic LavalinkTrack objects).
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a local resolved Track instance.
 */
function isResolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is TrackStructure {
    if (!track) return false;
    // Use instanceof to ensure it's a Track class instance, not just a LavalinkTrack object
    // A resolved track has encoded and info, and no resolve function
    return (
        track instanceof Track &&
        typeof track.encoded === "string" &&
        typeof track.info === "object" &&
        !("resolve" in track && typeof track.resolve === "function") &&
        "requester" in track &&
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
function isUnresolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is UnresolvedTrack {
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
function isLavalinkResolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is LavalinkTrack {
    if (!track || typeof track !== "object") return false;
    // Must have encoded and info, and NOT be a Track instance, and NOT have resolve
    return (
        !(track instanceof Track) &&
        typeof track.encoded === "string" &&
        typeof track.info === "object" &&
        !("resolve" in track && typeof track.resolve === "function") &&
        "requester" in track
    );
}

/**
 * Check whether a track is a Lavalink-compatible unresolved track (not a local UnresolvedTrack instance).
 * Returns true for UnresolvedLavalinkTrack objects that have a resolve-like structure but are not UnresolvedTrack instances.
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a Lavalink unresolved track (not a local UnresolvedTrack).
 */
function isLavalinkUnresolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is UnresolvedLavalinkTrack {
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
 * Check whether a track is a stored track (has the structure of a TrackJSON object).
 * This is used to identify tracks that come from storage and need to be transformed back into Track instances.
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a stored track (TrackJSON structure).
 */
function isStoredTrack(track: TrackResolvableStructure | AnyLavalinkTrack): track is TrackJSON {
    if (!track || typeof track !== "object") return false;
    return (
        typeof track.encoded === "string" &&
        typeof track.info === "object" &&
        typeof track.info.title === "string" &&
        "requester" in track &&
        typeof track.requester !== "undefined"
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
        (typeof options.retryDelay === "number" || typeof options.retryDelay === "undefined") &&
        (typeof options.restTimeout === "number" || typeof options.restTimeout === "undefined") &&
        (typeof options.heartbeat === "object" || typeof options.heartbeat === "undefined") &&
        (typeof options.closeOnError === "boolean" || typeof options.closeOnError === "undefined") &&
        (typeof options.heartbeat?.interval === "number" || typeof options.heartbeat?.interval === "undefined") &&
        (typeof options.heartbeat?.statsTimeout === "number" || typeof options.heartbeat?.statsTimeout === "undefined")
    );
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

    if (isPlainObject(options.queueOptions)) {
        if (typeof options.queueOptions.maxHistory !== "undefined" && typeof options.queueOptions.maxHistory !== "number")
            throw new OptionError("The manager option 'options.queueOptions.maxHistory' must be a number.");
        if (typeof options.queueOptions.autoplayFn !== "undefined" && typeof options.queueOptions.autoplayFn !== "function")
            throw new OptionError("The manager option 'options.queueOptions.autoplayFn' must be a function.");
        if (typeof options.queueOptions.storage !== "undefined" && !(options.queueOptions.storage instanceof QueueStorageAdapter))
            throw new OptionError("The manager option 'options.queueOptions.storage' must be a valid storage manager.");
        if (typeof options.queueOptions.autoPlay !== "undefined" && typeof options.queueOptions.autoPlay !== "boolean")
            throw new OptionError("The manager option 'options.queueOptions.autoPlay' must be a boolean.");
    }

    if (isPlainObject(options.playerOptions)) {
        if (typeof options.playerOptions.requesterFn !== "function")
            throw new OptionError("The manager option 'options.playerOptions.requesterFn' must be a valid function.");

        if (isPlainObject(options.playerOptions.onError)) {
            if (
                typeof options.playerOptions.onError.autoDestroy !== "undefined" &&
                typeof options.playerOptions.onError.autoDestroy !== "boolean"
            )
                throw new OptionError("The manager option 'options.playerOptions.onError.autoDestroy' must be a boolean.");
            if (
                typeof options.playerOptions.onError.autoStop !== "undefined" &&
                typeof options.playerOptions.onError.autoStop !== "boolean"
            )
                throw new OptionError("The manager option 'options.playerOptions.onError.autoStop' must be a boolean.");
        }
    }

    if (isPlainObject(options.client)) {
        if (typeof options.client !== "object") throw new OptionError("The manager option 'options.client' Must be a valid object.");
        if (typeof options.client.id !== "undefined" && typeof options.client.id !== "string")
            throw new OptionError("The manager option 'options.client.id' Must be a valid string.");
        if (typeof options.client.username !== "undefined" && typeof options.client.username !== "string")
            throw new OptionError("The manager option 'options.client.username' must be a valid string.");
    }

    if (isPlainObject(options.nodeOptions)) {
        if (typeof options.nodeOptions.closeOnError !== "undefined" && typeof options.nodeOptions.closeOnError !== "boolean")
            throw new OptionError("The manager option 'options.nodeOptions.closeOnError' must be a boolean.");

        if (isPlainObject(options.nodeOptions.sessionOptions)) {
            if (
                typeof options.nodeOptions.sessionOptions.resumable !== "undefined" &&
                typeof options.nodeOptions.sessionOptions.resumable !== "boolean"
            )
                throw new OptionError("The manager option 'options.nodeOptions.resumable' must be a boolean.");
            if (
                typeof options.nodeOptions.sessionOptions.timeout !== "undefined" &&
                typeof options.nodeOptions.sessionOptions.timeout !== "number"
            )
                throw new OptionError("The manager option 'options.nodeOptions.resumeTimeout' must be a number.");
            if (
                typeof options.nodeOptions.sessionOptions.byLibrary !== "undefined" &&
                typeof options.nodeOptions.sessionOptions.byLibrary !== "boolean"
            )
                throw new OptionError("The manager option 'options.nodeOptions.resumeByLibrary' must be a boolean.");
        }

        if (isPlainObject(options.nodeOptions.moveOptions)) {
            if (typeof options.nodeOptions.moveOptions !== "object")
                throw new OptionError("The manager option 'options.nodeOptions.moveOptions' must be a valid object.");
            if (typeof options.nodeOptions.moveOptions.move !== "undefined" && typeof options.nodeOptions.moveOptions.move !== "boolean")
                throw new OptionError("The manager option 'options.nodeOptions.moveOptions.move' must be a boolean.");
            if (typeof options.nodeOptions.moveOptions.filterBy !== "undefined") {
                const filterBy: PlayerMoveFilter = options.nodeOptions.moveOptions.filterBy;
                if (typeof filterBy !== "string" && typeof filterBy !== "function")
                    throw new OptionError(
                        "The manager option 'options.nodeOptions.moveOptions.filterBy' must be a valid NodeSortTypes string or a function.",
                    );
            }
        }

        if (isPlainObject(options.nodeOptions.heartbeatOptions)) {
            if (
                typeof options.nodeOptions.heartbeatOptions.interval !== "undefined" &&
                typeof options.nodeOptions.heartbeatOptions.interval !== "number"
            )
                throw new OptionError("The manager option 'options.nodeOptions.heartbeatOptions.interval' must be a number.");
            if (
                typeof options.nodeOptions.heartbeatOptions.statsTimeout !== "undefined" &&
                typeof options.nodeOptions.heartbeatOptions.statsTimeout !== "number"
            )
                throw new OptionError("The manager option 'options.nodeOptions.heartbeatOptions.statsTimeout' must be a number.");
        }

        if (typeof options.nodeOptions.userAgent !== "undefined" && typeof options.nodeOptions.userAgent !== "string")
            throw new OptionError("The manager option 'options.nodeOptions.userAgent' must be a string.");
    }

    if (isPlainObject(options.restOptions)) {
        if (typeof options.restOptions.resumeTimeout !== "undefined" && typeof options.restOptions.resumeTimeout !== "number")
            throw new OptionError("The manager option 'options.restOptions.resumeTimeout' must be a number.");
        if (typeof options.restOptions.restTimeout !== "undefined" && typeof options.restOptions.restTimeout !== "number")
            throw new OptionError("The manager option 'options.restOptions.restTimeout' must be a number.");
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
            Object.assign(player.filterManager.data, data.playerOptions.filters);
        }
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
 * Check if the value is a non-null object (excluding arrays).
 * @param {unknown} value The value to check.
 * @returns {boolean} True if the value is a non-null object, false otherwise.
 */
export const isObject = (value: unknown): value is Record<string, any> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/**
 *
 * Check if the value is a plain object (not an instance of a class, array, or other non-plain object).
 * @param {unknown} value The value to check.
 * @returns {boolean} True if the value is a plain object, false otherwise.
 */
export function isPlainObject(value: unknown): value is Record<string, any> {
    if (!isObject(value)) return false;

    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/**
 *
 * Merge the given options with the default options, filling in any missing values from the default.
 * @param {T} def The default options to merge with the given options. This should be a complete object with all default values.
 * @param {T} given The given options to merge with the default options. This can be a partial object where only some values are provided.
 * @returns {DeepRequired<T>} The merged options where all missing values from the given options are filled in with the default values. The returned object is fully required (no optional properties) because all defaults are applied.
 */
export function mergeDefault<T extends Record<string, any>>(def: T, given: T): DeepRequired<T> {
    if (!given) return def as DeepRequired<T>;

    const mergeRecursive = (defObj: Record<string, any>, givenObj: Record<string, any> | undefined, path: string = ""): any => {
        if (givenObj !== undefined && !isPlainObject(givenObj) && !isPlainObject(defObj)) {
            return givenObj;
        }

        const target: Record<string, any> = isPlainObject(givenObj) ? { ...givenObj } : {};
        const defaultKeys: string[] = Object.keys(defObj);

        for (const key in target) {
            if (!defaultKeys.includes(key)) delete target[key];
        }

        for (const key of defaultKeys) {
            const defValue = defObj[key];
            const givenValue = target[key];
            const keyPath = path ? `${path}.${key}` : key;

            if (defValue === null || (typeof defValue === "string" && defValue.length === 0)) {
                if (givenValue === undefined || givenValue === null || (typeof givenValue === "string" && givenValue.length === 0)) {
                    throw new MergeError(`${keyPath} was not found from the given options.`);
                }
            }

            if (isPlainObject(defValue)) {
                target[key] = mergeRecursive(defValue, givenValue, keyPath);
            } else {
                target[key] = givenValue ?? defValue;
            }
        }

        return target;
    };

    return mergeRecursive(def, given) as DeepRequired<T>;
}

/**
 *
 * Get the default requester.
 * @param {TrackRequester} requester The requester to default.
 * @returns {TrackRequester} The default requester.
 */
export function requesterFn<T>(requester: TrackRequester): T {
    if (!requester || typeof requester !== "object" || !Object.keys(requester).length) return {} as T;
    return requester as T;
}

/**
 *
 * Flatten an item or an array of items into a single array.
 * @param {T | T[]} items The item or array of items to flatten.
 * @returns {T[]} The flattened array.
 */
export function flatten<T>(items: T | T[]): T[] {
    const array: T[] = [];
    return array.concat(items);
}

/**
 *
 * Converts a rest or array input into a flat array.
 * @template T The type of elements in the input.
 * @param {RestOrArray<T>} input The input to convert.
 * @returns {T[]} The flattened array of elements.
 */
export function toArray<T>(input: RestOrArray<T>): T[] {
    if (!input.length) return [];
    return input.flat() as T[];
}

/**
 *
 * Normalizes a string by trimming whitespace and converting to lowercase.
 * @param {string} input The string to normalize.
 * @returns {string} The normalized string.
 */
export function normalize(input: string): string {
    return input.trim().toLowerCase();
}

/**
 * This type represents a value that can be censored.
 */
type Censurable = string | object;

/**
 * Options for the censoring operation.
 */
interface CensorOptions<T extends Censurable> {
    /**
     * The data to censor (string or object).
     * @type {T}
     */
    data: T;
    /**
     * The symbol to use for censoring (default is "*").
     * @type {string}
     * @default "*"
     */
    symbol?: string;
    /**
     * Specific keys to censor (only applicable if `data` is an object).
     * @type {(keyof T)[]}
     * @default undefined
     */
    keys?: (keyof T)[];
}

/**
 *
 * Censors a string or an object by replacing its content with a specified symbol.
 * @param {CensorOptions<T>} options The options for the censoring operation.
 * @param {T} options.data The data to censor (string or object).
 * @param {string} [options.symbol="*"] The symbol to use for censoring (default is "*").
 * @param {(keyof T)[]} [options.keys] Specific keys to censor (only applicable if `data` is an object).
 * @returns {T} The censored data, with strings replaced by the symbol and object properties censored as specified.
 */
export function censor<T extends Censurable>(options: CensorOptions<T>): T {
    const { data, symbol = "*", keys } = options;

    if (typeof data === "string") return symbol.repeat(data.length) as T;

    const result = { ...data } as Record<string, unknown>;

    for (const key in result) {
        const shouldCensor = !keys || keys.includes(key as keyof T);
        if (!shouldCensor) continue;

        const value = result[key];

        if (typeof value === "string") {
            result[key] = symbol.repeat(value.length);
        } else if (typeof value === "object" && value !== null) {
            result[key] = censor({ data: value as Censurable, symbol });
        } else if (value !== undefined && value !== null) {
            result[key] = symbol;
        }
    }

    return result as T;
}

/**
 * Create a promise with resolvers.
 */
export function createResolver<T>() {
    const resolver = {} as PromiseWithResolvers<T>;

    resolver.promise = new Promise<T>((resolve, reject) => {
        resolver.reject = reject;
        resolver.resolve = resolve;
    });

    return resolver;
}

/**
 *
 * A collection of utility functions for track resolution and type checking.
 * @constant
 */
export const TrackResolution = {
    isResolved,
    isUnresolved,
    isLavalinkResolved,
    isLavalinkUnresolved,
    isStoredTrack,
} as const;
