import { type FilterRegistration, FilterRegistry, FilterScope, type RegistryFilterName } from "../../../registry/FiltersRegistry";
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
import { AudioOutputData, DefaultFilterPreset, DefaultPlayerFilters } from "../../../util/constants";
import { PlayerError } from "../../Errors";
import { DSPXPluginFilter } from "./DSPXPlugin";
import { LavalinkPluginFilter } from "./LavalinkPlugin";

/**
 * Class representing a filter manager for a player.
 *
 * Backed by the {@link FilterRegistry}: filter writes and lookups go through the registry,
 * which knows the canonical name, scope (Core/Plugin/Vendor), payload envelope, and default-state predicate.
 *
 * The previous `filters: EnabledPlayerFilters` toggle object has been removed; every "is X active"
 * question is derived on-demand from {@link FilterRegistry.isDefault} against the current payload.
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
     * The current filter payload (wire-bound). Mutated by {@link apply} and {@link clear}.
     * @type {FilterSettings}
     * @public
     */
    public data: FilterSettings = structuredClone(DefaultPlayerFilters);

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
            this.writeToEnvelope(entry, payload);
        }
        return this.commit();
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
        if (entry) this.clearFromEnvelope(entry);
        return this.commit();
    }

    /**
     * Whether the given filter is currently active (its payload is not the default/off state).
     * @param {RegistryFilterName} name The canonical filter name (or alias).
     * @returns {boolean} True if the filter has a non-default payload, false otherwise.
     */
    public isEnabled(name: RegistryFilterName): boolean {
        const entry = FilterRegistry.resolve(name, this.player.node);
        if (!entry) return false;
        const payload = this.readFromEnvelope(entry);
        return !FilterRegistry.isDefault(name, payload);
    }

    /**
     * Returns every active filter name as derived from the current payload.
     * @returns {string[]} Canonical filter names whose payload is non-default.
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
     * Reset every filter to its default state and commit.
     * @returns {Promise<this>} A promise that resolves to the filter manager.
     */
    public async reset(): Promise<this> {
        this.bands.length = 0;
        this.data = structuredClone(DefaultPlayerFilters);
        return this.commit();
    }

    /**
     * Serialise the current filter payload.
     * @returns {FilterSettings} A deep clone of the wire payload (a snapshot; mutating it never touches live state).
     */
    public toJSON(): FilterSettings {
        return structuredClone(this.data);
    }

    // ============================================================
    // Wire commit
    // ============================================================

    /**
     * Build the wire payload from {@link data} (stripping default-state entries and entries the node does not advertise),
     * then send it via the REST `updatePlayer` endpoint.
     * @returns {Promise<this>} A promise that resolves to the filter manager.
     * @private
     */
    private async commit(): Promise<this> {
        if (!this.player.node.sessionId) return this;

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
                if (this.isNestedPluginEnvelope(key, value)) {
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
                if (this.isNestedPluginEnvelope(key, value)) {
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
        return this;
    }

    /**
     * Detect whether a `pluginFilters` key is a nested-plugin envelope (e.g. `"lavalink-filter-plugin"`)
     * rather than a flat filter (e.g. `"echo"`). Decided by registry lookup: a key not registered as a
     * filter, whose value is a plain object, is treated as a nested envelope.
     * @private
     */
    private isNestedPluginEnvelope(key: string, value: unknown): boolean {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        // A key that is not any registered filter's wire key is a plugin-name wrapper holding nested filters.
        // (Decided structurally, independent of which plugins the node currently has installed.)
        return !FilterRegistry.isWireKey(key);
    }

    // ============================================================
    // Envelope helpers
    // ============================================================

    /**
     * Write `payload` into the correct envelope for the given entry.
     * @private
     */
    private writeToEnvelope(entry: FilterRegistration, payload: unknown): void {
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
     * @private
     */
    private readFromEnvelope(entry: FilterRegistration): unknown {
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
     * @private
     */
    private clearFromEnvelope(entry: FilterRegistration): void {
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
        return this.commit();
    }

    /**
     * Clear every equalizer band.
     */
    public async clearEQBands(): Promise<this> {
        this.bands.length = 0;
        this.data.equalizer = [];
        return this.commit();
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
