import type { Awaitable, RestOrArray } from "../../../types/Manager";
import type { QueueJSON } from "../../../types/Queue";

/**
 * Class representing a storage manager.
 * @abstract
 * @class QueueStorageAdapter
 * @example
 * ```ts
 * class MyStorageManager extends QueueStorageAdapter {};
 *
 * const storage = new MyStorageManager();
 * storage.set("key", "value");
 *
 * const value = await storage.get("key");
 * console.log(value); // "value"
 * ```
 */
export abstract class QueueStorageAdapter<T extends QueueJSON = QueueJSON> {
    /**
     * The namespace of the storage.
     * @type {string}
     * @default "hoshimiqueue"
     * @example
     * ```ts
     * console.log(storage.namespace); // "hoshimiqueue"
     * ```
     */
    public namespace: string = "hoshimiqueue";

    /**
     *
     * Get the value using the key.
     * @param {string} key The key to get the value from.
     * @returns {Awaitable<T | undefined>} The value of the key.
     * @example
     * ```ts
     * const value = await storage.get("key");
     * console.log(value); // "value"
     * ```
     */
    abstract get(key: string): Awaitable<T | undefined>;

    /**
     *
     * Set the value using the key.
     * @param {string} key The key to set the value to.
     * @param {unknown} value The value to set.
     * @returns {Awaitable<void>} Did you know this can be async?
     * @example
     * ```ts
     * await storage.set("key", "value");
     * ```
     */
    abstract set(key: string, value: T): Awaitable<void>;

    /**
     *
     * Delete the value using the key.
     * @param {string} key The key to delete the value from.
     * @returns {Awaitable<boolean>} Returns true if the key was deleted.
     * @example
     * ```ts
     * const success = await storage.delete("key");
     * console.log(success); // true
     * ```
     */
    abstract delete(key: string): Awaitable<boolean>;

    /**
     * Clear the storage.
     * @returns {Awaitable<void>} Scary, right?
     * @example
     * ```ts
     * await storage.clear();
     * ```
     */
    abstract clear(): Awaitable<void>;

    /**
     * Check if the storage has the key.
     * @param {string} key The key to check.
     * @returns {Awaitable<boolean>} Return true if the key exists.
     * @example
     * ```ts
     * const exists = await storage.has("key");
     * console.log(exists); // true
     * ```
     */
    abstract has(key: string): Awaitable<boolean>;

    /**
     *
     * Parse the value.
     * @param {unknown} value The value to parse.
     * @returns {T} The parsed value.
     * @example
     * ```ts
     * const parsed = await storage.parse<{ key: string }>("{'key':'value'}");
     * console.log(parsed); // { key: "value" }
     * ```
     */
    abstract parse(value: unknown): Awaitable<T>;

    /**
     *
     * Stringify the value.
     * @param {unknown} value The value to stringify.
     * @returns {R} The stringified value.
     * @example
     * ```ts
     * const stringified = await storage.stringify({ key: "value" });
     * console.log(stringified); // "{'key':'value'}"
     * ```
     */
    abstract stringify<R = string>(value: unknown): Awaitable<R>;

    /**
     *
     * Build a key from the given parts.
     * @param {string[]} parts The parts to build the key from.
     * @returns {string} The built key.
     * @example
     * ```ts
     * const key = storage.buildKey("part1", "part2", "part3");
     * ```
     */
    public buildKey(...parts: RestOrArray<string>): string {
        return parts.flat().join(":");
    }
}
