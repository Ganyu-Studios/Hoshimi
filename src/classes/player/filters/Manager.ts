import { type FilterRegistration, FilterRegistry, type RegistryFilterName } from "../../../registry/FiltersRegistry";
import {
    AudioOutput,
    type ChannelMixSettings,
    type DistortionSettings,
    type EQBandSettings,
    type FilterSettings,
    FilterType,
    type KaraokeSettings,
    type LowPassSettings,
    type SetFilterOptions,
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
 * A filter is active when its key is present in the payload, and inactive when it is absent: there is
 * no neutral "off" payload. {@link FilterManager.set} writes a key, {@link FilterManager.clear} removes
 * it, and {@link FilterManager.isEnabled} is presence.
 *
 * {@link FilterRegistry} routes the filters it knows to their envelope (top level, flat `pluginFilters`,
 * or nested under a plugin) and validates them against the node. Filters it does not know can still be
 * set: their envelope comes from {@link SetFilterOptions} instead, so no registration is required.
 *
 * The commit/envelope internals live in {@link FilterPayload} (util/functions/filters), which takes the
 * manager as an argument rather than through `this` — no private members, matching the project convention.
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
    // Generic API
    // ============================================================

    /**
     * Set a filter to `payload` and commit.
     *
     * Any filter can be set, registered or not: {@link SetFilterOptions} decides the envelope when the
     * registry does not know the name (or when you want to override what it resolved). Idempotent —
     * calling repeatedly with the same payload yields the same wire state.
     * @param {RegistryFilterName} name The filter name (or alias) to set.
     * @param {TPayload} payload The payload to write.
     * @param {SetFilterOptions} [options={}] Envelope and validation options.
     * @returns {Promise<this>} A promise that resolves to the filter manager.
     * @throws {PlayerError} If `plugin` and `top` are combined, or if validation was requested for a
     * filter the node does not advertise.
     * @throws {NodeError} If a registered filter is not supported by the node (unless `validate: false`).
     * @example
     * ```ts
     * await player.filterManager.set(FilterType.Echo, { decay: 0.5, delay: 200 }); // registry routes it
     * await player.filterManager.set("myFilter", { gain: 2 });                     // pluginFilters.myFilter
     * await player.filterManager.set("boost", { gain: 2 }, { plugin: "my-plugin" }); // nested
     * await player.filterManager.set("forkEcho", { decay: 0.5 }, { top: true });   // top level
     * ```
     */
    public async set<TPayload>(name: RegistryFilterName, payload: TPayload, options: SetFilterOptions = {}): Promise<this> {
        const routed: boolean = typeof options.plugin !== "undefined" || options.top === true;
        const registration: FilterRegistration | null = FilterRegistry.resolve(name, this.player.node);

        // Registered filters are validated by default; an explicit envelope or an unknown name is taken
        // at face value, since the registry has nothing to say about either.
        if (options.validate ?? (!routed && registration !== null)) {
            if (registration) FilterRegistry.validate({ node: this.player.node, name });
            else if (!this.player.node.info?.filters?.some((filter): boolean => filter === String(name)))
                throw new PlayerError(`The node ${this.player.node.id} does not advertise the filter '${String(name)}'.`);
        }

        FilterPayload.write(this, FilterPayload.route(this, name, options), payload);
        await FilterPayload.commit(this);

        return this;
    }

    /**
     * Commit the current filter payload to the node.
     * @returns {Promise<this>} A promise that resolves to the filter manager.
     */
    public apply(): Promise<this>;
    /**
     * Set the given filter to `payload` and commit.
     * @deprecated Use {@link FilterManager.set} instead, which also takes {@link SetFilterOptions}.
     * @param {RegistryFilterName} name The canonical filter name (or alias) to set.
     * @param {TPayload} payload The payload to write into the envelope chosen by the registry.
     * @returns {Promise<this>} A promise that resolves to the filter manager.
     */
    public apply<TPayload>(name: RegistryFilterName, payload: TPayload): Promise<this>;
    public async apply<TPayload>(name?: RegistryFilterName, payload?: TPayload): Promise<this> {
        if (typeof name !== "undefined") return this.set<TPayload | undefined>(name, payload);

        await FilterPayload.commit(this);
        return this;
    }

    /**
     * Remove the given filter from the payload and commit.
     *
     * Pass the same {@link SetFilterOptions} routing used to set it, so an unregistered filter is cleared
     * from the envelope it was written to.
     * @param {RegistryFilterName} name The filter name (or alias) to clear.
     * @param {SetFilterOptions} [options={}] The routing options used when it was set.
     * @returns {Promise<this>} A promise that resolves to the filter manager.
     * @example
     * ```ts
     * await player.filterManager.clear(FilterType.Karaoke);
     * await player.filterManager.clear("boost", { plugin: "my-plugin" });
     * ```
     */
    public async clear(name: RegistryFilterName, options: SetFilterOptions = {}): Promise<this> {
        FilterPayload.clear(this, FilterPayload.route(this, name, options));
        await FilterPayload.commit(this);

        return this;
    }

    /**
     * Whether the given filter is currently active, i.e. whether its key is present in the payload.
     * @param {RegistryFilterName} name The filter name (or alias).
     * @param {SetFilterOptions} [options={}] The routing options used when it was set.
     * @returns {boolean} True if the filter has a payload, false otherwise.
     */
    public isEnabled(name: RegistryFilterName, options: SetFilterOptions = {}): boolean {
        return typeof FilterPayload.read(this, FilterPayload.route(this, name, options)) !== "undefined";
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
     * @param {SetFilterOptions} [options={}] The routing options used when it was set.
     * @returns {boolean} True if active.
     */
    public has(filter: RegistryFilterName, options: SetFilterOptions = {}): boolean {
        return this.isEnabled(filter, options);
    }

    /**
     * Drop every filter and commit an empty payload.
     * @returns {Promise<this>} A promise that resolves to the filter manager.
     */
    public async reset(): Promise<this> {
        this.bands.length = 0;
        this.data = {};
        await FilterPayload.commit(this);
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
    // Typed convenience setters (idempotent — delegate to set)
    // ============================================================

    /**
     * Set the volume.
     * @param {number} volume Volume between 0 and 5.
     */
    public async setVolume(volume: number): Promise<this> {
        if (typeof volume !== "number" || Number.isNaN(volume) || volume < 0 || volume > 5)
            throw new PlayerError("Volume must be a number between 0 and 5.");
        return this.set<number>(FilterType.Volume, volume);
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
        await FilterPayload.commit(this);
        return this;
    }

    /**
     * Clear every equalizer band.
     */
    public async clearEQBands(): Promise<this> {
        this.bands.length = 0;
        delete this.data.equalizer;
        await FilterPayload.commit(this);
        return this;
    }

    /**
     * Set the karaoke filter.
     */
    public async setKaraoke(settings: Partial<KaraokeSettings> = DefaultFilterPreset.Karaoke): Promise<this> {
        return this.set<KaraokeSettings>(FilterType.Karaoke, {
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
        return this.set<TremoloSettings>(FilterType.Tremolo, {
            frequency: settings.frequency ?? 0,
            depth: settings.depth ?? 0,
        });
    }

    /**
     * Set the vibrato filter.
     */
    public async setVibrato(settings: Partial<TremoloSettings> = DefaultFilterPreset.Vibrato): Promise<this> {
        return this.set<TremoloSettings>(FilterType.Vibrato, {
            frequency: settings.frequency ?? 0,
            depth: settings.depth ?? 0,
        });
    }

    /**
     * Set the low-pass filter.
     */
    public async setLowPass(settings: Partial<LowPassSettings> = DefaultFilterPreset.Lowpass): Promise<this> {
        return this.set<LowPassSettings>(FilterType.LowPass, { smoothing: settings.smoothing ?? 0 });
    }

    /**
     * Set the distortion filter.
     */
    public async setDistortion(settings: Partial<DistortionSettings> = DefaultFilterPreset.Distortion): Promise<this> {
        return this.set<DistortionSettings>(FilterType.Distortion, { ...settings });
    }

    /**
     * Set the timescale filter explicitly.
     */
    public async setTimescale(settings: Partial<TimescaleSettings>): Promise<this> {
        return this.set<TimescaleSettings>(FilterType.Timescale, {
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
        return this.set<TimescaleSettings>(FilterType.Timescale, { ...current, speed });
    }

    /**
     * Adjust timescale rate only.
     */
    public async setRate(rate: number = 1): Promise<this> {
        const current: TimescaleSettings = this.data.timescale ?? { speed: 1, pitch: 1, rate: 1 };
        return this.set<TimescaleSettings>(FilterType.Timescale, { ...current, rate });
    }

    /**
     * Adjust timescale pitch only.
     */
    public async setPitch(pitch: number = 1): Promise<this> {
        const current: TimescaleSettings = this.data.timescale ?? { speed: 1, pitch: 1, rate: 1 };
        return this.set<TimescaleSettings>(FilterType.Timescale, { ...current, pitch });
    }

    /**
     * Apply the Nightcore preset to the timescale filter.
     */
    public async setNightcore(settings: Partial<TimescaleSettings> = DefaultFilterPreset.Nightcore): Promise<this> {
        return this.set<TimescaleSettings>(FilterType.Timescale, {
            speed: settings.speed ?? DefaultFilterPreset.Nightcore.speed,
            pitch: settings.pitch ?? DefaultFilterPreset.Nightcore.pitch,
            rate: settings.rate ?? DefaultFilterPreset.Nightcore.rate,
        });
    }

    /**
     * Apply the Vaporwave preset to the timescale filter.
     */
    public async setVaporwave(settings: Partial<TimescaleSettings> = DefaultFilterPreset.Vaporwave): Promise<this> {
        return this.set<TimescaleSettings>(FilterType.Timescale, {
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
        return this.set<ChannelMixSettings>(FilterType.ChannelMix, { ...AudioOutputData[output] });
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
