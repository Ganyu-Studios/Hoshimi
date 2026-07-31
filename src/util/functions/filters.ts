import { PlayerError } from "../../classes/Errors";
import type { FilterManager } from "../../classes/player/filters/Manager";
import { FilterRegistry, type FilterRoute, FilterScope, type RegistryFilterName } from "../../registry/FiltersRegistry";
import type { FilterSettings, SetFilterOptions } from "../../types/Filters";

/**
 * Internal grouping of the {@link FilterManager} wire/envelope helpers. Kept off the class (no private
 * members) per the project convention, with the manager passed explicitly rather than through `this`:
 * these are always invoked directly, unlike the socket/player handlers in `util/events`, which have to
 * be `this`-bound because they are registered as callbacks.
 * Not part of the public package surface.
 */
export const FilterPayload = {
    /**
     * Build the wire payload from the manager's {@link FilterManager.data} — pruning empty envelopes,
     * plugin filters the node cannot host, and registered top-level filters the node does not advertise
     * — then send it via the REST `updatePlayer` endpoint.
     * @param {FilterManager} manager The filter manager holding the payload.
     * @returns {Promise<void>}
     */
    async commit(manager: FilterManager): Promise<void> {
        if (!manager.player.node.sessionId) return;

        // A key is only present while its filter is active, so the payload needs no default-state
        // stripping: what `data` holds is what the node should apply.
        // `data.equalizer` is the source of truth (kept in sync with `manager.bands` by setEQBand/clearEQBands).
        const filters: FilterSettings = { ...manager.data };

        // Prune empty envelopes a caller may have left behind by editing `data` by hand. Copied rather
        // than mutated in place so the live payload is never touched.
        const pluginFilters: Record<string, unknown> | undefined = filters.pluginFilters as Record<string, unknown> | undefined;
        if (pluginFilters) {
            const stripped: Record<string, unknown> = { ...pluginFilters };
            for (const key of Object.keys(stripped)) {
                const value: unknown = stripped[key];
                if (FilterPayload.isNested(key, value) && Object.keys(value as Record<string, unknown>).length === 0) {
                    delete stripped[key];
                }
            }
            if (Object.keys(stripped).length === 0) delete filters.pluginFilters;
            else filters.pluginFilters = stripped;
        }

        // Drop plugin filters the node cannot host (e.g. after moving to a node without the backing plugin).
        // Only prune once the node has reported its info, so we never drop filters on a not-yet-ready node.
        const hostable: Record<string, unknown> | undefined = filters.pluginFilters as Record<string, unknown> | undefined;
        if (hostable && manager.player.node.info) {
            for (const key of Object.keys(hostable)) {
                const value: unknown = hostable[key];
                if (FilterPayload.isNested(key, value)) {
                    // Nested envelope: keep only inner filters whose plugin resolves for this node.
                    // Names the registry never heard of are left alone, same as unknown flat keys.
                    const nested: Record<string, unknown> = { ...(value as Record<string, unknown>) };
                    for (const inner of Object.keys(nested)) {
                        if (!FilterRegistry.isKnown(inner)) continue;
                        if (!FilterRegistry.resolve(inner, manager.player.node)) delete nested[inner];
                    }
                    if (Object.keys(nested).length === 0) delete hostable[key];
                    else hostable[key] = nested;
                } else if (!FilterRegistry.canHostFlatPlugin(manager.player.node, key)) {
                    delete hostable[key];
                }
            }
            if (Object.keys(hostable).length === 0) delete filters.pluginFilters;
        }

        // Drop top-level filters the node does not advertise, but only once it has actually reported its
        // filter list: an absent one means "unknown", not "advertises nothing". Keys the registry does not
        // know are left alone — the same treatment flat plugin filters get in canHostFlatPlugin — so a
        // fork-specific or ad-hoc filter is never silently dropped.
        const advertised: ReadonlyArray<string> | undefined = manager.player.node.info?.filters;
        if (advertised) {
            for (const key of Object.keys(filters)) {
                if (key === "pluginFilters") continue;
                if (!FilterRegistry.isKnown(key)) continue;
                if (!advertised.some((f): boolean => f === key)) {
                    delete (filters as Record<string, unknown>)[key];
                }
            }
        }

        await manager.player.updatePlayer({ playerOptions: { filters } });
    },

    /**
     * Detect whether a `pluginFilters` key is a nested-plugin envelope (e.g. `"lavalink-filter-plugin"`)
     * rather than a filter payload written flat (e.g. `"echo"`).
     *
     * Decided by asking the registry whether the key names a plugin that owns nested filters, not by
     * ruling out known wire keys: an unregistered key is a filter of its own, not a wrapper, so an
     * ad-hoc filter is never mistaken for an envelope and pruned away.
     * @param {string} key The `pluginFilters` key to inspect.
     * @param {unknown} value The value stored under that key.
     * @returns {boolean} Whether the key wraps nested filters.
     */
    isNested(key: string, value: unknown): boolean {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        return FilterRegistry.isPluginName(key);
    },

    /**
     * Work out where a filter's payload belongs.
     *
     * A routing option (`plugin`/`top`) always wins, so an explicit envelope can be forced even for a
     * registered name. Otherwise the registry decides, and a name it does not know falls back to a flat
     * `pluginFilters` entry — the extension point the Lavalink v4 spec defines.
     * @param {FilterManager} manager The filter manager, for node context.
     * @param {RegistryFilterName} name The filter name (or alias).
     * @param {SetFilterOptions} [options={}] The routing options.
     * @throws {PlayerError} If both `plugin` and `top` are given.
     * @returns {FilterRoute} The envelope coordinates for the filter.
     */
    route(manager: FilterManager, name: RegistryFilterName, options: SetFilterOptions = {}): FilterRoute {
        const key: string = String(name);

        if (typeof options.plugin !== "undefined" && options.top)
            throw new PlayerError("The filter options 'plugin' and 'top' are mutually exclusive.");

        if (options.top) return { name: key, scope: FilterScope.Core };
        if (typeof options.plugin !== "undefined") {
            if (typeof options.plugin === "string") return { name: key, scope: FilterScope.Plugin, pluginName: options.plugin };
            return { name: key, scope: FilterScope.Plugin };
        }

        return FilterRegistry.resolve(name, manager.player.node) ?? { name: key, scope: FilterScope.Plugin };
    },

    /**
     * Write `payload` into the envelope described by `route`.
     * @param {FilterManager} manager The filter manager holding the payload.
     * @param {FilterRoute} route Where the filter lives.
     * @param {unknown} payload The payload to write.
     * @returns {void}
     */
    write(manager: FilterManager, route: FilterRoute, payload: unknown): void {
        const name: string = String(route.wireName ?? route.name);
        if (route.scope === FilterScope.Core) {
            (manager.data as Record<string, unknown>)[name] = payload;
            return;
        }
        // Plugin
        if (!manager.data.pluginFilters) manager.data.pluginFilters = {};
        const pf: Record<string, unknown> = manager.data.pluginFilters as Record<string, unknown>;
        if (route.pluginName) {
            const nestedKey: string = String(route.pluginName);
            const current: unknown = pf[nestedKey];
            const next: Record<string, unknown> =
                current && typeof current === "object" && !Array.isArray(current) ? { ...(current as Record<string, unknown>) } : {};
            next[name] = payload;
            pf[nestedKey] = next;
        } else {
            pf[name] = payload;
        }
    },

    /**
     * Read the current payload stored at `route`.
     * @param {FilterManager} manager The filter manager holding the payload.
     * @param {FilterRoute} route Where the filter lives.
     * @returns {unknown} The stored payload, or `undefined` when absent.
     */
    read(manager: FilterManager, route: FilterRoute): unknown {
        const name: string = String(route.wireName ?? route.name);
        if (route.scope === FilterScope.Core) {
            return (manager.data as Record<string, unknown>)[name];
        }
        const pf: Record<string, unknown> | undefined = manager.data.pluginFilters as Record<string, unknown> | undefined;
        if (!pf) return undefined;
        if (route.pluginName) {
            const nested: unknown = pf[String(route.pluginName)];
            if (!nested || typeof nested !== "object" || Array.isArray(nested)) return undefined;
            return (nested as Record<string, unknown>)[name];
        }
        return pf[name];
    },

    /**
     * Remove the filter at `route` from the payload, pruning empty wrappers.
     * @param {FilterManager} manager The filter manager holding the payload.
     * @param {FilterRoute} route Where the filter lives.
     * @returns {void}
     */
    clear(manager: FilterManager, route: FilterRoute): void {
        const name: string = String(route.wireName ?? route.name);
        if (route.scope === FilterScope.Core) {
            delete (manager.data as Record<string, unknown>)[name];
            return;
        }
        const pf: Record<string, unknown> | undefined = manager.data.pluginFilters as Record<string, unknown> | undefined;
        if (!pf) return;
        if (route.pluginName) {
            const nestedKey: string = String(route.pluginName);
            const nested: unknown = pf[nestedKey];
            if (!nested || typeof nested !== "object" || Array.isArray(nested)) return;
            const next: Record<string, unknown> = { ...(nested as Record<string, unknown>) };
            delete next[name];
            if (Object.keys(next).length === 0) delete pf[nestedKey];
            else pf[nestedKey] = next;
        } else {
            delete pf[name];
        }

        // Presence is what marks a filter active, so an emptied container must not linger either.
        if (Object.keys(pf).length === 0) delete manager.data.pluginFilters;
    },
} as const;
