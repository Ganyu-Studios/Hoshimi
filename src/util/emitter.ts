import { EventEmitter } from "node:events";

/**
 * The shape an event map has to satisfy.
 *
 * The constraint is written in terms of the map's own keys rather than as an index signature
 * (`{ [event: string]: unknown[] }`) because interfaces never get an implicit index signature and so
 * would not satisfy the latter. Requiring a `type` alias instead would cost module augmentation,
 * which is how a consumer adds their own events, so the self-referential form is the one that keeps
 * a closed, augmentable interface usable.
 * @example
 * ```ts
 * interface MyEvents {
 * 	ready: [at: number];
 * }
 * ```
 */
export type EventMap<T> = Record<keyof T, unknown[]>;

/**
 * The event names of a map: whatever it declares, as long as the name is something an emitter can
 * actually key on.
 *
 * The intersection is load-bearing, not decoration. The merged interface below has to stay
 * compatible with the inherited `EventEmitter`, whose methods take `eventName: string | symbol`. A
 * bare `keyof T` could include `number`, which is not assignable to that, and the whole class fails
 * with TS2430 — "Interface 'TypedEmitter<T>' incorrectly extends interface 'EventEmitter<any>'".
 *
 * Note this is nothing like the open `string | symbol` union Node's own types use for event names.
 * That one accepts anything; this one only keeps the names the map declares, so a symbol it never
 * mentions is still rejected.
 */
export type EventKey<T> = keyof T & (string | symbol);

/**
 * The handler of a single event, with its parameters taken from the map's tuple. Named tuple members
 * carry over, so `[player: Player, track: Track | null]` shows those names as parameter hints.
 */
export type EventListener<T extends EventMap<T>, K extends EventKey<T>> = (...args: T[K]) => void;

/**
 * The emitter surface, declared in full.
 *
 * Every method is listed on purpose. Redeclaring only some of them leaves the rest resolving to the
 * inherited signature, which accepts any string and hands the listener `any` arguments — Node types
 * `on` as `on<E extends string | symbol>(event: EventNames<T, E>, ...)`, and `EventNames` includes
 * the inferred `E` itself, so nothing is ever rejected.
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
 * An {@link EventEmitter} whose events are described by a map, so an unknown name is a compile
 * error and a handler's parameters are inferred instead of being `any`.
 *
 * The runtime is Node's emitter untouched — the class body is empty and the merged interface only
 * describes it — so listener ordering, `once` removal and `instanceof` all behave exactly as before.
 *
 * The interface merges into the class rather than the methods being redeclared as `declare` fields:
 * fields would type them as properties, and a subclass overriding `on` with ordinary method syntax
 * would then fail with TS2425, losing access to `super.on` as well.
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
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: the merge is the mechanism, see above.
// biome-ignore lint/correctness/noUnusedVariables: `T` is consumed by the merged interface.
export abstract class TypedEmitter<T extends EventMap<T>> extends EventEmitter {}
