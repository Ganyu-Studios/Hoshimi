import { EventEmitter } from "node:events";

/**
 * The shape an event map has to satisfy.
 * @description Written in terms of the map's own keys instead of an index signature: interfaces never get an implicit one, and requiring a `type` alias would cost module augmentation.
 */
export type EventMap<T> = Record<keyof T, unknown[]>;

/**
 * The event names a map declares.
 * @description The intersection keeps the merged interface assignable to the inherited signature; a bare `keyof T` may include `number` and fails with TS2430.
 */
export type EventKey<T> = keyof T & (string | symbol);

/**
 * The listener of a single event, taking the parameters from the map's tuple.
 */
export type EventListener<T extends EventMap<T>, K extends EventKey<T>> = (...args: T[K]) => void;

/**
 * The typed surface of the emitter.
 * @description Every method is listed on purpose: any left out keeps resolving to the inherited signature, which takes any name and gives the listener `any` arguments.
 */
export interface TypedEmitter<T extends EventMap<T>> {
    on<K extends EventKey<T>>(event: K, listener: EventListener<T, K>): this;
    once<K extends EventKey<T>>(event: K, listener: EventListener<T, K>): this;
    off<K extends EventKey<T>>(event: K, listener: EventListener<T, K>): this;
    addListener<K extends EventKey<T>>(event: K, listener: EventListener<T, K>): this;
    removeListener<K extends EventKey<T>>(event: K, listener: EventListener<T, K>): this;
    prependListener<K extends EventKey<T>>(event: K, listener: EventListener<T, K>): this;
    prependOnceListener<K extends EventKey<T>>(event: K, listener: EventListener<T, K>): this;
    removeAllListeners(event?: EventKey<T>): this;

    emit<K extends EventKey<T>>(event: K, ...args: T[K]): boolean;

    listeners<K extends EventKey<T>>(event: K): EventListener<T, K>[];
    rawListeners<K extends EventKey<T>>(event: K): EventListener<T, K>[];
    listenerCount<K extends EventKey<T>>(event: K, listener?: EventListener<T, K>): number;
    eventNames(): EventKey<T>[];

    getMaxListeners(): number;
    setMaxListeners(count: number): this;
}

/**
 * Class representing an event emitter described by a map, where an unknown event name is a compile error and a listener's parameters are inferred.
 * @description Node's emitter is the runtime, untouched: the class body is empty and the merged interface only describes it. The interface merges instead of the methods being `declare` fields, which would type them as properties and break a subclass overriding `on` with method syntax.
 * @abstract
 * @class TypedEmitter
 * @example
 * ```ts
 * interface MyEvents {
 * 	ready: [at: number];
 * }
 *
 * class MyThing extends TypedEmitter<MyEvents> {}
 *
 * const thing = new MyThing();
 *
 * thing.on("ready", (at) => console.log(at)); // `at` is a number
 * thing.emit("ready", Date.now());
 * ```
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: the merge is the mechanism.
// biome-ignore lint/correctness/noUnusedVariables: `T` is consumed by the merged interface.
export abstract class TypedEmitter<T extends EventMap<T>> extends EventEmitter {}
