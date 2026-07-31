import { FilterRegistry, type RegistryFilterName } from "../../../registry/FiltersRegistry";
import {
    AudioOutput,
    type ChannelMixSettings,
    type DistortionSettings,
    type EQBandSettings,
    type FilterSettings,
    FilterType,
    type KaraokeSettings,
    type LowPassSettings,
    type TimescaleSettings,
    type TremoloSettings,
} from "../../../types/Filters";
import type { RestOrArray } from "../../../types/Manager";
import type { PlayerStructure } from "../../../types/Structures";
import { AudioOutputData, DefaultFilterPreset } from "../../../util/constants";
import { FilterPayload } from "../../../util/functions/filters";
import { PlayerError } from "../../Errors";
import { DSPXPluginFilter } from "./DSPXPlugin";
import { LavalinkPluginFilter } from "./LavalinkPlugin";

/**
 * Class representing a filter manager for a player.
 *
 * Backed by the {@link FilterRegistry}: filter writes and lookups go through the registry,
 * which knows the canonical name, scope (Core/Plugin/Vendor), payload envelope, and default-state predicate.
 *
 * A filter is active when its key is present in the payload, and inactive when it is absent: there is
 * no neutral "off" payload. {@link FilterManager.set} writes a key, {@link FilterManager.clear} removes
 * it, and {@link FilterManager.isEnabled} is presence.
 *
 * The commit/envelope internals live in {@link FilterPayload} (util/functions/filters) as `this`-helpers
 * invoked with `.call(this)`, rather than private members, matching the project convention.
 *
 * @class FilterManager
 */
export class FilterManager {
    /**
     * The player this filter manager belongs to.
     * @type {PlayerStructure}
     * @public
     * @readonly
     */
    public readonly player: PlayerStructure;

    /**
     * The bands applied to the player. Kept in sync with `data.equalizer`.
     * @type {EQBandSettings[]}
     * @readonly
     */
    public readonly bands: EQBandSettings[] = [];

    /**
     * The current filter payload (wire-bound). Starts empty: a key is only present while its filter is
     * active. Mutated by {@link apply} and {@link clear}.
     * @type {FilterSettings}
     * @public
     */
    public data: FilterSettings = {};

    /**
     * Thin facade for filters provided by the `lavalink-filter-plugin`.
     * @type {LavalinkPluginFilter}
     * @readonly
     */
    public readonly plugin: LavalinkPluginFilter;

    /**
     * Thin facade for filters provided by the `lavadspx-plugin`.
     * @type {DSPXPluginFilter}
     * @readonly
     */
    public readonly dspx: DSPXPluginFilter;

    /**
     * Creates a new filter manager.
     * @param {PlayerStructure} player The player this filter manager belongs to.
     */
    constructor(player: PlayerStructure) {
        this.player = player;
        this.plugin = new LavalinkPluginFilter(this);
        this.dspx = new DSPXPluginFilter(this);
    }

    // ============================================================
    // Generic registry-driven API
    // ============================================================

    /**
     * Commit the current filter payload to the node.
     * @returns {Promise<this>} A promise that resolves to the filter manager.
     */
    public apply(): Promise<this>;
    /**
     * Set the given filter to `payload` and commit. Idempotent — calling repeatedly
     * with the same payload yields the same wire state.
     * @param {RegistryFilterName} name The canonical filter name (or alias) to set.
     * @param {TPayload} payload The payload to write into the envelope chosen by the registry.
     * @returns {Promise<this>} A promise that resolves to the filter manager.
     * @throws {Error} If the filter is not registered, or if the node does not advertise the filter / required plugin.
     * @example
     * ```ts
     * await player.filterManager.apply(FilterType.Echo, { decay: 0.5, delay: 200 });
     * ```
     */
    public apply<TPayload>(name: RegistryFilterName, payload: TPayload): Promise<this>;
    public async apply<TPayload>(name?: RegistryFilterName, payload?: TPayload): Promise<this> {
        if (typeof name !== "undefined") {
            FilterRegistry.validate({ node: this.player.node, name });
            const entry = FilterRegistry.resolve(name, this.player.node);
            if (!entry) throw new PlayerError(`No registered filter resolves '${String(name)}'.`);
            FilterPayload.write.call(this, entry, payload);
        }
        await FilterPayload.commit.call(this);
        return this;
    }

    /**
     * Remove the given filter from the payload and commit.
     * @param {RegistryFilterName} name The canonical filter name (or alias) to clear.
     * @returns {Promise<this>} A promise that resolves to the filter manager.
     * @example
     * ```ts
     * await player.filterManager.clear(FilterType.Karaoke);
     * ```
     */
    public async clear(name: RegistryFilterName): Promise<this> {
        const entry = FilterRegistry.resolve(name, this.player.node);
        if (entry) FilterPayload.clear.call(this, entry);
        await FilterPayload.commit.call(this);
        return this;
    }

    /**
     * Whether the given filter is currently active, i.e. whether its key is present in the payload.
     * @param {RegistryFilterName} name The canonical filter name (or alias).
     * @returns {boolean} True if the filter has a payload, false otherwise.
     */
    public isEnabled(name: RegistryFilterName): boolean {
        const entry = FilterRegistry.resolve(name, this.player.node);
        if (!entry) return false;
        return typeof FilterPayload.read.call(this, entry) !== "undefined";
    }

    /**
     * Returns every active filter name as derived from the current payload.
     *
     * Only covers registered filters; keys written for unregistered ones are not listed.
     * @returns {string[]} Canonical filter names present in the payload.
     */
    public getEnabled(): string[] {
        return FilterRegistry.getFilters().filter((name): boolean => this.isEnabled(name));
    }

    /**
     * Backward-compatible alias for {@link isEnabled}.
     * @param {RegistryFilterName} filter The filter to check.
     * @returns {boolean} True if active.
     */
    public has(filter: RegistryFilterName): boolean {
        return this.isEnabled(filter);
    }

    /**
     * Drop every filter and commit an empty payload.
     * @returns {Promise<this>} A promise that resolves to the filter manager.
     */
    public async reset(): Promise<this> {
        this.bands.length = 0;
        this.data = {};
        await FilterPayload.commit.call(this);
        return this;
    }

    /**
     * Serialise the current filter payload.
     * @returns {FilterSettings} A deep clone of the wire payload (a snapshot; mutating it never touches live state).
     */
    public toJSON(): FilterSettings {
        return structuredClone(this.data);
    }

    // ============================================================
    // Typed convenience setters (idempotent — delegate to apply)
    // ============================================================

    /**
     * Set the volume.
     * @param {number} volume Volume between 0 and 5.
     */
    public async setVolume(volume: number): Promise<this> {
        if (typeof volume !== "number" || Number.isNaN(volume) || volume < 0 || volume > 5)
            throw new PlayerError("Volume must be a number between 0 and 5.");
        return this.apply<number>(FilterType.Volume, volume);
    }

    /**
     * Set one or more equalizer bands. Keeps `this.bands` and `data.equalizer` in sync.
     */
    public async setEQBand(...bands: RestOrArray<EQBandSettings>): Promise<this> {
        const list: EQBandSettings[] = bands.flat();
        if (!list.length || !list.every((b): boolean => typeof b.band === "number" && typeof b.gain === "number"))
            throw new PlayerError("Bands must be a non-empty object array containing 'band' and 'gain' properties.");
        for (const { band, gain } of list) this.bands[band] = { band, gain };
        this.data.equalizer = [...this.bands];
        await FilterPayload.commit.call(this);
        return this;
    }

    /**
     * Clear every equalizer band.
     */
    public async clearEQBands(): Promise<this> {
        this.bands.length = 0;
        delete this.data.equalizer;
        await FilterPayload.commit.call(this);
        return this;
    }

    /**
     * Set the karaoke filter.
     */
    public async setKaraoke(settings: Partial<KaraokeSettings> = DefaultFilterPreset.Karaoke): Promise<this> {
        return this.apply<KaraokeSettings>(FilterType.Karaoke, {
            level: settings.level ?? 0,
            monoLevel: settings.monoLevel ?? 0,
            filterBand: settings.filterBand ?? 0,
            filterWidth: settings.filterWidth ?? 0,
        });
    }

    /**
     * Set the tremolo filter.
     */
    public async setTremolo(settings: Partial<TremoloSettings> = DefaultFilterPreset.Tremolo): Promise<this> {
        return this.apply<TremoloSettings>(FilterType.Tremolo, {
            frequency: settings.frequency ?? 0,
            depth: settings.depth ?? 0,
        });
    }

    /**
     * Set the vibrato filter.
     */
    public async setVibrato(settings: Partial<TremoloSettings> = DefaultFilterPreset.Vibrato): Promise<this> {
        return this.apply<TremoloSettings>(FilterType.Vibrato, {
            frequency: settings.frequency ?? 0,
            depth: settings.depth ?? 0,
        });
    }

    /**
     * Set the low-pass filter.
     */
    public async setLowPass(settings: Partial<LowPassSettings> = DefaultFilterPreset.Lowpass): Promise<this> {
        return this.apply<LowPassSettings>(FilterType.LowPass, { smoothing: settings.smoothing ?? 0 });
    }

    /**
     * Set the distortion filter.
     */
    public async setDistortion(settings: Partial<DistortionSettings> = DefaultFilterPreset.Distortion): Promise<this> {
        return this.apply<DistortionSettings>(FilterType.Distortion, { ...settings });
    }

    /**
     * Set the timescale filter explicitly.
     */
    public async setTimescale(settings: Partial<TimescaleSettings>): Promise<this> {
        return this.apply<TimescaleSettings>(FilterType.Timescale, {
            speed: settings.speed ?? 1,
            pitch: settings.pitch ?? 1,
            rate: settings.rate ?? 1,
        });
    }

    /**
     * Adjust timescale speed only.
     */
    public async setSpeed(speed: number = 1): Promise<this> {
        const current: TimescaleSettings = this.data.timescale ?? { speed: 1, pitch: 1, rate: 1 };
        return this.apply<TimescaleSettings>(FilterType.Timescale, { ...current, speed });
    }

    /**
     * Adjust timescale rate only.
     */
    public async setRate(rate: number = 1): Promise<this> {
        const current: TimescaleSettings = this.data.timescale ?? { speed: 1, pitch: 1, rate: 1 };
        return this.apply<TimescaleSettings>(FilterType.Timescale, { ...current, rate });
    }

    /**
     * Adjust timescale pitch only.
     */
    public async setPitch(pitch: number = 1): Promise<this> {
        const current: TimescaleSettings = this.data.timescale ?? { speed: 1, pitch: 1, rate: 1 };
        return this.apply<TimescaleSettings>(FilterType.Timescale, { ...current, pitch });
    }

    /**
     * Apply the Nightcore preset to the timescale filter.
     */
    public async setNightcore(settings: Partial<TimescaleSettings> = DefaultFilterPreset.Nightcore): Promise<this> {
        return this.apply<TimescaleSettings>(FilterType.Timescale, {
            speed: settings.speed ?? DefaultFilterPreset.Nightcore.speed,
            pitch: settings.pitch ?? DefaultFilterPreset.Nightcore.pitch,
            rate: settings.rate ?? DefaultFilterPreset.Nightcore.rate,
        });
    }

    /**
     * Apply the Vaporwave preset to the timescale filter.
     */
    public async setVaporwave(settings: Partial<TimescaleSettings> = DefaultFilterPreset.Vaporwave): Promise<this> {
        return this.apply<TimescaleSettings>(FilterType.Timescale, {
            speed: settings.speed ?? DefaultFilterPreset.Vaporwave.speed,
            pitch: settings.pitch ?? DefaultFilterPreset.Vaporwave.pitch,
            rate: settings.rate ?? DefaultFilterPreset.Vaporwave.rate,
        });
    }

    /**
     * Whether the timescale currently matches the Nightcore preset exactly.
     */
    public isNightcore(): boolean {
        const t: TimescaleSettings | null | undefined = this.data.timescale;
        return (
            !!t &&
            t.speed === DefaultFilterPreset.Nightcore.speed &&
            t.pitch === DefaultFilterPreset.Nightcore.pitch &&
            t.rate === DefaultFilterPreset.Nightcore.rate
        );
    }

    /**
     * Whether the timescale currently matches the Vaporwave preset exactly.
     */
    public isVaporwave(): boolean {
        const t: TimescaleSettings | null | undefined = this.data.timescale;
        return (
            !!t &&
            t.speed === DefaultFilterPreset.Vaporwave.speed &&
            t.pitch === DefaultFilterPreset.Vaporwave.pitch &&
            t.rate === DefaultFilterPreset.Vaporwave.rate
        );
    }

    /**
     * Set the audio output. Writes the matching channelMix preset.
     */
    public async setAudioOutput(output: AudioOutput): Promise<this> {
        const outputs: AudioOutput[] = Object.values(AudioOutput);
        if (!outputs.includes(output)) throw new PlayerError(`Audio output must be one of: ${outputs.join(", ")}.`);
        return this.apply<ChannelMixSettings>(FilterType.ChannelMix, { ...AudioOutputData[output] });
    }

    /**
     * Whether the timescale represents any non-default playback rate that is neither Nightcore nor Vaporwave.
     */
    public isCustomTimescale(): boolean {
        const t: TimescaleSettings | null | undefined = this.data.timescale;
        if (!t) return false;
        if ((t.speed ?? 1) === 1 && (t.pitch ?? 1) === 1 && (t.rate ?? 1) === 1) return false;
        return !this.isNightcore() && !this.isVaporwave();
    }

    /**
     * The current audio output mode, derived from `data.channelMix`.
     */
    public get audioOutput(): AudioOutput {
        const m: ChannelMixSettings | null | undefined = this.data.channelMix;
        if (!m) return AudioOutput.Stereo;
        for (const out of Object.values(AudioOutput)) {
            const preset: ChannelMixSettings = AudioOutputData[out];
            if (
                preset.leftToLeft === m.leftToLeft &&
                preset.leftToRight === m.leftToRight &&
                preset.rightToLeft === m.rightToLeft &&
                preset.rightToRight === m.rightToRight
            )
                return out;
        }
        return AudioOutput.Stereo;
    }
}
