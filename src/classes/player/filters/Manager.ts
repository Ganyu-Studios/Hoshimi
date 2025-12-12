import {
    AudioOutput,
    type DistortionSettings,
    type EnabledPlayerFilters,
    type EQBandSettings,
    type FilterSettings,
    FilterType,
    type KaraokeSettings,
    type LowPassSettings,
    type TimescaleSettings,
    type TremoloSettings,
} from "../../../types/Filters";
import type { Omit, RestOrArray } from "../../../types/Manager";
import type { PlayerStructure } from "../../../types/Structures";
import { AudioOutputData, DefaultFilterPreset, DefaultPlayerFilters } from "../../../util/constants";
import { isValid } from "../../../util/functions/utils";
import { PlayerError } from "../../Errors";
import { DSPXPluginFilter } from "./DSPXPlugin";
import { LavalinkPluginFilter } from "./LavalinkPlugin";

/**
 * Class representing a filter manager for a player.
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
     * The bands applied to the player.
     * @type {EQBandSettings[]}
     * @readonly
     */
    public readonly bands: EQBandSettings[] = [];

    /**
     * The current filter settings applied to the player.
     * @type {FilterSettings}
     * @public
     */
    public data: FilterSettings = { ...DefaultPlayerFilters };

    /**
     * The enabled filters for the player.
     * @type {EnabledPlayerFilters}
     */
    public filters: EnabledPlayerFilters = {
        audioOutput: AudioOutput.Stereo,
        volume: false,
        vaporwave: false,
        custom: false,
        nightcore: false,
        rotation: false,
        karaoke: false,
        tremolo: false,
        vibrato: false,
        lowPass: false,
        distortion: false,
        timescale: false,
        lavalinkFilterPlugin: {
            echo: false,
            reverb: false,
        },
        lavalinkLavaDspxPlugin: {
            lowPass: false,
            highPass: false,
            normalization: false,
            echo: false,
        },
    };

    /**
     * The lavalink plugin filters manager.
     * @type {LavalinkPluginFilter}
     * @readonly
     */
    readonly plugin: LavalinkPluginFilter;

    /**
     * The DSPX plugin filters manager.
     * @type {DSPXPluginFilter}
     * @readonly
     */
    readonly dspx: DSPXPluginFilter;

    /**
     *
     * Creates a new filter manager.
     * @param {PlayerStructure} player The player this filter manager belongs to.
     */
    constructor(player: PlayerStructure) {
        this.player = player;
        this.plugin = new LavalinkPluginFilter(this);
        this.dspx = new DSPXPluginFilter(this);
    }

    /**
     * Resets all filters to their default values.
     * @returns {Promise<this>} A promise that resolves to the instance of the filter manager.
     */
    public async reset(): Promise<this> {
        this.filters = {
            audioOutput: AudioOutput.Stereo,
            volume: false,
            vaporwave: false,
            custom: false,
            nightcore: false,
            rotation: false,
            karaoke: false,
            tremolo: false,
            vibrato: false,
            lowPass: false,
            distortion: false,
            timescale: false,
            lavalinkFilterPlugin: {
                echo: false,
                reverb: false,
            },
            lavalinkLavaDspxPlugin: {
                lowPass: false,
                highPass: false,
                normalization: false,
                echo: false,
            },
        };

        this.data = { ...DefaultPlayerFilters };

        return this.apply();
    }

    /**
     *
     * Applies the current filters to the player.
     * @returns {Promise<this>} A promise that resolves to the instance of the filter manager.
     */
    public async apply(): Promise<this> {
        if (!this.player.node.sessionId) return this;

        this.check();

        const filters = { ...this.data };

        if (!this.filters.volume) delete filters.volume;
        if (!this.filters.tremolo) delete filters.tremolo;
        if (!this.filters.vibrato) delete filters.vibrato;

        if (!this.filters.lavalinkFilterPlugin.echo) delete filters.pluginFilters?.["lavalink-filter-plugin"]?.echo;
        if (!this.filters.lavalinkFilterPlugin.reverb) delete filters.pluginFilters?.["lavalink-filter-plugin"]?.reverb;

        if (!this.filters.lavalinkLavaDspxPlugin.echo) delete filters.pluginFilters?.echo;
        if (!this.filters.lavalinkLavaDspxPlugin.normalization) delete filters.pluginFilters?.normalization;
        if (!this.filters.lavalinkLavaDspxPlugin.highPass) delete filters.pluginFilters?.["high-pass"];
        if (!this.filters.lavalinkLavaDspxPlugin.lowPass) delete filters.pluginFilters?.["low-pass"];

        if (filters.pluginFilters?.["lavalink-filter-plugin"] && !Object.values(filters.pluginFilters["lavalink-filter-plugin"]).length)
            delete filters.pluginFilters["lavalink-filter-plugin"];
        if (filters.pluginFilters && Object.values(filters.pluginFilters).length === 0) delete filters.pluginFilters;
        if (this.filters.audioOutput === AudioOutput.Stereo) delete filters.channelMix;

        if (!this.filters.lowPass) delete filters.lowPass;
        if (!this.filters.karaoke) delete filters.karaoke;
        if (!this.filters.rotation) delete filters.rotation;
        if (!this.filters.distortion) delete filters.distortion;
        if (!this.filters.timescale) delete filters.timescale;

        if (this.data.timescale && Object.values(this.data.timescale).every((v) => v === 1)) delete filters.timescale;

        filters.equalizer = [...this.bands];

        if (!filters.equalizer.length) delete filters.equalizer;

        for (const key in filters) {
            if (!this.player.node.info?.filters?.includes(key as FilterType)) delete filters[key as keyof FilterSettings];
        }

        await this.player.updatePlayer({ playerOptions: { filters } });

        return this;
    }

    /**
     * Checks if the current filters are active.
     * @param {TimescaleSettings} timescale The timescale settings to check against.
     * @returns {void} Nothing!
     */
    public check(timescale?: TimescaleSettings): void {
        this.filters.rotation = this.data.rotation?.rotationHz !== 0;
        this.filters.vibrato = this.data.vibrato?.frequency !== 0 || this.data.vibrato?.depth !== 0;
        this.filters.tremolo = this.data.tremolo?.frequency !== 0 || this.data.tremolo?.depth !== 0;

        const lavalinkPluginFilters = this.data.pluginFilters?.["lavalink-filter-plugin"] ?? {};

        this.filters.lavalinkFilterPlugin.echo = lavalinkPluginFilters.echo?.decay !== 0 || lavalinkPluginFilters.echo?.delay !== 0;
        this.filters.lavalinkFilterPlugin.reverb =
            lavalinkPluginFilters.reverb?.delays?.length !== 0 || lavalinkPluginFilters.reverb?.gains?.length !== 0;
        this.filters.lavalinkLavaDspxPlugin.highPass = Object.values(this.data.pluginFilters?.["high-pass"] ?? {}).length > 0;
        this.filters.lavalinkLavaDspxPlugin.lowPass = Object.values(this.data.pluginFilters?.["low-pass"] ?? {}).length > 0;
        this.filters.lavalinkLavaDspxPlugin.normalization = Object.values(this.data.pluginFilters?.normalization ?? {}).length > 0;
        this.filters.lavalinkLavaDspxPlugin.echo =
            Object.values(this.data.pluginFilters?.echo ?? {}).length > 0 && typeof this.data.pluginFilters?.echo?.delay === "undefined";

        this.filters.lowPass = this.data.lowPass?.smoothing !== 0;
        this.filters.karaoke = Object.values(this.data.karaoke ?? {}).some((v) => v !== 0);
        this.filters.distortion = Object.values(this.data.distortion ?? {}).some((v) => v !== 0 && v !== 1);
        this.filters.timescale = Object.values(this.data.timescale ?? {}).some((v) => v !== 1);
        this.filters.custom =
            !this.filters.nightcore && !this.filters.vaporwave && Object.values(this.data.timescale ?? {}).some((d) => d !== 1);

        if ((this.filters.nightcore || this.filters.vaporwave) && timescale) {
            if (
                timescale.pitch !== this.data.timescale?.pitch ||
                timescale.rate !== this.data.timescale?.rate ||
                timescale.speed !== this.data.timescale?.speed
            ) {
                this.filters.custom = Object.values(this.data.timescale ?? {}).some((v) => v !== 1);
                this.filters.nightcore = false;
                this.filters.vaporwave = false;
            }
        }
    }

    /**
     *
     * Checks if a specific filter is active.
     * @param {FilterType} filter The filter type to check.
     * @returns {boolean} True if the filter is active, false otherwise.
     */
    public has(filter: FilterType): boolean {
        const dspx = this.filters.lavalinkLavaDspxPlugin[filter as keyof typeof this.filters.lavalinkLavaDspxPlugin];
        if (isValid(dspx)) return dspx;

        const plugin = this.filters.lavalinkFilterPlugin[filter as keyof typeof this.filters.lavalinkFilterPlugin];
        if (isValid(plugin)) return plugin;

        const kind = this.filters[filter as keyof Omit<EnabledPlayerFilters, "lavalinkFilterPlugin" | "lavalinkLavaDspxPlugin">];

        if (typeof kind === "boolean") return kind;
        if (typeof kind === "string") return kind !== AudioOutput.Stereo;

        return false;
    }

    /**
     *
     * Sets the volume for the player.
     * @param {number} volume The volume level to set (between 0 and 5).
     * @returns {Promise<this>} A promise that resolves to the player instance.
     */
    public async setVolume(volume: number): Promise<this> {
        if (typeof volume !== "number" || Number.isNaN(volume) || volume < 0 || volume > 5)
            throw new PlayerError("Volume must be a number between 0 and 5.");

        this.data = { volume };
        this.filters.volume = volume !== 1;

        return this.apply();
    }

    /**
     * Sets the audio output for the player.
     * @param {AudioOutput} output The audio output to set.
     * @returns {Promise<this>} A promise that resolves to the player instance.
     */
    public async setAudioOutput(output: AudioOutput): Promise<this> {
        const outputs = Object.values(AudioOutput);
        if (!outputs.includes(output)) throw new PlayerError(`Audio output must be one of the following: ${outputs.join(", ")}.`);

        this.filters.audioOutput = output;
        this.data.channelMix = AudioOutputData[output];

        return this.apply();
    }

    /**
     *
     * Sets the speed for the player.
     * @param {number} speed The speed to set (default is 1).
     * @returns {Promise<this>} A promise that resolves to the player instance.
     */
    public async setSpeed(speed: number = 1): Promise<this> {
        if (!this.player.node.info?.filters?.includes(FilterType.Timescale))
            throw new PlayerError("Node filters does not include the 'timescale' filter. (Or the node doesn't have it enabled)");

        if (this.filters.nightcore || this.filters.vaporwave) {
            this.data.timescale = {
                speed: 1,
                pitch: 1,
                rate: 1,
            };

            this.filters.nightcore = false;
            this.filters.vaporwave = false;
        }

        this.data.timescale!.speed = speed;

        return this.apply();
    }

    /**
     *
     * Sets the rate for the player.
     * @param {number} rate The rate to set (default is 1).
     * @returns {Promise<this>} A promise that resolves to the player instance.
     */
    public async setRate(rate: number = 1): Promise<this> {
        if (!this.player.node.info?.filters?.includes(FilterType.Timescale))
            throw new PlayerError("Node filters does not include the 'timescale' filter. (Or the node doesn't have it enabled)");

        if (this.filters.nightcore || this.filters.vaporwave) {
            this.data.timescale = {
                speed: 1,
                pitch: 1,
                rate: 1,
            };

            this.filters.nightcore = false;
            this.filters.vaporwave = false;
        }

        this.data.timescale!.rate = rate;

        return this.apply();
    }

    /**
     *
     * Sets the pitch for the player.
     * @param {number} pitch The pitch
     * @returns {Promise<this>} A promise that resolves to the player instance.
     */
    public async setPitch(pitch: number = 1): Promise<this> {
        if (!this.player.node.info?.filters?.includes(FilterType.Timescale))
            throw new PlayerError("Node filters does not include the 'timescale' filter. (Or the node doesn't have it enabled)");

        if (this.filters.nightcore || this.filters.vaporwave) {
            this.data.timescale = {
                speed: 1,
                pitch: 1,
                rate: 1,
            };

            this.filters.nightcore = false;
            this.filters.vaporwave = false;
        }

        this.data.timescale!.pitch = pitch;

        return this.apply();
    }

    /**
     *
     * Sets the EQ bands for the player.
     * @param {RestOrArray<EQBandSettings>} bands The EQ band settings to set.
     * @returns {Promise<this>} A promise that resolves to the instance of the manager.
     */
    public async setEQBand(...bands: RestOrArray<EQBandSettings>): Promise<this> {
        bands = bands.flat();

        if (!bands.length || !bands.every((band) => typeof band.band === "number" && typeof band.gain === "number"))
            throw new PlayerError("Bands must be a non-empty object array containing 'band' and 'gain' properties.");

        for (const { band, gain } of bands) this.bands[band] = { band, gain };

        return this.apply();
    }

    /**
     *
     * Clears all EQ bands for the player.
     * @returns {Promise<this>} A promise that resolves to the instance of the manager.
     */
    public async clearEQBands(): Promise<this> {
        return this.setEQBand(Array.from({ length: 15 }, (_, i) => ({ band: i, gain: 0 })));
    }

    /**
     *
     * Set the vibrato filter with the given settings.
     * @param {TremoloSettings} [settings=DefaultFilterPreset.Vibrato] The settings for the vibrato filter.
     * @returns {Promise<this>} The instance of the filter manager.
     */
    public async setVibrato(settings: Partial<TremoloSettings> = DefaultFilterPreset.Vibrato): Promise<this> {
        if (!this.player.node.info?.filters?.includes(FilterType.Vibrato))
            throw new PlayerError("Node filters does not include the 'vibrato' filter. (Or the node doesn't have it enabled)");

        this.data.vibrato = {
            frequency: this.filters.vibrato ? 0 : settings.frequency,
            depth: this.filters.vibrato ? 0 : settings.depth,
        };

        this.filters.vibrato = !this.filters.vibrato;

        return this.apply();
    }

    /**
     *
     * Set the tremolo filter with the given settings.
     * @param {TremoloSettings} [settings=DefaultFilterPreset.Tremolo] The settings for the tremolo filter.
     * @returns {Promise<this>} The instance of the filter manager.
     */
    public async setTremolo(settings: Partial<TremoloSettings> = DefaultFilterPreset.Tremolo): Promise<this> {
        if (!this.player.node.info?.filters?.includes(FilterType.Tremolo))
            throw new PlayerError("Node filters does not include the 'tremolo' filter. (Or the node doesn't have it enabled)");

        this.data.tremolo = {
            frequency: this.filters.tremolo ? 0 : settings.frequency,
            depth: this.filters.tremolo ? 0 : settings.depth,
        };

        this.filters.tremolo = !this.filters.tremolo;

        return this.apply();
    }

    /**
     *
     * Set the low-pass filter with the given settings.
     * @param {LowPassSettings} [settings=DefaultFilterPreset.Lowpass] The settings for the low-pass filter.
     * @returns {Promise<this>} The instance of the filter manager.
     */
    public async setLowPass(settings: Partial<LowPassSettings> = DefaultFilterPreset.Lowpass): Promise<this> {
        if (!this.player.node.info?.filters?.includes(FilterType.LowPass))
            throw new PlayerError("Node filters does not include the 'lowPass' filter. (Or the node doesn't have it enabled)");

        this.data.lowPass = { smoothing: this.filters.lowPass ? 0 : settings.smoothing };
        this.filters.lowPass = !this.filters.lowPass;

        return this.apply();
    }

    /**
     * Set the nightcore filter with the given settings.
     * @param {Partial<TimescaleSettings>} [settings=DefaultFilterPreset.Nightcore] The settings for the nightcore filter.
     * @returns {Promise<this>} The instance of the filter manager.
     */
    public async setNightcore(settings: Partial<TimescaleSettings> = DefaultFilterPreset.Nightcore): Promise<this> {
        if (!this.player.node.info?.filters?.includes(FilterType.Timescale))
            throw new PlayerError("Node filters does not include the 'timescale' filter. (Or the node doesn't have it enabled)");

        this.data.timescale = {
            speed: this.filters.nightcore ? 1 : settings.speed,
            pitch: this.filters.nightcore ? 1 : settings.pitch,
            rate: this.filters.nightcore ? 1 : settings.rate,
        };

        this.filters.nightcore = !this.filters.nightcore;
        this.filters.vaporwave = false;
        this.filters.custom = false;

        return this.apply();
    }

    /**
     *
     * Set the vaporwave filter with the given settings.
     * @param {Partial<TimescaleSettings>} [settings=DefaultFilterPreset.Vaporwave] The settings for the vaporwave filter.
     * @returns {Promise<this>} The instance of the filter manager.
     */
    public async setVaporwave(settings: Partial<TimescaleSettings> = DefaultFilterPreset.Vaporwave): Promise<this> {
        if (!this.player.node.info?.filters?.includes(FilterType.Timescale))
            throw new PlayerError("Node filters does not include the 'timescale' filter. (Or the node doesn't have it enabled)");

        this.data.timescale = {
            speed: this.filters.vaporwave ? 1 : settings.speed,
            pitch: this.filters.vaporwave ? 1 : settings.pitch,
            rate: this.filters.vaporwave ? 1 : settings.rate,
        };

        this.filters.vaporwave = !this.filters.vaporwave;
        this.filters.nightcore = false;
        this.filters.custom = false;

        return this.apply();
    }

    /**
     *
     * Set the karaoke filter with the given settings.
     * @param {KaraokeSettings} [settings=DefaultFilterPreset.Karaoke] The settings for the karaoke filter.
     * @returns {Promise<this>} The instance of the filter manager.
     */
    public async setKaraoke(settings: Partial<KaraokeSettings> = DefaultFilterPreset.Karaoke): Promise<this> {
        if (!this.player.node.info?.filters?.includes(FilterType.Karaoke))
            throw new PlayerError("Node filters does not include the 'karaoke' filter. (Or the node doesn't have it enabled)");

        this.data.karaoke = {
            level: this.data.karaoke!.level ? 0 : settings.level,
            monoLevel: this.data.karaoke!.monoLevel ? 0 : settings.monoLevel,
            filterBand: this.data.karaoke!.filterBand ? 0 : settings.filterBand,
            filterWidth: this.data.karaoke!.filterWidth ? 0 : settings.filterWidth,
        };

        this.filters.karaoke = !this.filters.karaoke;

        return this.apply();
    }

    /**
     *
     * Set the distortion filter with the given settings.
     * @param {Partial<DistortionSettings>} [settings=DefaultFilterPreset.Distortion] The settings for the distortion filter.
     * @returns {Promise<this>} The instance of the filter manager.
     */
    public async setDistortion(settings: Partial<DistortionSettings> = DefaultFilterPreset.Distortion): Promise<this> {
        if (!this.player.node.info?.filters?.includes(FilterType.Distortion))
            throw new PlayerError("Node filters does not include the 'distortion' filter. (Or the node doesn't have it enabled)");

        this.data.distortion = {
            sinOffset: this.filters.distortion ? 0 : settings.sinOffset,
            sinScale: this.filters.distortion ? 1 : settings.sinScale,
            cosOffset: this.filters.distortion ? 0 : settings.cosOffset,
            cosScale: this.filters.distortion ? 1 : settings.cosScale,
            tanOffset: this.filters.distortion ? 0 : settings.tanOffset,
            offset: this.filters.distortion ? 0 : settings.offset,
            scale: this.filters.distortion ? 1 : settings.scale,
        };

        this.filters.distortion = !this.filters.distortion;

        return this.apply();
    }

    /**
     * Set the timescale filter with the given settings.
     * @param {Partial<TimescaleSettings>} settings The timescale settings to set.
     * @returns {Promise<this>} The instance of the filter manager.
     */
    public async setTimescale(settings: Partial<TimescaleSettings>): Promise<this> {
        if (!this.player.node.info?.filters?.includes(FilterType.Timescale))
            throw new PlayerError("Node filters does not include the 'timescale' filter. (Or the node doesn't have it enabled)");

        this.data.timescale = {
            pitch: settings.pitch ?? 1,
            rate: settings.rate ?? 1,
            speed: settings.speed ?? 1,
        };

        this.filters.timescale = !this.filters.timescale;

        return this.apply();
    }

    /**
     * Convert the filter settings to a JSON object.
     * @returns {FilterSettings} The filter settings as a JSON object.
     */
    public toJSON(): FilterSettings {
        return { ...this.data };
    }
}
