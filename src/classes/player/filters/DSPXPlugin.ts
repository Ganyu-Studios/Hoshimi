import { type EchoSettings, type FilterPluginPassSettings, FilterType, type NormalizationSettings } from "../../../types/Filters";
import { PluginNames } from "../../../types/Node";
import type { FilterManagerStructure } from "../../../types/Structures";
import { DefaultFilterPreset } from "../../../util/constants";
import { validateNodePlugins } from "../../../util/functions/utils";
import { PlayerError } from "../../Errors";

/**
 * Class representing the DSPX Plugin filters for a player.
 * @class DSPXPluginFilter
 */
export class DSPXPluginFilter {
    /**
     * The filter manager instance.
     * @type {FilterManagerStructure}
     * @readonly
     */
    readonly manager: FilterManagerStructure;

    /**
     * Create a new DSPXPluginFilter instance.
     * @param {FilterManagerStructure} manager The filter manager instance.
     */
    constructor(manager: FilterManagerStructure) {
        this.manager = manager;
    }

    /**
     *
     * Set the low-pass filter with the given settings.
     * @param {FilterPluginPassSettings} [settings=DefaultFilter.DSPXLowPass] The settings for the low-pass filter.
     * @returns {Promise<this>} The instance of the filter manager.
     * @throws {PlayerError} If the node does not have the required plugin or filter enabled.
     * @example
     * ```ts
     * // Set the low-pass filter with custom settings
     * await player.filterManager.dspxPlugin.setLowPass({ cutoffFrequency: 500, boostFactor: 1.5 });
     * // Disable the low-pass filter
     * await player.filterManager.dspxPlugin.setLowPass();
     * ```
     */
    public async setLowPass(settings: Partial<FilterPluginPassSettings> = DefaultFilterPreset.DSPXLowPass): Promise<this> {
        validateNodePlugins({ node: this.manager.player.node, required: [PluginNames.LavaDspx] });

        if (!this.manager.player.node.info?.filters?.includes(FilterType.DSPXLowpass))
            throw new PlayerError("Node filters does not include the 'low-pass' filter. (Or the node doesn't have it enabled)");

        if (!this.manager.data) this.manager.data = {};
        if (!this.manager.data.pluginFilters) this.manager.data.pluginFilters = {};
        if (!this.manager.data.pluginFilters["low-pass"]) this.manager.data.pluginFilters["low-pass"] = {};
        if (this.manager.filters.lavalinkLavaDspxPlugin.lowPass) {
            delete this.manager.data.pluginFilters["low-pass"];
        } else {
            this.manager.data.pluginFilters["low-pass"] = { ...settings };
        }

        this.manager.filters.lavalinkLavaDspxPlugin.lowPass = !this.manager.filters.lavalinkLavaDspxPlugin.lowPass;

        await this.manager.apply();

        return this;
    }

    /**
     *
     * Set the high-pass filter with the given settings.
     * @param {FilterPluginPassSettings} [settings=DefaultFilter.DSPXHighPass] The settings for the high-pass filter.
     * @returns {Promise<this>} The instance of the filter manager.
     * @throws {PlayerError} If the node does not have the required plugin or filter enabled.
     * @example
     * ```ts
     * // Set the high-pass filter with custom settings
     * await player.filterManager.dspxPlugin.setHighPass({ cutoffFrequency: 2000, boostFactor: 0.8 });
     * // Disable the high-pass filter
     * await player.filterManager.dspxPlugin.setHighPass();
     * ```
     */
    public async setHighPass(settings: Partial<FilterPluginPassSettings> = DefaultFilterPreset.DSPXHighPass): Promise<this> {
        validateNodePlugins({ node: this.manager.player.node, required: [PluginNames.LavaDspx] });

        if (this.manager.player.node.info && !this.manager.player.node.info?.filters?.includes(FilterType.DSPXHighpass))
            throw new PlayerError("Node filters does not include the 'high-pass' filter. (Or the node doesn't have it enabled)");

        if (!this.manager.data) this.manager.data = {};
        if (!this.manager.data.pluginFilters) this.manager.data.pluginFilters = {};
        if (!this.manager.data.pluginFilters["high-pass"]) this.manager.data.pluginFilters["high-pass"] = {};

        if (this.manager.filters.lavalinkLavaDspxPlugin.highPass) {
            delete this.manager.data.pluginFilters["high-pass"];
        } else {
            this.manager.data.pluginFilters["high-pass"] = { ...settings };
        }

        this.manager.filters.lavalinkLavaDspxPlugin.highPass = !this.manager.filters.lavalinkLavaDspxPlugin.highPass;

        await this.manager.apply();

        return this;
    }

    /**
     *
     * Set the normalization filter with the given settings.
     * @param {NormalizationSettings} [settings=DefaultFilter.DSPXNormalization] The settings for the normalization filter.
     * @returns {Promise<this>} The instance of the filter manager.
     * @throws {PlayerError} If the node does not have the required plugin or filter enabled.
     * @example
     * ```ts
     * // Set the normalization filter with custom settings
     * await player.filterManager.dspxPlugin.setNormalization({ maxAmplitude: 0.9, adaptive: true });
     * // Disable the normalization filter
     * await player.filterManager.dspxPlugin.setNormalization();
     * ```
     */
    public async setNormalization(settings: Partial<NormalizationSettings> = DefaultFilterPreset.DSPXNormalization): Promise<this> {
        validateNodePlugins({ node: this.manager.player.node, required: [PluginNames.LavaDspx] });

        if (!this.manager.player.node.info?.filters?.includes(FilterType.DSPXNormalization))
            throw new PlayerError("Node filters does not include the 'normalization' filter. (Or the node doesn't have it enabled)");

        if (!this.manager.data) this.manager.data = {};
        if (!this.manager.data.pluginFilters) this.manager.data.pluginFilters = {};
        if (!this.manager.data.pluginFilters.normalization) this.manager.data.pluginFilters.normalization = {};

        if (this.manager.filters.lavalinkLavaDspxPlugin.normalization) {
            delete this.manager.data.pluginFilters.normalization;
        } else {
            this.manager.data.pluginFilters.normalization = { ...settings };
        }

        this.manager.filters.lavalinkLavaDspxPlugin.normalization = !this.manager.filters.lavalinkLavaDspxPlugin.normalization;

        await this.manager.apply();

        return this;
    }

    /**
     *
     * Set the echo filter with the given settings.
     * @param {EchoSettings} [settings=DefaultFilter.DSPXEcho] The settings for the echo filter.
     * @returns {Promise<this>} The instance of the filter manager.
     * @throws {PlayerError} If the node does not have the required plugin or filter enabled.
     * @example
     * ```ts
     * // Set the echo filter with custom settings
     * await player.filterManager.dspxPlugin.setEcho({ echoLength: 500, decay: 0.5, delay: 200 });
     * // Disable the echo filter
     * await player.filterManager.dspxPlugin.setEcho();
     * ```
     */
    public async setEcho(settings: Partial<EchoSettings> = DefaultFilterPreset.DSPXEcho): Promise<this> {
        validateNodePlugins({ node: this.manager.player.node, required: [PluginNames.LavaDspx] });

        if (!this.manager.player.node.info?.filters?.includes(FilterType.DSPXEcho))
            throw new PlayerError("Node filters does not include the 'echo' filter. (Or the node doesn't have it enabled)");

        if (!this.manager.data) this.manager.data = {};
        if (!this.manager.data.pluginFilters) this.manager.data.pluginFilters = {};
        if (!this.manager.data.pluginFilters.echo) this.manager.data.pluginFilters.echo = {};

        if (this.manager.filters.lavalinkLavaDspxPlugin.echo) {
            delete this.manager.data.pluginFilters.echo;
        } else {
            this.manager.data.pluginFilters.echo = { ...settings };
        }

        this.manager.filters.lavalinkLavaDspxPlugin.echo = !this.manager.filters.lavalinkLavaDspxPlugin.echo;

        await this.manager.apply();

        return this;
    }
}
