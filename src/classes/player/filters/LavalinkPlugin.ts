import { type EchoSettings, FilterType, type LavalinkFilterPluginReverbSettings } from "../../../types/Filters";
import type { Omit } from "../../../types/Manager";
import type { FilterManagerStructure } from "../../../types/Structures";
import { DefaultFilterPreset } from "../../../util/constants";

type NonLengthEchoSettings = Omit<EchoSettings, "echoLength">;

/**
 * Thin facade over the `lavalink-filter-plugin` filters.
 *
 * Each setter delegates to {@link FilterManager.set}; validation, envelope routing,
 * and node-capability checks are handled by the {@link FilterRegistry}.
 *
 * @class LavalinkPluginFilter
 */
export class LavalinkPluginFilter {
    /**
     * The filter manager instance.
     * @type {FilterManagerStructure}
     * @private
     * @readonly
     */
    private readonly manager: FilterManagerStructure;

    /**
     * Creates an instance of LavalinkPluginFilter.
     * @param {FilterManagerStructure} filters The filter manager instance.
     */
    constructor(filters: FilterManagerStructure) {
        this.manager = filters;
    }

    /**
     * Set the echo filter (idempotent).
     * @param {Partial<Omit<EchoSettings, "echoLength">>} [settings=DefaultFilterPreset.PluginEcho] Echo settings.
     * @returns {Promise<FilterManagerStructure>} The filter manager.
     * @example
     * ```ts
     * await player.filterManager.plugin.setEcho({ decay: 0.5, delay: 200 });
     * // To turn off:
     * await player.filterManager.clear(FilterType.Echo);
     * ```
     */
    public async setEcho(settings: Partial<NonLengthEchoSettings> = DefaultFilterPreset.PluginEcho): Promise<FilterManagerStructure> {
        return this.manager.set<NonLengthEchoSettings>(FilterType.Echo, {
            decay: settings.decay ?? 0,
            delay: settings.delay ?? 0,
        });
    }

    /**
     * Set the reverb filter (idempotent).
     * @param {Partial<LavalinkFilterPluginReverbSettings>} [settings=DefaultFilterPreset.PluginReverb] Reverb settings.
     * @returns {Promise<FilterManagerStructure>} The filter manager.
     * @example
     * ```ts
     * await player.filterManager.plugin.setReverb({ delays: [50, 100], gains: [0.5, 0.3] });
     * // To turn off:
     * await player.filterManager.clear(FilterType.Reverb);
     * ```
     */
    public async setReverb(
        settings: Partial<LavalinkFilterPluginReverbSettings> = DefaultFilterPreset.PluginReverb,
    ): Promise<FilterManagerStructure> {
        return this.manager.set<LavalinkFilterPluginReverbSettings>(FilterType.Reverb, {
            delays: settings.delays ?? [],
            gains: settings.gains ?? [],
        });
    }
}
