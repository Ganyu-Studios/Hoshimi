import type { Awaitable, RestOrArray } from "../../types/Manager";
import { PlayerStorageAdapter, type StorageKeys, type StorageValues } from "./adapters/PlayerAdapter";

/**
 * Class representing a player storage.
 * @class PlayerMemoryStorage
 * @extends {PlayerStorageAdapter}
 */
export class PlayerMemoryStorage<
    K extends StorageKeys = StorageKeys,
    V extends StorageValues<K> = StorageValues<K>,
> extends PlayerStorageAdapter {
    /**
     * The internal storage.
     * @type {Map<K, V>}
     * @private
     * @readonly
     * @internal
     */
    private readonly internal: Map<K, V> = new Map<K, V>();

    public override get<K extends StorageKeys, V extends StorageValues<K>>(key: K): Awaitable<V | undefined> {
        return this.internal.get(this.buildKey(this.namespace, key) as never) as V | undefined;
    }

    public set<K extends StorageKeys, V extends StorageValues<K>>(key: K, value: V): Awaitable<void> {
        this.internal.set(this.buildKey(this.namespace, key) as never, value as never);
    }

    public has<K extends StorageKeys>(key: K): Awaitable<boolean> {
        return this.internal.has(this.buildKey(this.namespace, key) as never);
    }

    public delete<K extends StorageKeys>(key: K): Awaitable<boolean> {
        return this.internal.delete(this.buildKey(this.namespace, key) as never);
    }

    public keys<K extends StorageKeys[]>(): Awaitable<K[]> {
        return [...this.internal.keys()] as never as K[];
    }

    public values<K extends StorageKeys[], V extends StorageValues<K[number]>>(): Awaitable<V[]> {
        return [...this.internal.values()] as never as V[];
    }

    public entries<K extends StorageKeys[], V extends StorageValues<K[number]>>(): Awaitable<[K, V][]> {
        return [...this.internal.entries()] as never as [K, V][];
    }

    public all<K extends StorageKeys[], V extends StorageValues<K[number]>>(): Awaitable<Record<K[number], V>> {
        return Object.fromEntries([...this.internal.entries()]) as never as Record<K[number], V>;
    }

    public clear(): Awaitable<void> {
        this.internal.clear();
    }

    public size(): Awaitable<number> {
        return this.internal.size;
    }

    public destroy(): Awaitable<void> {
        this.internal.clear();
    }

    public buildKey(...parts: RestOrArray<string>): string {
        return parts.flat().join(":");
    }
}
