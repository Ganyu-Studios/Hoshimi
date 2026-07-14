import { NodeError } from "../classes/Errors";
import type { Node } from "../classes/node/Node";
import { FilterType } from "../types/Filters";
import { DebugLevels, EventNames, type Hint, type RestOrArray } from "../types/Manager";
import { PluginNames } from "../types/Node";
import { normalize, toArray } from "../util/functions/utils";
import { PluginCapabilities, PluginRegistry, type RegistryCapability, type RegistryPluginName } from "./PluginRegistry";

/**
 * The scope where a filter lives in the wire payload.
 */
export enum FilterScope {
    /**
     * Built-in Lavalink filter. Lives at the top level of the `filters` payload.
     */
    Core = "core",
    /**
     * Filter provided by a Lavalink plugin. Lives inside `filters.pluginFilters`.
     * When `pluginName` is set the filter is nested under `pluginFilters[pluginName][name]` (per Lavalink spec).
     * When `pluginName` is omitted the filter is placed flat at `pluginFilters[name]` (legacy convention used by lavadspx-plugin and similar).
     */
    Plugin = "plugin",
    /**
     * Filter exclusive to a Lavalink fork (e.g. Nodelink). Lives at the top level of `filters` but only applies on the matching fork.
     */
    Vendor = "vendor",
}

/**
 * Custom filter names for Hoshimi.
 *
 * Extend this interface via module augmentation to provide custom filter names with autocompletion.
 * @example
 * ```ts
 * declare module "hoshimi" {
 *   interface CustomizableFilters {
 *     forkEcho: "fork-echo";
 *   }
 * }
 * ```
 */
export interface CustomizableFilters {}

/**
 * Custom vendor (fork) identifiers for Hoshimi.
 *
 * Extend this interface via module augmentation to provide custom vendor identifiers with autocompletion.
 * @example
 * ```ts
 * declare module "hoshimi" {
 *   interface CustomizableVendors {
 *     myFork: "my-fork";
 *   }
 * }
 * ```
 */
export interface CustomizableVendors {}

/**
 * The custom filter name keys provided by users via module augmentation.
 */
export type FilterNameKey = keyof CustomizableFilters;

/**
 * The custom vendor name keys provided by users via module augmentation.
 */
export type VendorNameKey = keyof CustomizableVendors;

/**
 * The full filter name accepted by the filter registry.
 */
export type RegistryFilterName = FilterType | Hint<FilterNameKey>;

/**
 * The vendor identifier accepted by the filter registry.
 */
export type RegistryVendorName = "nodelink" | Hint<VendorNameKey>;

/**
 * Registration options for a filter.
 */
export interface FilterRegistration<TPayload = unknown> {
    /**
     * The canonical filter name. Used as the registry identity/index key.
     * Unless {@link FilterRegistration.wireName} is set, it is also the key written into the wire payload.
     */
    name: RegistryFilterName;
    /**
     * The key actually written into the wire payload, when it differs from {@link FilterRegistration.name}.
     *
     * Needed when two distinct filters share the same wire key in different envelopes — e.g. the
     * `lavadspx-plugin` echo (`pluginFilters.echo`, flat) and the `lavalink-filter-plugin` echo
     * (`pluginFilters["lavalink-filter-plugin"].echo`, nested) both write `echo` but must be registered
     * under different canonical names so the registry can resolve each unambiguously.
     * @default name
     */
    wireName?: string;
    /**
     * Where the filter lives in the payload envelope.
     */
    scope: FilterScope;
    /**
     * The Lavalink plugin that owns this filter — relevant when `scope === FilterScope.Plugin`.
     *
     * When provided, the filter is nested under `pluginFilters[pluginName][name]` (Lavalink spec).
     * When omitted on a Plugin-scoped filter, the filter is placed flat at `pluginFilters[name]`.
     */
    pluginName?: RegistryPluginName;
    /**
     * The plugin capability that backs this filter — used to validate via {@link PluginRegistry} at apply time.
     * Recommended whenever `scope === FilterScope.Plugin`.
     */
    capability?: RegistryCapability;
    /**
     * Forks that implement this filter — required when `scope === FilterScope.Vendor`.
     */
    vendors?: RegistryVendorName[];
    /**
     * Alternative names that should resolve to this same filter (e.g. fork renames sharing the same payload shape).
     * Aliases that collide with an already-registered canonical name are ignored to avoid hijacking.
     */
    aliases?: string[];
    /**
     * Predicate that returns `true` when the given payload represents the "off" state.
     * Used by the filter manager to derive `isEnabled(name)` and to short-circuit no-op writes.
     */
    isDefault?: (payload: TPayload) => boolean;
    /**
     * The payload written when the filter is reset/cleared. If omitted, the manager will simply remove the key.
     */
    defaultPayload?: TPayload;
}

/**
 * Options for validating that a node can host a registered filter.
 */
export interface ValidateFilterOptions {
    /**
     * The node to validate the filter for.
     */
    node: Node;
    /**
     * The filter name (or alias) to validate.
     */
    name: RegistryFilterName;
}

/**
 * Internal canonical entry. Stores the normalized name alongside the registration.
 */
type CanonicalEntry = FilterRegistration & { name: string };

/**
 * Internal mapping of canonical filter names to all entries registered under that name.
 * @type {Map<string, CanonicalEntry[]>}
 */
const entriesByName: Map<string, CanonicalEntry[]> = new Map();

/**
 * Internal mapping of alias keys to their canonical filter name.
 * @type {Map<string, string>}
 */
const aliasToCanonical: Map<string, string> = new Map();

/**
 * List of canonical filter names in the order they were first registered.
 * @type {string[]}
 */
const canonicalFilters: string[] = [];

/**
 * Whether all filter validation is currently bypassed.
 * @type {boolean}
 */
let skipAll: boolean = false;

/**
 * Set of filter name keys whose validation is currently bypassed.
 * @type {Set<string>}
 */
const skippedFilters: Set<string> = new Set();

/**
 * Lowercased, trimmed lookup key for a filter name.
 */
function keyOf(name: string): string {
    return normalize(name);
}

/**
 * Resolve a filter name or alias to its canonical entry list.
 */
function getEntries(name: string): CanonicalEntry[] {
    const key: string = keyOf(name);
    if (entriesByName.has(key)) return entriesByName.get(key)!;
    const canonical: string | undefined = aliasToCanonical.get(key);
    if (!canonical) return [];
    return entriesByName.get(keyOf(canonical)) ?? [];
}

/**
 * Pick the best entry for a node from a list of candidates.
 */
function pickByNodeContext(candidates: CanonicalEntry[], node: Node): CanonicalEntry | null {
    if (!candidates.length) return null;

    const installedPlugins = node.info?.plugins ?? [];

    if (node.isNodelink()) {
        const vendor: CanonicalEntry | undefined = candidates.find(
            (entry): boolean =>
                entry.scope === FilterScope.Vendor && (entry.vendors?.some((v): boolean => normalize(String(v)) === "nodelink") ?? false),
        );
        if (vendor) return vendor;
    }

    const core: CanonicalEntry | undefined = candidates.find((entry): boolean => entry.scope === FilterScope.Core);
    if (core) return core;

    const plugin: CanonicalEntry | undefined = candidates.find((entry): boolean => {
        if (entry.scope !== FilterScope.Plugin) return false;
        if (!entry.pluginName) return true;
        const target: string = normalize(String(entry.pluginName));
        return installedPlugins.some((p): boolean => normalize(p.name) === target);
    });
    if (plugin) return plugin;

    return null;
}

/**
 * Identity helper that preserves the inferred `TPayload` of a single filter registration.
 *
 * Use inside `FilterRegistry.register([ ... ])` so each element keeps its own typed
 * `isDefault` and `defaultPayload` instead of collapsing to `FilterRegistration<unknown>`
 * (which happens because function parameters are contravariant under `strictFunctionTypes`).
 *
 * @example
 * ```ts
 * FilterRegistry.register([
 *   defineFilter({
 *     name: "boost",
 *     scope: FilterScope.Plugin,
 *     defaultPayload: { gain: 0 },
 *     isDefault: (p) => p.gain === 0, // p: { gain: number }
 *   }),
 * ]);
 * ```
 */
export function defineFilter<TPayload>(registration: FilterRegistration<TPayload>): FilterRegistration<TPayload> {
    return registration;
}

/**
 * Object representing the filter registry for Lavalink, Lavalink-plugin, and fork-provided filters.
 */
export const FilterRegistry = {
    /**
     * Register one or multiple filter definitions.
     *
     * Two call shapes:
     * - **Single registration**: the payload type is inferred per call from `defaultPayload`
     *   or from an annotated `isDefault` parameter — giving you typed predicates without manual `<T>`.
     * - **Batch (rest args or single array)**: each element accepts `FilterRegistration<any>`
     *   to bypass the contravariance of `isDefault`. For typed predicates inside a batch,
     *   wrap each element with {@link defineFilter} — that preserves per-element inference.
     *
     * @returns {string[]} The canonical filter names that were registered (or already present).
     * @example
     * ```ts
     * // Single — T inferred from defaultPayload
     * FilterRegistry.register({
     *   name: "boost",
     *   scope: FilterScope.Plugin,
     *   pluginName: "my-fork-plugin",
     *   capability: "fork-filters",
     *   defaultPayload: { gain: 0 },
     *   isDefault: (p) => p.gain === 0, // p: { gain: number }
     * });
     *
     * // Batch — wrap each element to preserve its payload type
     * FilterRegistry.register([
     *   defineFilter({ name: "a", scope: FilterScope.Core, isDefault: (v: number) => v === 1 }),
     *   defineFilter({ name: "b", scope: FilterScope.Core, isDefault: (v: number) => v === 0 }),
     * ]);
     * ```
     */
    register: ((...registrations: RestOrArray<FilterRegistration<any>>): string[] => {
        const results: string[] = [];

        for (const registration of toArray(registrations)) {
            const canonical: string = String(registration.name).trim();
            if (!canonical.length) continue;
            const key: string = keyOf(canonical);

            if (!entriesByName.has(key)) {
                entriesByName.set(key, []);
                canonicalFilters.push(canonical);
            }

            const entry: CanonicalEntry = { ...registration, name: canonical };
            const existing: CanonicalEntry[] = entriesByName.get(key)!;

            const duplicate: boolean = existing.some(
                (e): boolean =>
                    e.scope === entry.scope &&
                    normalize(String(e.pluginName ?? "")) === normalize(String(entry.pluginName ?? "")) &&
                    (e.vendors ?? []).map((v): string => normalize(String(v))).join(",") ===
                        (entry.vendors ?? []).map((v): string => normalize(String(v))).join(","),
            );
            if (!duplicate) existing.push(entry);

            for (const alias of registration.aliases ?? []) {
                const aliasKey: string = keyOf(String(alias));
                if (!aliasKey.length) continue;
                if (entriesByName.has(aliasKey) && aliasKey !== key) continue;
                aliasToCanonical.set(aliasKey, canonical);
            }

            results.push(canonical);
        }

        return results;
    }) as {
        <TPayload = unknown>(registration: FilterRegistration<TPayload>): string[];
        (...registrations: RestOrArray<FilterRegistration<any>>): string[];
    },

    /**
     * Unregister a filter (and all of its entries) by name or alias.
     * @param {RegistryFilterName} name The filter name or alias to unregister.
     * @returns {boolean} Whether any entry was removed.
     */
    unregister(name: RegistryFilterName): boolean {
        const key: string = keyOf(String(name));
        const canonicalKey: string = entriesByName.has(key) ? key : keyOf(aliasToCanonical.get(key) ?? "");
        if (!canonicalKey.length || !entriesByName.has(canonicalKey)) return false;

        entriesByName.delete(canonicalKey);
        const idx: number = canonicalFilters.findIndex((n): boolean => keyOf(n) === canonicalKey);
        if (idx >= 0) canonicalFilters.splice(idx, 1);
        for (const [alias, canonical] of aliasToCanonical) {
            if (keyOf(canonical) === canonicalKey) aliasToCanonical.delete(alias);
        }
        skippedFilters.delete(canonicalKey);
        return true;
    },

    /**
     * Resolve a filter name (or alias) to the best registration for a given node, taking scope and installed plugins into account.
     * @param {RegistryFilterName} name The filter name or alias.
     * @param {Node} node The node providing the context.
     * @returns {FilterRegistration | null} The chosen registration, or `null` when no candidate matches.
     */
    resolve(name: RegistryFilterName, node: Node): FilterRegistration | null {
        const candidates: CanonicalEntry[] = getEntries(String(name));
        return pickByNodeContext(candidates, node);
    },

    /**
     * Get every registration for a name or alias, regardless of node context.
     * @param {RegistryFilterName} name The filter name or alias.
     * @returns {FilterRegistration[]} The full list of registrations.
     */
    getAll(name: RegistryFilterName): FilterRegistration[] {
        return getEntries(String(name)).slice();
    },

    /**
     * Whether a payload represents the default (off) state for the named filter.
     * Returns `true` for `null`/`undefined` payloads when no `isDefault` predicate was registered.
     * @param {RegistryFilterName} name The filter name or alias.
     * @param {unknown} payload The payload to inspect.
     * @returns {boolean} Whether the payload is the default/off state.
     */
    isDefault(name: RegistryFilterName, payload: unknown): boolean {
        const entries: CanonicalEntry[] = getEntries(String(name));
        // Prefer an entry that actually declares a predicate; fall back to the first entry otherwise.
        const entry: CanonicalEntry | undefined = entries.find((e): boolean => typeof e.isDefault === "function") ?? entries[0];
        if (!entry?.isDefault) return payload === undefined || payload === null;
        return entry.isDefault(payload);
    },

    /**
     * Whether the given key is the wire key of any registered filter (as opposed to a plugin-name wrapper
     * that holds nested filters inside `pluginFilters`).
     * @param {string} key The candidate wire key.
     * @returns {boolean} Whether any registration writes to this wire key.
     */
    isWireKey(key: string): boolean {
        const target: string = keyOf(key);
        for (const entries of entriesByName.values()) {
            for (const entry of entries) {
                if (keyOf(String(entry.wireName ?? entry.name)) === target) return true;
            }
        }
        return false;
    },

    /**
     * Whether a payload written flat under `pluginFilters[wireKey]` is in its default (off) state.
     * Resolves the flat plugin registration (scope {@link FilterScope.Plugin}, no `pluginName`) by wire key,
     * so a filter that shares a wire key with a nested one (e.g. `echo`) is evaluated with the correct predicate.
     * @param {string} wireKey The flat key under `pluginFilters`.
     * @param {unknown} payload The payload to inspect.
     * @returns {boolean} Whether the payload is the default/off state.
     */
    isDefaultFlatPlugin(wireKey: string, payload: unknown): boolean {
        const target: string = keyOf(wireKey);
        for (const entries of entriesByName.values()) {
            for (const entry of entries) {
                if (entry.scope === FilterScope.Plugin && !entry.pluginName && keyOf(String(entry.wireName ?? entry.name)) === target) {
                    if (!entry.isDefault) return payload === undefined || payload === null;
                    return entry.isDefault(payload);
                }
            }
        }
        return this.isDefault(wireKey, payload);
    },

    /**
     * Whether the node can host a flat plugin filter written under `pluginFilters[wireKey]`.
     * Resolves the flat plugin registration by wire key and checks the node advertises its backing
     * capability. Returns `true` when no flat registration matches the wire key (unknown key → left untouched).
     * @param {Node} node The node providing the context.
     * @param {string} wireKey The flat key under `pluginFilters`.
     * @returns {boolean} Whether the node can host the filter.
     */
    canHostFlatPlugin(node: Node, wireKey: string): boolean {
        const target: string = keyOf(wireKey);
        for (const entries of entriesByName.values()) {
            for (const entry of entries) {
                if (entry.scope === FilterScope.Plugin && !entry.pluginName && keyOf(String(entry.wireName ?? entry.name)) === target) {
                    if (!node.info) return false;
                    if (entry.capability) return PluginRegistry.hasCapability(node.info.plugins ?? [], entry.capability);
                    return true; // no capability/pluginName declared → cannot tell, keep it
                }
            }
        }
        return true;
    },

    /**
     * Returns all canonical filter names in registration order.
     * @returns {string[]} All canonical filter names.
     */
    getFilters(): string[] {
        return canonicalFilters.slice();
    },

    /**
     * Returns all canonical filter names that have at least one entry of the given scope.
     * @param {FilterScope} scope The scope to filter by.
     * @returns {string[]} The matching canonical names.
     */
    getByScope(scope: FilterScope): string[] {
        const out: string[] = [];
        for (const name of canonicalFilters) {
            const entries: CanonicalEntry[] = entriesByName.get(keyOf(name)) ?? [];
            if (entries.some((e): boolean => e.scope === scope)) out.push(name);
        }
        return out;
    },

    /**
     * Returns all canonical filter names provided by a specific plugin.
     * @param {RegistryPluginName} pluginName The plugin name to filter by.
     * @returns {string[]} The matching canonical names.
     */
    getByPlugin(pluginName: RegistryPluginName): string[] {
        const target: string = normalize(String(pluginName));
        const out: string[] = [];
        for (const name of canonicalFilters) {
            const entries: CanonicalEntry[] = entriesByName.get(keyOf(name)) ?? [];
            if (entries.some((e): boolean => normalize(String(e.pluginName ?? "")) === target)) out.push(name);
        }
        return out;
    },

    /**
     * Skip filter validation, either globally or for specific filters.
     * @param {boolean | RegistryFilterName | RegistryFilterName[]} value `true` to skip every validation, or one/multiple filter names to skip selectively.
     * @returns {void}
     */
    skipValidation(value: boolean | RegistryFilterName | RegistryFilterName[]): void {
        if (typeof value === "boolean") {
            skipAll = value;
            return;
        }
        const values: RegistryFilterName[] = Array.isArray(value) ? value : [value];
        for (const filter of values) {
            const key: string = keyOf(String(filter));
            if (key.length) skippedFilters.add(key);
        }
    },

    /**
     * Restore filter validation. Without arguments restores everything; with arguments restores only the given filters.
     * @param {RegistryFilterName | RegistryFilterName[]} [value] The filter(s) whose validation should be restored.
     * @returns {void}
     */
    restoreValidation(value?: RegistryFilterName | RegistryFilterName[]): void {
        if (typeof value === "undefined") {
            skipAll = false;
            skippedFilters.clear();
            return;
        }
        const values: RegistryFilterName[] = Array.isArray(value) ? value : [value];
        for (const filter of values) skippedFilters.delete(keyOf(String(filter)));
    },

    /**
     * Whether filter validation is currently skipped, globally or for a given filter.
     * @param {RegistryFilterName} [name] The filter to check; omit to check only the global flag.
     * @returns {boolean} Whether validation is skipped.
     */
    isValidationSkipped(name?: RegistryFilterName): boolean {
        if (skipAll) return true;
        if (typeof name === "undefined") return false;
        const key: string = keyOf(String(name));
        return skippedFilters.has(key) || skippedFilters.has(keyOf(aliasToCanonical.get(key) ?? ""));
    },

    /**
     * Validate that a node supports the named filter. Throws on failure.
     * @param {ValidateFilterOptions} options The validation options.
     * @throws {NodeError} If the node is not ready, the filter is unknown for this node context, or the node does not advertise the filter / required plugin.
     * @returns {void}
     */
    validate(options: ValidateFilterOptions): void {
        const info = options.node.info;
        if (!info) throw new NodeError({ id: options.node.id, message: "Node is not ready yet." });

        if (this.isValidationSkipped(options.name)) {
            options.node.nodeManager.manager.emit(
                EventNames.Debug,
                DebugLevels.Node,
                `[Node] Skipping filter validation for '${String(options.name)}' on node ${options.node.id}.`,
            );
            return;
        }

        const entry: FilterRegistration | null = this.resolve(options.name, options.node);
        if (!entry) {
            throw new NodeError({
                id: options.node.id,
                message: `No registered filter resolves '${String(options.name)}' on node ${options.node.id}.`,
            });
        }

        if (entry.scope === FilterScope.Vendor) {
            if (!options.node.isNodelink()) {
                throw new NodeError({
                    id: options.node.id,
                    message: `Filter '${String(entry.name)}' is vendor-scoped and node ${options.node.id} is not a recognised fork.`,
                });
            }
            return;
        }

        const advertised: boolean =
            info.filters?.some((f): boolean => normalize(f) === normalize(String(entry.wireName ?? entry.name))) ?? false;

        if (entry.scope === FilterScope.Plugin) {
            if (entry.capability) {
                PluginRegistry.validate({ node: options.node, required: [entry.capability] });
            } else if (entry.pluginName) {
                const target: string = normalize(String(entry.pluginName));
                const installed: boolean = info.plugins?.some((p): boolean => normalize(p.name) === target) ?? false;
                if (!installed) {
                    throw new NodeError({
                        id: options.node.id,
                        message: `Plugin '${String(entry.pluginName)}' is not installed on node ${options.node.id}.`,
                    });
                }
            }
            if (!advertised) {
                throw new NodeError({
                    id: options.node.id,
                    message: `Filter '${String(entry.name)}' is not exposed by node ${options.node.id}.`,
                });
            }
            return;
        }

        // Core
        if (!advertised) {
            throw new NodeError({
                id: options.node.id,
                message: `Filter '${String(entry.name)}' is not exposed by node ${options.node.id}.`,
            });
        }
    },

    /**
     * Clear the entire registry and reset every validation skip. Intended for tests.
     * @returns {void}
     */
    clear(): void {
        entriesByName.clear();
        aliasToCanonical.clear();
        canonicalFilters.length = 0;
        skippedFilters.clear();
        skipAll = false;
    },
} as const;

// Pre-register built-in filters.
FilterRegistry.register([
    // Core (Lavalink built-ins exposed in `filters.<name>`).
    defineFilter({
        name: FilterType.Volume,
        scope: FilterScope.Core,
        isDefault: (v: number): boolean => v === 1,
    }),
    defineFilter({
        name: FilterType.LowPass,
        scope: FilterScope.Core,
        isDefault: (p: { smoothing?: number } | null | undefined): boolean => !p || (p.smoothing ?? 0) === 0,
    }),
    defineFilter({
        name: FilterType.Karaoke,
        scope: FilterScope.Core,
        // Off when absent or every parameter is zero (the neutral payload in DefaultPlayerFilters).
        isDefault: (p: { level?: number; monoLevel?: number; filterBand?: number; filterWidth?: number } | null | undefined): boolean =>
            !p || ((p.level ?? 0) === 0 && (p.monoLevel ?? 0) === 0 && (p.filterBand ?? 0) === 0 && (p.filterWidth ?? 0) === 0),
    }),
    defineFilter({
        name: FilterType.Rotation,
        scope: FilterScope.Core,
        isDefault: (p: { rotationHz?: number } | null | undefined): boolean => !p || (p.rotationHz ?? 0) === 0,
    }),
    defineFilter({
        name: FilterType.Tremolo,
        scope: FilterScope.Core,
        isDefault: (p: { depth?: number } | null | undefined): boolean => !p || (p.depth ?? 0) === 0,
    }),
    defineFilter({
        name: FilterType.Vibrato,
        scope: FilterScope.Core,
        isDefault: (p: { depth?: number } | null | undefined): boolean => !p || (p.depth ?? 0) === 0,
    }),
    defineFilter({
        name: FilterType.Timescale,
        scope: FilterScope.Core,
        isDefault: (p: { speed?: number; pitch?: number; rate?: number } | null | undefined): boolean =>
            !p || ((p.speed ?? 1) === 1 && (p.pitch ?? 1) === 1 && (p.rate ?? 1) === 1),
    }),
    defineFilter({
        name: FilterType.Distortion,
        scope: FilterScope.Core,
        // Off when absent or the identity transform (all offsets 0 and all scales 1), matching DefaultPlayerFilters.
        isDefault: (
            p:
                | {
                      sinOffset?: number;
                      sinScale?: number;
                      cosOffset?: number;
                      cosScale?: number;
                      tanOffset?: number;
                      tanScale?: number;
                      offset?: number;
                      scale?: number;
                  }
                | null
                | undefined,
        ): boolean =>
            !p ||
            ((p.sinOffset ?? 0) === 0 &&
                (p.cosOffset ?? 0) === 0 &&
                (p.tanOffset ?? 0) === 0 &&
                (p.offset ?? 0) === 0 &&
                (p.sinScale ?? 1) === 1 &&
                (p.cosScale ?? 1) === 1 &&
                (p.tanScale ?? 1) === 1 &&
                (p.scale ?? 1) === 1),
    }),
    defineFilter({
        name: FilterType.Equalizer,
        scope: FilterScope.Core,
        isDefault: (p: ReadonlyArray<{ band: number; gain: number }> | null | undefined): boolean =>
            !p || p.length === 0 || p.every((b): boolean => b.gain === 0),
    }),
    defineFilter({
        name: FilterType.ChannelMix,
        scope: FilterScope.Core,
        // Stereo default ({1,0,0,1}). Anything else is considered active.
        isDefault: (
            p: { leftToLeft?: number; leftToRight?: number; rightToLeft?: number; rightToRight?: number } | null | undefined,
        ): boolean =>
            !p || ((p.leftToLeft ?? 1) === 1 && (p.leftToRight ?? 0) === 0 && (p.rightToLeft ?? 0) === 0 && (p.rightToRight ?? 1) === 1),
    }),

    // Plugin: lavalink-filter-plugin (nested under `pluginFilters["lavalink-filter-plugin"]`).
    defineFilter({
        name: FilterType.Echo,
        scope: FilterScope.Plugin,
        pluginName: PluginNames.FilterPlugin,
        capability: PluginCapabilities.Filters,
        isDefault: (p: { delay?: number; decay?: number } | null | undefined): boolean =>
            !p || ((p.delay ?? 0) === 0 && (p.decay ?? 0) === 0),
    }),
    defineFilter({
        name: FilterType.Reverb,
        scope: FilterScope.Plugin,
        pluginName: PluginNames.FilterPlugin,
        capability: PluginCapabilities.Filters,
        isDefault: (p: { delays?: number[]; gains?: number[] } | null | undefined): boolean =>
            !p || ((p.delays?.length ?? 0) === 0 && (p.gains?.length ?? 0) === 0),
    }),

    // Plugin: lavadspx-plugin (flat under `pluginFilters.<name>`).
    defineFilter({
        name: FilterType.DSPXLowpass,
        scope: FilterScope.Plugin,
        capability: PluginCapabilities.Dspx,
        isDefault: (p: { boostFactor?: number; cutoffFrequency?: number } | null | undefined): boolean =>
            !p || ((p.boostFactor ?? 0) === 0 && (p.cutoffFrequency ?? 0) === 0),
    }),
    defineFilter({
        name: FilterType.DSPXHighpass,
        scope: FilterScope.Plugin,
        capability: PluginCapabilities.Dspx,
        isDefault: (p: { boostFactor?: number; cutoffFrequency?: number } | null | undefined): boolean =>
            !p || ((p.boostFactor ?? 0) === 0 && (p.cutoffFrequency ?? 0) === 0),
    }),
    defineFilter({
        name: FilterType.DSPXEcho,
        // Written flat as `pluginFilters.echo`; distinct canonical name avoids colliding with the
        // nested `lavalink-filter-plugin` echo (see FilterType.Echo above).
        wireName: FilterType.Echo,
        scope: FilterScope.Plugin,
        capability: PluginCapabilities.Dspx,
        isDefault: (p: { echoLength?: number; decay?: number } | null | undefined): boolean =>
            !p || ((p.echoLength ?? 0) === 0 && (p.decay ?? 0) === 0),
    }),
    defineFilter({
        name: FilterType.DSPXNormalization,
        scope: FilterScope.Plugin,
        capability: PluginCapabilities.Dspx,
        isDefault: (p: { maxAmplitude?: number; adaptive?: boolean } | null | undefined): boolean =>
            !p || ((p.maxAmplitude ?? 0) === 0 && !(p.adaptive ?? false)),
    }),
]);
