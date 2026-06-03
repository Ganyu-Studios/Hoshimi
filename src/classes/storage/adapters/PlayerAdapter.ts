import type { Awaitable, Hint, RestOrArray } from "../../../types/Manager";
import type { CustomizablePlayerStorage } from "../../player/Player";

/**
 * Type representing the customizable player storage.
 */
export type StorageKeys = Hint<keyof CustomizablePlayerStorage>;

/**
 * Type representing the customizable player storage values.
 */
export type StorageValues<V extends StorageKeys = StorageKeys> = V extends keyof CustomizablePlayerStorage
    ? CustomizablePlayerStorage[V]
    : unknown;

/**
 * Class representing a player storage adapter.
 * @abstract
 * @class PlayerStorageAdapter
 * @example
 * ```ts
 * class MyPlayerStorageAdapter extends PlayerStorageAdapter {};
 *
 * const storage = new MyPlayerStorageAdapter();
 * await storage.set("key", "value");
 *
 * const value = await storage.get("key");
 * console.log(value); // "value"
 * ```
 */
export abstract class PlayerStorageAdapter {
    /**
     * The namespace of the storage.
     * @type {string}
     * @default "hoshimiplayer"
     * @example
     * ```ts
     * console.log(storage.namespace); // "hoshimiplayer"
     * ```
     */
    public namespace: string = "hoshimiplayer";
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
    abstract get<K extends StorageKeys, V extends StorageValues<K>>(key: K): Awaitable<V | undefined>;

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
    abstract set<K extends StorageKeys, V extends StorageValues<K>>(key: K, value: V): Awaitable<void>;

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
    abstract delete<K extends StorageKeys>(key: K): Awaitable<boolean>;

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
    abstract has<K extends StorageKeys>(key: K): Awaitable<boolean>;

    /**
     * Get all keys in the storage.
     * @returns {Awaitable<K[]>} The keys in the storage.
     * @example
     * ```ts
     * const keys = await storage.keys();
     * console.log(keys); // ["key1", "key2"]
     * ```
     */
    abstract keys<K extends StorageKeys[]>(): Awaitable<K[]>;

    /**
     * Get all values in the storage.
     * @returns {Awaitable<V[]>} The values in the storage.
     * @example
     * ```ts
     * const values = await storage.values();
     * console.log(values); // ["value1", "value2"]
     * ```
     */
    abstract values<K extends StorageKeys[], V extends StorageValues<K[number]>>(): Awaitable<V[]>;

    /**
     * Get all entries in the storage.
     * @returns {Awaitable<[K, V][]>} The entries in the storage.
     * @example
     * ```ts
     * const entries = await storage.entries();
     * console.log(entries); // [["key1", "value1"], ["key2", "value2"]]
     * ```
     */
    abstract entries<K extends StorageKeys[], V extends StorageValues<K[number]>>(): Awaitable<[K, V][]>;

    /**
     * Get all key-value pairs in the storage.
     * @returns {Awaitable<Record<K[number], V>>} An object containing all key-value pairs in the storage, excluding internal keys.
     * @example
     * ```ts
     * const all = await storage.all();
     * console.log(all); // { key1: "value1", key2: "value2" }
     * ```
     */
    abstract all<K extends StorageKeys[], V extends StorageValues<K[number]>>(): Awaitable<Record<K[number], V>>;

    /**
     * Get the size of the storage.
     * @returns {Awaitable<number>} The size of the storage.
     * @example
     * ```ts
     * const size = await storage.size();
     * console.log(size); // 2
     * ```
     */
    abstract size(): Awaitable<number>;

    /**
     * Destroy the storage. This is called when the player is destroyed.
     * @returns {Awaitable<void>} Did you know this can be async?
     * @example
     * ```ts
     * await storage.destroy();
     * ```
     */
    abstract destroy(): Awaitable<void>;

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
    abstract buildKey(...parts: RestOrArray<string>): string;
}
