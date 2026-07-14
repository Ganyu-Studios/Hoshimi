import type { FilterManager } from "../../classes/player/filters/Manager";
import { type FilterRegistration, FilterRegistry, FilterScope } from "../../registry/FiltersRegistry";
import type { FilterSettings } from "../../types/Filters";

/**
 * Build the wire payload from the manager's {@link FilterManager.data} — stripping default-state entries,
 * plugin filters the node cannot host, and top-level filters the node does not advertise — then send it
 * via the REST `updatePlayer` endpoint.
 * @this {FilterManager}
 * @returns {Promise<void>}
 */
async function commit(this: FilterManager): Promise<void> {
    if (!this.player.node.sessionId) return;

    // `data.equalizer` is the source of truth (kept in sync with `this.bands` by setEQBand/clearEQBands).
    const filters: FilterSettings = { ...this.data };

    // Strip default-state top-level filters via the registry.
    for (const key of Object.keys(filters)) {
        if (key === "pluginFilters") continue;
        const value: unknown = (filters as Record<string, unknown>)[key];
        if (FilterRegistry.isDefault(key, value)) {
            delete (filters as Record<string, unknown>)[key];
        }
    }

    // Strip default-state plugin filters and prune empty envelopes.
    const pluginFilters: Record<string, unknown> | undefined = filters.pluginFilters as Record<string, unknown> | undefined;
    if (pluginFilters) {
        const stripped: Record<string, unknown> = { ...pluginFilters };
        for (const key of Object.keys(stripped)) {
            const value: unknown = stripped[key];
            if (isNestedPluginEnvelope(key, value)) {
                // Nested plugin envelope: prune each child filter individually.
                const nested: Record<string, unknown> = { ...(value as Record<string, unknown>) };
                for (const inner of Object.keys(nested)) {
                    if (FilterRegistry.isDefault(inner, nested[inner])) delete nested[inner];
                }
                if (Object.keys(nested).length === 0) delete stripped[key];
                else stripped[key] = nested;
            } else if (FilterRegistry.isDefaultFlatPlugin(key, value)) {
                delete stripped[key];
            }
        }
        if (Object.keys(stripped).length === 0) delete filters.pluginFilters;
        else filters.pluginFilters = stripped;
    }

    // Drop plugin filters the node cannot host (e.g. after moving to a node without the backing plugin).
    // Only prune once the node has reported its info, so we never drop filters on a not-yet-ready node.
    const hostable: Record<string, unknown> | undefined = filters.pluginFilters as Record<string, unknown> | undefined;
    if (hostable && this.player.node.info) {
        for (const key of Object.keys(hostable)) {
            const value: unknown = hostable[key];
            if (isNestedPluginEnvelope(key, value)) {
                // Nested envelope: keep only inner filters whose plugin resolves for this node.
                const nested: Record<string, unknown> = { ...(value as Record<string, unknown>) };
                for (const inner of Object.keys(nested)) {
                    if (!FilterRegistry.resolve(inner, this.player.node)) delete nested[inner];
                }
                if (Object.keys(nested).length === 0) delete hostable[key];
                else hostable[key] = nested;
            } else if (!FilterRegistry.canHostFlatPlugin(this.player.node, key)) {
                delete hostable[key];
            }
        }
        if (Object.keys(hostable).length === 0) delete filters.pluginFilters;
    }

    // Drop top-level filters the node does not advertise (vendor-scoped on a recognised fork is kept).
    const advertised: ReadonlyArray<string> = this.player.node.info?.filters ?? [];
    for (const key of Object.keys(filters)) {
        if (key === "pluginFilters") continue;
        const entry: FilterRegistration | null = FilterRegistry.resolve(key, this.player.node);
        if (entry?.scope === FilterScope.Vendor && this.player.node.isNodelink()) continue;
        if (!advertised.some((f): boolean => f === key)) {
            delete (filters as Record<string, unknown>)[key];
        }
    }

    await this.player.updatePlayer({ playerOptions: { filters } });
}

/**
 * Detect whether a `pluginFilters` key is a nested-plugin envelope (e.g. `"lavalink-filter-plugin"`)
 * rather than a flat filter (e.g. `"echo"`). A key that is not any registered filter's wire key is a
 * plugin-name wrapper holding nested filters (decided structurally, independent of installed plugins).
 * @param {string} key The `pluginFilters` key to inspect.
 * @param {unknown} value The value stored under that key.
 * @returns {boolean} Whether the key wraps nested filters.
 */
function isNestedPluginEnvelope(key: string, value: unknown): boolean {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return !FilterRegistry.isWireKey(key);
}

/**
 * Write `payload` into the correct envelope for the given entry.
 * @this {FilterManager}
 * @param {FilterRegistration} entry The resolved registration describing where the filter lives.
 * @param {unknown} payload The payload to write.
 * @returns {void}
 */
function writeToEnvelope(this: FilterManager, entry: FilterRegistration, payload: unknown): void {
    const name: string = String(entry.wireName ?? entry.name);
    if (entry.scope === FilterScope.Core || entry.scope === FilterScope.Vendor) {
        (this.data as Record<string, unknown>)[name] = payload;
        return;
    }
    // Plugin
    if (!this.data.pluginFilters) this.data.pluginFilters = {};
    const pf: Record<string, unknown> = this.data.pluginFilters as Record<string, unknown>;
    if (entry.pluginName) {
        const nestedKey: string = String(entry.pluginName);
        const current: unknown = pf[nestedKey];
        const next: Record<string, unknown> =
            current && typeof current === "object" && !Array.isArray(current) ? { ...(current as Record<string, unknown>) } : {};
        next[name] = payload;
        pf[nestedKey] = next;
    } else {
        pf[name] = payload;
    }
}

/**
 * Read the current payload for the given entry from the envelope.
 * @this {FilterManager}
 * @param {FilterRegistration} entry The resolved registration describing where the filter lives.
 * @returns {unknown} The stored payload, or `undefined` when absent.
 */
function readFromEnvelope(this: FilterManager, entry: FilterRegistration): unknown {
    const name: string = String(entry.wireName ?? entry.name);
    if (entry.scope === FilterScope.Core || entry.scope === FilterScope.Vendor) {
        return (this.data as Record<string, unknown>)[name];
    }
    const pf: Record<string, unknown> | undefined = this.data.pluginFilters as Record<string, unknown> | undefined;
    if (!pf) return undefined;
    if (entry.pluginName) {
        const nested: unknown = pf[String(entry.pluginName)];
        if (!nested || typeof nested !== "object" || Array.isArray(nested)) return undefined;
        return (nested as Record<string, unknown>)[name];
    }
    return pf[name];
}

/**
 * Remove the filter described by `entry` from the envelope, pruning empty wrappers.
 * @this {FilterManager}
 * @param {FilterRegistration} entry The resolved registration describing where the filter lives.
 * @returns {void}
 */
function clearFromEnvelope(this: FilterManager, entry: FilterRegistration): void {
    const name: string = String(entry.wireName ?? entry.name);
    if (entry.scope === FilterScope.Core || entry.scope === FilterScope.Vendor) {
        delete (this.data as Record<string, unknown>)[name];
        return;
    }
    const pf: Record<string, unknown> | undefined = this.data.pluginFilters as Record<string, unknown> | undefined;
    if (!pf) return;
    if (entry.pluginName) {
        const nestedKey: string = String(entry.pluginName);
        const nested: unknown = pf[nestedKey];
        if (!nested || typeof nested !== "object" || Array.isArray(nested)) return;
        const next: Record<string, unknown> = { ...(nested as Record<string, unknown>) };
        delete next[name];
        if (Object.keys(next).length === 0) delete pf[nestedKey];
        else pf[nestedKey] = next;
    } else {
        delete pf[name];
    }
}

/**
 * Internal grouping of the {@link FilterManager} wire/envelope helpers. Kept off the class (no private
 * members) per the project convention; the state-bound entries are invoked with `.call(manager)`.
 * Not part of the public package surface.
 */
export const FilterPayload = {
    commit,
    isNestedPluginEnvelope,
    writeToEnvelope,
    readFromEnvelope,
    clearFromEnvelope,
} as const;
