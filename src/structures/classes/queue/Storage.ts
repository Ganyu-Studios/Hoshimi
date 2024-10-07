import type { Awaitable } from "../../types";

/**
 * Storage Manager class.
 */
export abstract class StorageManager {
	/**
	 *
	 * Get the value using the key.
	 * @param key The key to get the value from.
	 */
	abstract get<T>(key: string): Awaitable<T>;

	/**
	 *
	 * Set the value using the key.
	 * @param key The key to set the value to.
	 * @param value The value to set.
	 */
	abstract set(key: string, value: unknown): Awaitable<void>;

	/**
	 *
	 * Delete the value using the key.
	 * @param key The key to delete the value from.
	 */
	abstract delete(key: string): Awaitable<void>;

	/**
	 * Clear the storage.
	 */
	abstract clear(): Awaitable<void>;

	/**
	 * Check if the storage has the key.
	 * @param key The key to check.
	 */
	abstract has(key: string): Awaitable<boolean>;
}

/**
 * LocalStorage class.
 */
export class LocalStorage {
	private storage: Map<string, unknown> = new Map();

	public async get<T>(key: string): Promise<T> {
		return this.storage.get(key) as T;
	}

	public async set(key: string, value: unknown): Promise<void> {
		this.storage.set(key, value);
	}

	public async delete(key: string): Promise<void> {
		this.storage.delete(key);
	}

	public async clear(): Promise<void> {
		this.storage.clear();
	}

	public async has(key: string): Promise<boolean> {
		return this.storage.has(key);
	}
}
