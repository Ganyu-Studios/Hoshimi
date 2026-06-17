import { NodeError } from "../classes/Errors";
import type { Node } from "../classes/node/Node";
import { DebugLevels, EventNames, type Hint, type RestOrArray } from "../types/Manager";
import { PluginNames } from "../types/Node";
import { normalize, toArray } from "../util/functions/utils";

/**
 * Built-in plugin capabilities recognized by Hoshimi.
 */
export enum PluginCapabilities {
    /**
     * Lyrics retrieval — provided by lavalyrics-plugin, java-lyrics-plugin, or lavasrc-plugin.
     */
    Lyrics = "lyrics",
    /**
     * DSPX filter set — provided by lavadspx-plugin.
     */
    Dspx = "dspx",
    /**
     * Extended filter effects (echo, reverb, low/high-pass) — provided by lavalink-filter-plugin.
     */
    Filters = "filters",
    /**
     * SponsorBlock segment lookup — provided by sponsorblock-plugin.
     */
    SponsorBlock = "sponsorblock",
    /**
     * YouTube source provider — provided by youtube-plugin.
     */
    Youtube = "youtube",
    /**
     * LavaSearch endpoints — provided by lavasearch-plugin.
     */
    Search = "search",
    /**
     * Extra music sources (Spotify, Apple Music, Deezer, etc.) — provided by lavasrc-plugin, jiosaavn-plugin, and similar.
     */
    ExtraSources = "extra-sources",
}

/**
 * Registration options for a plugin.
 */
export interface PluginRegistration {
    /**
     * The capability the plugin provides.
     */
    capability: RegistryCapability;
    /**
     * The plugin name as reported by Lavalink's /v4/info endpoint.
     */
    name: RegistryPluginName;
}

/**
 * Options for validating that a node has the required plugin capabilities.
 */
export interface ValidatePluginsOptions {
    /**
     * The node to validate the plugin capabilities for.
     * @type {Node}
     */
    node: Node;
    /**
     * Array of capabilities that must all be present in the node.
     * @type {RegistryCapability[]}
     * @default []
     */
    required?: RegistryCapability[];
    /**
     * Array of capabilities where at least one must be present in the node.
     * @type {RegistryCapability[]}
     * @default []
     */
    any?: RegistryCapability[];
}

/**
 * Custom plugin capabilities for Hoshimi.
 *
 * Extend this interface via module augmentation to provide custom capabilities.
 * @example
 * ```ts
 * declare module "hoshimi" {
 *   interface CustomizablePluginCapabilities {
 *     karaoke: "karaoke";
 *   }
 * }
 * ```
 */
export interface CustomizablePluginCapabilities {}

/**
 * Custom plugin names for Hoshimi.
 *
 * Extend this interface via module augmentation to provide custom plugin names with autocompletion.
 * @example
 * ```ts
 * declare module "hoshimi" {
 *   interface CustomizablePluginNames {
 *     myFork: "lavasrc-fork-plugin";
 *   }
 * }
 * ```
 */
export interface CustomizablePluginNames {}

/**
 * The custom capability keys provided by users via module augmentation.
 */
export type CapabilityKey = keyof CustomizablePluginCapabilities;

/**
 * The custom plugin name keys provided by users via module augmentation.
 */
export type PluginNameKey = keyof CustomizablePluginNames;

/**
 * The full capability identifier accepted by the plugin registry.
 */
export type RegistryCapability = PluginCapabilities | Hint<CapabilityKey>;

/**
 * The plugin name accepted by the plugin registry.
 */
export type RegistryPluginName = PluginNames | Hint<PluginNameKey>;

/**
 * Internal mapping of capabilities to the set of plugin names that provide them.
 * @type {Map<string, Set<string>>}
 */
const capabilityToPlugins: Map<string, Set<string>> = new Map();

/**
 * Internal mapping of plugin names to the set of capabilities they provide.
 * @type {Map<string, Set<string>>}
 */
const pluginToCapabilities: Map<string, Set<string>> = new Map();

/**
 * List of canonical capability identifiers in the order they were registered.
 * @type {string[]}
 */
const canonicalCapabilities: string[] = [];

/**
 * List of canonical plugin names in the order they were registered.
 * @type {string[]}
 */
const canonicalPlugins: string[] = [];

/**
 * Whether all plugin validation is currently bypassed.
 * @type {boolean}
 */
let skipAll: boolean = false;

/**
 * Set of capability identifiers whose validation is currently bypassed.
 * @type {Set<string>}
 */
const skippedCapabilities: Set<string> = new Set();

/**
 * Object representing the plugin registry for Lavalink plugins.
 */
export const PluginRegistry = {
    /**
     * Register one or multiple plugin definitions under their capabilities.
     * @param {RestOrArray<PluginRegistration>} registrations The plugin registration payloads.
     * @returns {string[]} The canonical plugin names registered.
     * @example
     * ```ts
     * PluginRegistry.register({
     *   capability: PluginCapabilities.Lyrics,
     *   name: "lavasrc-fork-plugin",
     * });
     *
     * PluginRegistry.register(
     *   { capability: PluginCapabilities.Lyrics, name: "lavasrc-fork-plugin" },
     *   { capability: PluginCapabilities.ExtraSources, name: "lavasrc-fork-plugin" },
     * );
     * ```
     */
    register(...registrations: RestOrArray<PluginRegistration>): string[] {
        const results: string[] = [];

        for (const registration of toArray(registrations)) {
            const canonicalCapability: string = String(registration.capability).trim();
            const canonicalPlugin: string = String(registration.name).trim();
            if (!canonicalCapability.length || !canonicalPlugin.length) continue;

            const capabilityKey: string = normalize(canonicalCapability);
            const pluginKey: string = normalize(canonicalPlugin);

            if (!canonicalCapabilities.some((c) => normalize(c) === capabilityKey)) canonicalCapabilities.push(canonicalCapability);
            if (!canonicalPlugins.some((p) => normalize(p) === pluginKey)) canonicalPlugins.push(canonicalPlugin);

            if (!capabilityToPlugins.has(capabilityKey)) capabilityToPlugins.set(capabilityKey, new Set());
            capabilityToPlugins.get(capabilityKey)!.add(pluginKey);

            if (!pluginToCapabilities.has(pluginKey)) pluginToCapabilities.set(pluginKey, new Set());
            pluginToCapabilities.get(pluginKey)!.add(capabilityKey);

            results.push(canonicalPlugin);
        }

        return results;
    },
    /**
     * Unregister a plugin from a specific capability, or from all capabilities if none is provided.
     * @param {RegistryPluginName} name The plugin name to unregister.
     * @param {RegistryCapability} [capability] The capability to unregister the plugin from.
     * @returns {void}
     * @example
     * ```ts
     * // Drop only the Lyrics binding, keep ExtraSources
     * PluginRegistry.unregister("lavasrc-fork-plugin", PluginCapabilities.Lyrics);
     *
     * // Drop the plugin from every capability it was bound to
     * PluginRegistry.unregister("lavasrc-fork-plugin");
     * ```
     */
    unregister(name: RegistryPluginName, capability?: RegistryCapability): void {
        const pluginKey: string = normalize(String(name));
        if (!pluginKey.length) return;

        if (typeof capability !== "undefined") {
            const capabilityKey: string = normalize(String(capability));
            capabilityToPlugins.get(capabilityKey)?.delete(pluginKey);

            const remaining: Set<string> | undefined = pluginToCapabilities.get(pluginKey);
            if (remaining) {
                remaining.delete(capabilityKey);
                if (!remaining.size) {
                    pluginToCapabilities.delete(pluginKey);
                    const idx: number = canonicalPlugins.findIndex((p): boolean => normalize(p) === pluginKey);
                    if (idx !== -1) canonicalPlugins.splice(idx, 1);
                }
            }

            if (!capabilityToPlugins.get(capabilityKey)?.size) {
                capabilityToPlugins.delete(capabilityKey);
                const cidx = canonicalCapabilities.findIndex((c) => normalize(c) === capabilityKey);
                if (cidx !== -1) canonicalCapabilities.splice(cidx, 1);
            }

            return;
        }

        for (const capabilityKey of pluginToCapabilities.get(pluginKey) ?? []) {
            capabilityToPlugins.get(capabilityKey)?.delete(pluginKey);
        }
        pluginToCapabilities.delete(pluginKey);

        const idx: number = canonicalPlugins.findIndex((p): boolean => normalize(p) === pluginKey);
        if (idx !== -1) canonicalPlugins.splice(idx, 1);
    },
    /**
     * Get the plugin names registered under a capability.
     * @param {RegistryCapability} capability The capability to look up.
     * @returns {string[]} The plugin names that provide the capability.
     */
    getPluginsFor(capability: RegistryCapability): string[] {
        const set: Set<string> | undefined = capabilityToPlugins.get(normalize(String(capability)));
        return set ? [...set] : [];
    },
    /**
     * Get the capabilities provided by a plugin name.
     * @param {RegistryPluginName} name The plugin name to look up.
     * @returns {string[]} The capabilities provided by the plugin.
     */
    getCapabilitiesOf(name: RegistryPluginName): string[] {
        const set: Set<string> | undefined = pluginToCapabilities.get(normalize(String(name)));
        return set ? [...set] : [];
    },
    /**
     * Checks whether a list of installed plugins satisfies a capability.
     * @param {ReadonlyArray<{ name: string }>} installedPlugins The plugins reported by the node.
     * @param {RegistryCapability} capability The capability to check for.
     * @returns {boolean} Whether at least one installed plugin provides the capability.
     */
    hasCapability(installedPlugins: ReadonlyArray<{ name: string }>, capability: RegistryCapability): boolean {
        const set: Set<string> | undefined = capabilityToPlugins.get(normalize(String(capability)));
        if (!set?.size) return false;
        return installedPlugins.some((plugin): boolean => set.has(normalize(plugin.name)));
    },
    /**
     * Returns all canonical registered capabilities.
     * @returns {string[]} All canonical capability identifiers.
     */
    getCapabilities(): string[] {
        return canonicalCapabilities;
    },
    /**
     * Returns all canonical registered plugin names.
     * @returns {string[]} All canonical plugin names.
     */
    getPlugins(): string[] {
        return canonicalPlugins;
    },
    /**
     * Skip plugin validation, either globally or for specific capabilities.
     * @param {boolean | RegistryCapability | RegistryCapability[]} value `true` to skip every validation, or one/multiple capabilities to skip selectively.
     * @returns {void}
     * @example
     * ```ts
     * // Disable all plugin validation
     * PluginRegistry.skipValidation(true);
     *
     * // Skip a single capability
     * PluginRegistry.skipValidation(PluginCapabilities.Filters);
     *
     * // Skip multiple capabilities
     * PluginRegistry.skipValidation([PluginCapabilities.Lyrics, PluginCapabilities.Dspx]);
     * ```
     */
    skipValidation(value: boolean | RegistryCapability | RegistryCapability[]): void {
        if (typeof value === "boolean") {
            skipAll = value;
            return;
        }

        const values: RegistryCapability[] = Array.isArray(value) ? value : [value];
        for (const capability of values) {
            const capabilityKey: string = normalize(String(capability));
            if (capabilityKey.length) skippedCapabilities.add(capabilityKey);
        }
    },
    /**
     * Restore plugin validation. Without arguments restores all bypassed validations; with values, restores only the given capabilities.
     * @param {RegistryCapability | RegistryCapability[]} [value] The capability or capabilities whose validation should be restored.
     * @returns {void}
     * @example
     * ```ts
     * // Re-enable everything
     * PluginRegistry.restoreValidation();
     *
     * // Re-enable a specific capability
     * PluginRegistry.restoreValidation(PluginCapabilities.Filters);
     * ```
     */
    restoreValidation(value?: RegistryCapability | RegistryCapability[]): void {
        if (typeof value === "undefined") {
            skipAll = false;
            skippedCapabilities.clear();
            return;
        }

        const values: RegistryCapability[] = Array.isArray(value) ? value : [value];
        for (const capability of values) skippedCapabilities.delete(normalize(String(capability)));
    },
    /**
     * Checks whether plugin validation is currently skipped, either globally or for a specific capability.
     * @param {RegistryCapability} [capability] The capability to check; if omitted, only the global flag is checked.
     * @returns {boolean} Whether validation is currently skipped.
     * @example
     * ```ts
     * // Check if all validation is skipped
     * PluginRegistry.isValidationSkipped();
     *
     * // Check if a specific capability is skipped
     * PluginRegistry.isValidationSkipped(PluginCapabilities.Filters);
     * ```
     */
    isValidationSkipped(capability?: RegistryCapability): boolean {
        if (skipAll) return true;
        if (typeof capability === "undefined") return false;
        return skippedCapabilities.has(normalize(String(capability)));
    },
    /**
     * Validate that a node provides the required plugin capabilities.
     * @param {ValidatePluginsOptions} options The validation options.
     * @throws {NodeError} If the node is not ready, or if it does not satisfy the required/any capabilities.
     * @returns {void}
     * @example
     * ```ts
     * // Require all listed capabilities to be present
     * PluginRegistry.validate({ node, required: [PluginCapabilities.Filters] });
     *
     * // Require at least one of multiple capabilities
     * PluginRegistry.validate({ node, any: [PluginCapabilities.Lyrics] });
     * ```
     */
    validate(options: ValidatePluginsOptions): void {
        const info = options.node.info;
        if (!info) throw new NodeError({ id: options.node.id, message: "Node is not ready yet." });

        if (options.node.isNodelink()) {
            options.node.nodeManager.manager.emit(
                EventNames.Debug,
                DebugLevels.Node,
                `[Node] Skipping plugin validation for node ${options.node.id} because it is a Nodelink node.`,
            );
            return;
        }

        if (skipAll) {
            options.node.nodeManager.manager.emit(
                EventNames.Debug,
                DebugLevels.Node,
                `[Node] Skipping plugin validation for node ${options.node.id} because skipValidation(true) is active.`,
            );
            return;
        }

        const required: RegistryCapability[] = (options.required ?? []).filter(
            (capability): boolean => !skippedCapabilities.has(normalize(String(capability))),
        );
        const any: RegistryCapability[] = (options.any ?? []).filter(
            (capability): boolean => !skippedCapabilities.has(normalize(String(capability))),
        );

        const requestedCount: number = (options.required?.length ?? 0) + (options.any?.length ?? 0);
        if (requestedCount > 0 && !required.length && !any.length) {
            options.node.nodeManager.manager.emit(
                EventNames.Debug,
                DebugLevels.Node,
                `[Node] Skipping plugin validation for node ${options.node.id}: all requested capabilities are individually skipped.`,
            );
            return;
        }

        if (required.length) {
            const missing: RegistryCapability[] = required.filter((capability): boolean => !this.hasCapability(info.plugins, capability));
            if (missing.length) {
                throw new NodeError({
                    id: options.node.id,
                    message: `The node does not provide the following plugin capabilities: ${missing.join(", ")}.`,
                });
            }
        }

        if (any.length) {
            const satisfied: boolean = any.some((capability): boolean => this.hasCapability(info.plugins, capability));
            if (!satisfied) {
                throw new NodeError({
                    id: options.node.id,
                    message: `The node must provide at least one of the following plugin capabilities: ${any.join(", ")}.`,
                });
            }
        }
    },
    /**
     * Clear the entire registry and reset all validation skips. Intended for tests.
     * @returns {void}
     */
    clear(): void {
        capabilityToPlugins.clear();
        pluginToCapabilities.clear();
        canonicalCapabilities.length = 0;
        canonicalPlugins.length = 0;
        skippedCapabilities.clear();
        skipAll = false;
    },
} as const;

// Pre-register built-in plugins with their capabilities.
PluginRegistry.register([
    { capability: PluginCapabilities.Lyrics, name: PluginNames.LavaLyrics },
    { capability: PluginCapabilities.Lyrics, name: PluginNames.JavaLyrics },
    { capability: PluginCapabilities.Lyrics, name: PluginNames.LavaSrc },
    { capability: PluginCapabilities.ExtraSources, name: PluginNames.LavaSrc },
    { capability: PluginCapabilities.ExtraSources, name: PluginNames.Jiosaavn },
    { capability: PluginCapabilities.Filters, name: PluginNames.FilterPlugin },
    { capability: PluginCapabilities.Dspx, name: PluginNames.LavaDspx },
    { capability: PluginCapabilities.SponsorBlock, name: PluginNames.SponsorBlock },
    { capability: PluginCapabilities.Youtube, name: PluginNames.Youtube },
    { capability: PluginCapabilities.Search, name: PluginNames.LavaSearch },
]);
