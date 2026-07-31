import { NodeError } from "../classes/Errors";
import type { Node } from "../classes/node/Node";
import { type FilterPayloads, FilterType } from "../types/Filters";
import { DebugLevels, EventNames, type Hint, type RestOrArray } from "../types/Manager";
import { PluginNames } from "../types/Node";
import { normalize, toArray } from "../util/functions/utils";
import { PluginCapabilities, PluginRegistry, type RegistryCapability, type RegistryPluginName } from "./PluginRegistry";

/**
 * The scope where a filter lives in the wire payload.
 */
export enum FilterScope {
    /**
     * Filter that lives at the top level of the `filters` payload: the Lavalink built-ins, and anything a
     * fork exposes alongside them.
     */
    Core = "core",
    /**
     * Filter provided by a Lavalink plugin. Lives inside `filters.pluginFilters`.
     * When `pluginName` is set the filter is nested under `pluginFilters[pluginName][name]` (per Lavalink spec).
     * When `pluginName` is omitted the filter is placed flat at `pluginFilters[name]` (legacy convention used by lavadspx-plugin and similar).
     */
    Plugin = "plugin",
}

/**
 * Custom filters for Hoshimi: the key is the filter name, the value is the payload it takes.
 *
 * Extend this interface via module augmentation to get autocompletion for the name and a checked payload
 * in `FilterManager.set` / `FilterManager.get`. Registering the filter is a separate, optional step that
 * buys envelope routing and node validation; this only adds types.
 * @example
 * ```ts
 * declare module "hoshimi" {
 *   interface CustomizableFilters {
 *     forkEcho: { decay: number; delay: number };
 *   }
 * }
 *
 * await player.filterManager.set("forkEcho", { decay: 0.5, delay: 200 }, { top: true });
 * ```
 */
export interface CustomizableFilters {}

/**
 * The custom filter name keys provided by users via module augmentation.
 */
export type FilterNameKey = keyof CustomizableFilters;

/**
 * The full filter name accepted by the filter registry.
 */
export type RegistryFilterName = FilterType | Hint<FilterNameKey>;

/**
 * The payload a filter takes: whatever {@link CustomizableFilters} declares for it, else the built-in
 * shape from {@link FilterPayloads}, else `unknown` — so a filter nobody declared accepts any payload.
 */
export type PayloadOf<K> = K extends keyof CustomizableFilters
    ? CustomizableFilters[K]
    : K extends keyof FilterPayloads
      ? FilterPayloads[K]
      : unknown;

/**
 * Registration options for a filter.
 */
export interface FilterRegistration {
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
     * Alternative names that should resolve to this same filter (e.g. fork renames sharing the same payload shape).
     * Aliases that collide with an already-registered canonical name are ignored to avoid hijacking.
     */
    aliases?: string[];
}

/**
 * The envelope coordinates of a filter: everything needed to place its payload on the wire.
 *
 * A {@link FilterRegistration} satisfies it, and so does a synthetic route built on the fly for a
 * filter that was never registered (see `FilterManager.set`).
 */
export type FilterRoute = Pick<FilterRegistration, "name" | "wireName" | "scope" | "pluginName">;

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
 * Identity helper for a single filter registration.
 *
 * @deprecated Now a plain pass-through. It existed to preserve the inferred payload type of the
 * `isDefault` predicate inside a batch registration; predicates are gone (a filter is active by the
 * presence of its key), so registrations can be passed to {@link FilterRegistry.register} as-is.
 * @param {FilterRegistration} registration The registration to return unchanged.
 * @returns {FilterRegistration} The same registration.
 */
export function defineFilter(registration: FilterRegistration): FilterRegistration {
    return registration;
}

/**
 * Object representing the filter registry for Lavalink, Lavalink-plugin, and fork-provided filters.
 */
export const FilterRegistry = {
    /**
     * Register one or multiple filter definitions.
     *
     * Registration is optional: `FilterManager.set` can write any filter, and only needs the registry to
     * route and validate the ones it knows. Register a filter to get envelope routing by name, node
     * validation, alias resolution and fork gating for free.
     *
     * @param {RestOrArray<FilterRegistration>} registrations The registrations, as rest args or one array.
     * @returns {string[]} The canonical filter names that were registered (or already present).
     * @example
     * ```ts
     * FilterRegistry.register({
     *   name: "boost",
     *   scope: FilterScope.Plugin,
     *   pluginName: "my-fork-plugin",
     *   capability: "fork-filters",
     * });
     *
     * FilterRegistry.register([
     *   { name: "forkEcho", scope: FilterScope.Core },
     *   { name: "forkReverb", scope: FilterScope.Core },
     * ]);
     * ```
     */
    register(...registrations: RestOrArray<FilterRegistration>): string[] {
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
                    e.scope === entry.scope && normalize(String(e.pluginName ?? "")) === normalize(String(entry.pluginName ?? "")),
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
     * Whether the given key is the name of a plugin that owns nested filters, i.e. whether
     * `pluginFilters[key]` is an envelope rather than a filter payload.
     * @param {string} key The candidate `pluginFilters` key.
     * @returns {boolean} Whether any registration nests its filters under this plugin name.
     */
    isPluginName(key: string): boolean {
        const target: string = keyOf(key);
        for (const entries of entriesByName.values()) {
            for (const entry of entries) {
                if (entry.pluginName && keyOf(String(entry.pluginName)) === target) return true;
            }
        }
        return false;
    },

    /**
     * Whether the registry knows a name at all, regardless of node context. Distinguishes "never
     * registered" from "registered but not resolvable on this node".
     * @param {RegistryFilterName} name The filter name (or alias).
     * @returns {boolean} Whether any registration exists under that name.
     */
    isKnown(name: RegistryFilterName): boolean {
        return getEntries(String(name)).length > 0;
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

// Pre-register built-in filters. Plain objects: registration only describes where a filter lives and
// what the node must provide, since a filter is active by the presence of its key.
FilterRegistry.register([
    // Core (Lavalink built-ins exposed in `filters.<name>`).
    { name: FilterType.Volume, scope: FilterScope.Core },
    { name: FilterType.LowPass, scope: FilterScope.Core },
    { name: FilterType.Karaoke, scope: FilterScope.Core },
    { name: FilterType.Rotation, scope: FilterScope.Core },
    { name: FilterType.Tremolo, scope: FilterScope.Core },
    { name: FilterType.Vibrato, scope: FilterScope.Core },
    { name: FilterType.Timescale, scope: FilterScope.Core },
    { name: FilterType.Distortion, scope: FilterScope.Core },
    { name: FilterType.Equalizer, scope: FilterScope.Core },
    { name: FilterType.ChannelMix, scope: FilterScope.Core },

    // Plugin: lavalink-filter-plugin (nested under `pluginFilters["lavalink-filter-plugin"]`).
    {
        name: FilterType.Echo,
        scope: FilterScope.Plugin,
        pluginName: PluginNames.FilterPlugin,
        capability: PluginCapabilities.Filters,
    },
    {
        name: FilterType.Reverb,
        scope: FilterScope.Plugin,
        pluginName: PluginNames.FilterPlugin,
        capability: PluginCapabilities.Filters,
    },

    // Plugin: lavadspx-plugin (flat under `pluginFilters.<name>`).
    { name: FilterType.DSPXLowpass, scope: FilterScope.Plugin, capability: PluginCapabilities.Dspx },
    { name: FilterType.DSPXHighpass, scope: FilterScope.Plugin, capability: PluginCapabilities.Dspx },
    {
        name: FilterType.DSPXEcho,
        // Written flat as `pluginFilters.echo`; a distinct canonical name avoids colliding with the
        // nested `lavalink-filter-plugin` echo (see FilterType.Echo above).
        wireName: FilterType.Echo,
        scope: FilterScope.Plugin,
        capability: PluginCapabilities.Dspx,
    },
    { name: FilterType.DSPXNormalization, scope: FilterScope.Plugin, capability: PluginCapabilities.Dspx },
]);
