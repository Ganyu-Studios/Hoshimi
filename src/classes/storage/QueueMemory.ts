import type { QueueJSON } from "../../types/Queue";
import { QueueStorageAdapter } from "./adapters/QueueAdapter";

/**
 * Class representing a memory storage manager.
 * @class QueueMemoryStorage
 * @extends {QueueStorageAdapter}
 */
export class QueueMemoryStorage<T extends QueueJSON = QueueJSON> extends QueueStorageAdapter<T> {
    /**
     * Memory storage.
     * @type {Map<string, QueueJSON>}
     * @private
     * @readonly
     * @internal
     */
    private readonly storage: Map<string, QueueJSON> = new Map();

    public get(key: string): T | undefined {
        const value: QueueJSON | undefined = this.storage.get(this.buildKey(this.namespace, key));
        if (typeof value === "undefined") return undefined;

        return this.parse(value);
    }

    public set(key: string, value: T): void {
        this.storage.set(this.buildKey(this.namespace, key), this.stringify<QueueJSON>(value));
    }

    public delete(key: string): boolean {
        return this.storage.delete(this.buildKey(this.namespace, key));
    }

    public clear(): void {
        this.storage.clear();
    }

    public has(key: string): boolean {
        return this.storage.has(this.buildKey(this.namespace, key));
    }

    public parse(value: unknown): T {
        return value as T;
    }

    public stringify<R = string>(value: unknown): R {
        return value as R;
    }
}
