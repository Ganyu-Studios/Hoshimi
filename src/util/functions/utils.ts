import { MergeError } from "../../classes/Errors";
import type { TrackRequester } from "../../classes/Track";
import { DebugLevels, type DeepRequired, type RestOrArray } from "../../types/Manager";
import type { PlayerScope } from "../../types/Player";
import type { UpdatePlayerInfo } from "../../types/Rest";
import type { NodeStructure, PlayerStructure } from "../../types/Structures";
import type { PromiseWithResolvers } from "../../types/Utility";

/**
 *
 * Apply an incoming player update to the local player state.
 * @param {NodeStructure} node The node the update came from.
 * @param {Partial<UpdatePlayerInfo>} data The data to apply.
 * @returns {void}
 */
export function updatePlayerState(node: NodeStructure, data: Partial<UpdatePlayerInfo>): void {
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
 * Whether a payload dispatched to this player should be dropped because the player is gone, or on
 * its way out.
 *
 * {@link PlayerStructure.destroy} unregisters the player only after awaiting the node, so both
 * Lavalink and the gateway keep delivering payloads for a player that is already tearing down: the
 * REST delete makes the track stop, and the resulting event lands while that request is still
 * pending. Handling it would advance and re-persist a queue that has just been thrown away.
 * @param {PlayerStructure} player The player the payload was dispatched to.
 * @param {PlayerScope} scope The subsystem handling the payload, for the debug line.
 * @returns {boolean} Whether the payload should be ignored.
 */
export function isPlayerGone(player: PlayerStructure, scope: PlayerScope): boolean {
    if (!player.destroyed) return false;

    player.manager.debug(
        DebugLevels.Player,
        `[Player] -> [${scope}] Player for guild: ${player.guildId} is destroyed, skipping ${scope} handling.`,
    );

    return true;
}

/**
 *
 * Make a value safe to send as an HTTP header.
 * @description Node throws `ERR_INVALID_CHAR` for anything outside printable ASCII, and `Client-Name` carries the bot's name straight from Discord — an emoji or a non-latin script in it takes the whole connection down. Offending characters are dropped rather than transliterated, since the header is only ever read by a human in the node's logs.
 * @param {string} value The value to clean.
 * @param {string} fallback The value to use when nothing printable is left.
 * @returns {string} A value that will not be rejected as a header.
 */
export function toHeaderValue(value: string, fallback: string): string {
    const cleaned: string = value.replace(/[^\x20-\x7E]/g, "").trim();
    return cleaned.length ? cleaned : fallback;
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
