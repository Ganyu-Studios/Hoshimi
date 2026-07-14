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
function validateManagerOptions(options: HoshimiOptions): void {
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
                const filterBy: NodeSortFilter = options.nodeOptions.moveOptions.filterBy;
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
function validateQuery(search: SearchQuery): string {
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
function validatePlayerOptions(options: PlayerOptions): void {
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
