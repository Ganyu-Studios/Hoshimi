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
	abstract get<T>(key: string): Awaitable<T | undefined>;

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
	abstract delete(key: string): Awaitable<boolean>;

	/**
	 * Clear the storage.
	 */
	abstract clear(): Awaitable<void>;

	/**
	 * Check if the storage has the key.
	 * @param key The key to check.
	 */
	abstract has(key: string): Awaitable<boolean>;

	/**
	 *
	 * Parse the value.
	 * @param value The value to parse.
	 */
	abstract parse<T>(value: unknown): T;

	/**
	 *
	 * Stringify the value.
	 * @param value The value to stringify.
	 */
	abstract stringify(value: unknown): unknown;
}

/**
 * LocalStorage class.
 */
export class LocalStorage extends StorageManager {
	/**
	 * Internal storage.
	 */
	private storage: Map<string, unknown> = new Map();

	public override get<T>(key: string): T | undefined {
		return this.storage.get(this.parse(key)) as T;
	}

	public override set(key: string, value: unknown): void {
		return void this.storage.set(key, this.stringify(value));
	}

	public override delete(key: string): boolean {
		return this.storage.delete(key);
	}

	public override clear(): void {
		return this.storage.clear();
	}

	public override has(key: string): boolean {
		return this.storage.has(key);
	}

	public override parse<T>(value: string): T {
		return value as T;
	}

	public override stringify(value: unknown): unknown {
		return value;
	}
}

/**
 * Queue Store class.
 */
export class QueueStore {
	/**
	 * Storage manager instance.
	 */
	private storage: StorageManager;

	/**
	 *
	 * Constructor of the queue store.
	 * @param storage Storage manager instance.
	 */
	constructor(storage: StorageManager) {
		this.storage = storage;
	}

	/**
	 *
	 * Get the value using the key.
	 * @param key The key to get the value from.
	 * @returns
	 */
	public get<T>(key: string): T | undefined {
		return this.storage.get<T>(key) as T;
	}

	/**
	 *
	 * Set the value using the key.
	 * @param key The key to set the value to.
	 * @param value The value to set.
	 */
	public set(key: string, value: unknown): void {
		return void this.storage.set(key, value);
	}

	/**
	 *
	 * Delete the value using the key.
	 * @param key The key to delete the value from.
	 */
	public delete(key: string): boolean {
		return this.storage.delete(key) as boolean;
	}
}
