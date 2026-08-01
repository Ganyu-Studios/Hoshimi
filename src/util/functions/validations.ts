import { OptionError } from "../../classes/Errors";
import { QueueStorageAdapter } from "../../classes/storage/adapters/QueueAdapter";
import { type ParsedQuery, SourceRegistry } from "../../registry/SourceRegistry";
import type { HoshimiOptions, SearchSource } from "../../types/Manager";
import type { NodeOptions, NodeSortFilter, SearchQuery, SourceName } from "../../types/Node";
import type { PlayerOptions } from "../../types/Player";
import { UrlRegex } from "../constants";
import { isPlainObject } from "./utils";

/**
 *
 * Check whether an optional numeric option is a non-negative integer.
 *
 * Every numeric option in Hoshimi is a millisecond timeout, a second timeout, a counter or a size, so
 * `NaN`, `Infinity`, fractional and negative values are always wrong — and they fail silently rather
 * than loudly: `slice(0, NaN)` empties the history, `retryAmount: NaN` never reaches `0` so the node
 * reconnects forever, and `heartbeat.interval: NaN` disables the heartbeat without a word.
 * @param {unknown} value The value to check.
 * @returns {boolean} True when the value is absent or a non-negative integer.
 */
function isOptionalNonNegativeInteger(value: unknown): boolean {
    if (typeof value === "undefined") return true;
    return Number.isInteger(value) && (value as number) >= 0;
}

/**
 *
 * Assert that an optional manager option is a non-negative integer.
 * @param {unknown} value The value to validate.
 * @param {string} option The dotted option path, used in the error message.
 * @throws {OptionError} If the value is present and not a non-negative integer.
 * @returns {void}
 */
function assertNonNegativeInteger(value: unknown, option: string): void {
    if (isOptionalNonNegativeInteger(value)) return;
    throw new OptionError(`The manager option '${option}' must be a non-negative integer.`);
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
        Number.isInteger(options.port) &&
        options.port > 0 &&
        options.port <= 65535 &&
        typeof options.password === "string" &&
        (typeof options.id === "string" || typeof options.id === "undefined") &&
        (typeof options.secure === "boolean" || typeof options.secure === "undefined") &&
        (typeof options.sessionId === "string" || typeof options.sessionId === "undefined") &&
        isOptionalNonNegativeInteger(options.retryAmount) &&
        isOptionalNonNegativeInteger(options.retryDelay) &&
        isOptionalNonNegativeInteger(options.restTimeout) &&
        (typeof options.heartbeat === "object" || typeof options.heartbeat === "undefined") &&
        (typeof options.closeOnError === "boolean" || typeof options.closeOnError === "undefined") &&
        isOptionalNonNegativeInteger(options.heartbeat?.interval)
    );
}

/**
 *
 * Validate the manager options.
 * @param {HoshimiOptions} options The options to validate.
 * @returns {void}
 */
function validateManagerOptions(options: HoshimiOptions): void {
    if (!Array.isArray(options.nodes) || !options.nodes.every(isNode) || !options.nodes.length)
        throw new OptionError("The manager option 'options.nodes' must be a valid array of nodes and atleast one valid node.");
    if (typeof options.sendPayload !== "function")
        throw new OptionError("The manager option 'options.sendPayload' must be a vaid function.");
    if (typeof options.defaultSearchSource !== "undefined" && !SourceRegistry.isRegistered(options.defaultSearchSource))
        throw new OptionError("The manager option 'options.defaultSearchSource' Must be a valid search source.");

    if (isPlainObject(options.queueOptions)) {
        assertNonNegativeInteger(options.queueOptions.maxHistory, "options.queueOptions.maxHistory");

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

            assertNonNegativeInteger(options.nodeOptions.sessionOptions.timeout, "options.nodeOptions.sessionOptions.timeout");

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
                const filterBy: NodeSortFilter = options.nodeOptions.moveOptions.filterBy;
                if (typeof filterBy !== "string" && typeof filterBy !== "function")
                    throw new OptionError(
                        "The manager option 'options.nodeOptions.moveOptions.filterBy' must be a valid NodeSortTypes string or a function.",
                    );
            }
        }

        if (isPlainObject(options.nodeOptions.heartbeatOptions)) {
            assertNonNegativeInteger(options.nodeOptions.heartbeatOptions.interval, "options.nodeOptions.heartbeatOptions.interval");
        }

        if (typeof options.nodeOptions.userAgent !== "undefined" && typeof options.nodeOptions.userAgent !== "string")
            throw new OptionError("The manager option 'options.nodeOptions.userAgent' must be a string.");
    }

    if (isPlainObject(options.restOptions)) {
        assertNonNegativeInteger(options.restOptions.resumeTimeout, "options.restOptions.resumeTimeout");
        assertNonNegativeInteger(options.restOptions.restTimeout, "options.restOptions.restTimeout");
    }
}

/**
 *
 * Validate the query for the node.
 * @param {SearchQuery} search The query to validate.
 * @returns {string} The validated query.
 */
function validateQuery(search: SearchQuery): string {
    if (typeof search !== "object") throw new OptionError("The 'query' must be a valid object.");
    if (typeof search.query !== "string") throw new OptionError("The query option 'query.query' must be a valid string.");

    if (typeof search.source !== "string") throw new OptionError("The query option 'query.source' must be a valid search source.");

    search.source = validateSource(search.source);

    if (!SourceRegistry.isRegistered(search.source))
        throw new OptionError(`The query option 'query.source' must be a valid search source.`);

    const query: string = search.query.trim();

    // A plain URL goes to the node untouched. This has to be checked before parsing a source prefix:
    // `http://x.com/a.mp3` matches the registered `http` source and would lose its scheme.
    if (UrlRegex.test(query)) return query;

    const parsed: ParsedQuery | null = SourceRegistry.parseQuery(query);
    if (parsed) {
        if (UrlRegex.test(parsed.value)) return parsed.value;
        return SourceRegistry.createIdentifier(parsed.source, parsed.value);
    }

    return SourceRegistry.createIdentifier(search.source, query);
}

/**
 *
 * Validate the player options.
 * @param {PlayerOptions} options The player options.
 * @returns {void}
 */
function validatePlayerOptions(options: PlayerOptions): void {
    if (typeof options.guildId !== "string") throw new OptionError("The player option 'options.guildId' must be a string.");
    if (typeof options.voiceId !== "string") throw new OptionError("The player option 'options.voiceId' Must be a string.");
    if (typeof options.textId !== "undefined" && typeof options.textId !== "string")
        throw new OptionError("The player option 'options.textId' Must be a string.");

    if (typeof options.selfDeaf !== "undefined" && typeof options.selfDeaf !== "boolean")
        throw new OptionError("The player option 'options.selfDeaf' Must be a boolean.");
    if (typeof options.selfMute !== "undefined" && typeof options.selfMute !== "boolean")
        throw new OptionError("The player option 'options.selfMute' Mute must be a boolean.");
    // Not the integer helper: `Player.setVolume` rounds and clamps, so a fractional volume is valid.
    // NaN, Infinity and negatives are not — they would reach the node as a broken volume.
    if (typeof options.volume !== "undefined" && (!Number.isFinite(options.volume) || options.volume < 0))
        throw new OptionError("The player option 'options.volume' must be a non-negative number.");
}

/**
 *
 * Validate the source type.
 * @param {SearchSource | SourceName | string} type The type to validate.
 * @returns {SearchSource} The validated source type.
 */
function validateSource(type: SearchSource | SourceName | string): SearchSource {
    const source: string | undefined = SourceRegistry.resolve(type);
    if (!source) throw new OptionError(`The source '${type}' is not a valid source.`);

    return source as SearchSource;
}

/**
 * A collection of option/query validators for Hoshimi. Grouped here (rather than scattered as loose
 * exports) so validation lives in one place; the internal `isNode` helper stays module-private.
 * @constant
 */
export const Validations = {
    validateManagerOptions,
    validateQuery,
    validatePlayerOptions,
    validateSource,
} as const;
