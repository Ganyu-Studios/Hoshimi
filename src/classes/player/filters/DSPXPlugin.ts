import { type EchoSettings, type FilterPluginPassSettings, FilterType, type NormalizationSettings } from "../../../types/Filters";
import type { FilterManagerStructure } from "../../../types/Structures";
import { DefaultFilterPreset } from "../../../util/constants";

/**
 * Thin facade over the `lavadspx-plugin` filters.
 *
 * Each setter delegates to {@link FilterManager.set}; validation, envelope routing,
 * and node-capability checks are handled by the {@link FilterRegistry}.
 *
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
     * Set the DSPX low-pass filter (idempotent).
     * @example
     * ```ts
     * await player.filterManager.dspx.setLowPass({ cutoffFrequency: 500, boostFactor: 1.5 });
     * await player.filterManager.clear(FilterType.DSPXLowpass);
     * ```
     */
    public async setLowPass(
        settings: Partial<FilterPluginPassSettings> = DefaultFilterPreset.DSPXLowPass,
    ): Promise<FilterManagerStructure> {
        return this.manager.set<FilterPluginPassSettings>(FilterType.DSPXLowpass, {
            boostFactor: settings.boostFactor ?? 0,
            cutoffFrequency: settings.cutoffFrequency ?? 0,
        });
    }

    /**
     * Set the DSPX high-pass filter (idempotent).
     */
    public async setHighPass(
        settings: Partial<FilterPluginPassSettings> = DefaultFilterPreset.DSPXHighPass,
    ): Promise<FilterManagerStructure> {
        return this.manager.set<FilterPluginPassSettings>(FilterType.DSPXHighpass, {
            boostFactor: settings.boostFactor ?? 0,
            cutoffFrequency: settings.cutoffFrequency ?? 0,
        });
    }

    /**
     * Set the DSPX normalization filter (idempotent).
     */
    public async setNormalization(
        settings: Partial<NormalizationSettings> = DefaultFilterPreset.DSPXNormalization,
    ): Promise<FilterManagerStructure> {
        return this.manager.set<NormalizationSettings>(FilterType.DSPXNormalization, { ...settings } as NormalizationSettings);
    }

    /**
     * Set the DSPX echo filter (idempotent).
     */
    public async setEcho(settings: Partial<EchoSettings> = DefaultFilterPreset.DSPXEcho): Promise<FilterManagerStructure> {
        return this.manager.set<EchoSettings>(FilterType.DSPXEcho, { ...settings } as EchoSettings);
    }
}
