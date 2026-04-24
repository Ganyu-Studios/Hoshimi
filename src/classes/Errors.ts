import type { LavalinkRestError } from "../types/Rest";

/**
 * Error class for the manager.
 * @class ManagerError
 * @extends {Error}
 */
export class ManagerError extends Error {
    override name = "Hoshimi [ManagerError]";
}

/**
 * Error class for invalid options.
 * @class OptionError
 * @extends {Error}
 */
export class OptionError extends Error {
    override name = "Hoshimi [OptionError]";
}

/**
 * Error class for the player.
 * @class PlayerError
 * @extends {Error}
 */
export class PlayerError extends Error {
    override name = "Hoshimi [PlayerError]";
}

/**
 * Error class for the node.
 * @class NodeError
 * @extends {Error}
 */
export class NodeError extends Error {
    constructor({ message, id }: NodeErrorOptions) {
        super(message);
        this.name = `Hoshimi [NodeError | ${id}]`;
    }
}

/**
 * Error class for the storage.
 * @class StorageError
 * @extends {Error}
 */
export class StorageError extends Error {
    override name = "Hoshimi [StorageError]";
}

/**
 * Error class for the node manager.
 * @class NodeManagerError
 * @extends {Error}
 */
export class NodeManagerError extends Error {
    override name = "Hoshimi [NodeManagerError]";
}

/**
 * Error class for resolving tracks.
 * @class ResolveError
 * @extends {Error}
 */
export class ResolveError extends Error {
    override name = "Hoshimi [ResolveError]";
}

/**
 * Error class for merging nodes.
 * @class MergeError
 * @extends {Error}
 */
export class MergeError extends Error {
    override name = "Hoshimi [MergeError]";
}

/**
 * The RestError class has been taken from Shoukaku library.
 * A cute and epic lavalink wrapper, made in typescript.
 * So, all the credits goes to the original author.
 * @link https://github.com/shipgirlproject/Shoukaku/blob/master/src/node/Rest.ts
 */

/**
 * Class representing a REST error.
 * @class RestError
 * @extends {Error}
 */
export class RestError extends Error {
    /**
     * The timestamp of the response.
     * @type {number}
     */
    public timestamp: number;
    /**
     * The status of the response.
     * @type {number}
     */
    public status: number;
    /**
     * The error of the response.
     * @type {string}
     */
    public error: string;
    /**
     * The message of the response.
     * @type {string}
     */
    public path: string;
    /**
     * The trace of the response.
     * @type {string}
     */
    public trace?: string;

    /**
     *
     * Create a new REST error.
     */
    constructor({ timestamp, status, error, trace, message, path }: LavalinkRestError) {
        super(`Rest request failed with response code: ${status}${message ? ` | message: ${message}` : ""}`);

        this.name = "Hoshimi [RestError]";
        this.timestamp = timestamp;
        this.status = status;
        this.error = error;
        this.trace = trace;
        this.message = message;
        this.path = path;
    }
}

/**
 * Error options for the node.
 */
interface NodeErrorOptions {
    /**
     * The message of the error.
     * @type {string}
     */
    message: string;
    /**
     * The id of the node.
     * @type {string}
     */
    id: string;
}
