export enum AudioOutput {
    /**
     * Mono output (both channels mixed equally).
     * @type {string}
     */
    Mono = "mono",
    /**
     * Stereo output (normal).
     * @type {string}
     */
    Stereo = "stereo",
    /**
     * Left channel only output.
     * @type {string}
     */
    Left = "left",
    /**
     * Right channel only output.
     * @type {string}
     */
    Right = "right",
}

/**
 * The types of filters available.
 */
export enum FilterType {
    /**
     * Volume filter.
     * @type {string}
     */
    Volume = "volume",
    /**
     * Audio output filter.
     * @type {string}
     */
    AudioOutput = "audioOutput",
    /**
     * Low pass filter.
     * @type {string}
     */
    LowPass = "lowPass",
    /**
     * Karaoke filter.
     * @type {string}
     */
    Karaoke = "karaoke",
    /**
     * Rotation filter.
     * @type {string}
     */
    Rotation = "rotation",
    /**
     * Tremolo filter.
     * @type {string}
     */
    Tremolo = "tremolo",
    /**
     * Vibrato filter.
     * @type {string}
     */
    Vibrato = "vibrato",
    /**
     * Custom filter.
     * @type {string}
     */
    Custom = "custom",
    /**
     * Timescale filter.
     * @type {string}
     */
    Timescale = "timescale",
    /**
     * Distortion filter.
     * @type {string}
     */
    Distortion = "distortion",
    /**
     * Echo filter.
     * @type {string}
     */
    Echo = "echo",
    /**
     * Reverb filter.
     * @type {string}
     */
    Reverb = "reverb",
    /**
     * DSPX low-pass filter.
     * @type {string}
     */
    DSPXLowpass = "low-pass",
    /**
     * DSPX high-pass filter.
     * @type {string}
     */
    DSPXHighpass = "high-pass",
    /**
     * DSPX echo filter.
     * @type {string}
     */
    DSPXEcho = FilterType.Echo,
    /**
     * DSPX normalization filter.
     * @type {string}
     */
    DSPXNormalization = "normalization",
}

/**
 * The band settings for the equalizer.
 */
export interface EQBandSettings {
    /**
     * The band number.
     * @type {number}
     */
    band: number;
    /**
     * The gain for the band.
     * @type {number}
     */
    gain: number;
}

/**
 * The settings for the karaoke filter.
 */
export interface KaraokeSettings {
    /**
     * The level of the karaoke filter.
     * @type {number | undefined}
     */
    level?: number;
    /**
     * The mono level of the karaoke filter.
     * @type {number | undefined}
     */
    monoLevel?: number;
    /**
     * The filter band of the karaoke filter.
     * @type {number | undefined}
     */
    filterBand?: number;
    /**
     * The filter width of the karaoke filter.
     * @type {number | undefined}
     */
    filterWidth?: number;
}

/**
 * The settings for the timescale filter.
 */
export interface TimescaleSettings {
    /**
     * The speed of the timescale filter.
     * @type {number | undefined}
     */
    speed?: number;
    /**
     * The pitch of the timescale filter.
     * @type {number | undefined}
     */
    pitch?: number;
    /**
     * The rate of the timescale filter.
     * @type {number | undefined}
     */
    rate?: number;
}

/**
 * The settings for frequency-based filters.
 */
export interface FreqSettings {
    /**
     * The frequency of the filter.
     * @type {number | undefined}
     */
    frequency?: number;
    /**
     * The depth of the filter.
     * @type {number | undefined}
     */
    depth?: number;
}

/**
 * The settings for the rotation filter.
 */
export interface RotationSettings {
    /**
     * The rotation frequency in Hz.
     * @type {number | undefined}
     */
    rotationHz?: number;
}

/**
 * The settings for the distortion filter.
 */
export interface DistortionSettings {
    /**
     * The sine offset.
     * @type {number | undefined}
     */
    sinOffset?: number;
    /**
     * The sine scale.
     * @type {number | undefined}
     */
    sinScale?: number;
    /**
     * The cosine offset.
     * @type {number | undefined}
     */
    cosOffset?: number;
    /**
     * The cosine scale.
     * @type {number | undefined}
     */
    cosScale?: number;
    /**
     * The tangent offset.
     * @type {number | undefined}
     */
    tanOffset?: number;
    /**
     * The tangent scale.
     * @type {number | undefined}
     */
    tanScale?: number;
    /**
     * The offset.
     * @type {number | undefined}
     */
    offset?: number;
    /**
     * The scale.
     * @type {number | undefined}
     */
    scale?: number;
}

/**
 * The settings for the channel mix filter.
 */
export interface ChannelMixSettings {
    /**
     * The left to left channel mix.
     * @type {number | undefined}
     */
    leftToLeft?: number;
    /**
     * The left to right channel mix.
     * @type {number | undefined}
     */
    leftToRight?: number;
    /**
     * The right to left channel mix.
     * @type {number | undefined}
     */
    rightToLeft?: number;
    /**
     * The right to right channel mix.
     * @type {number | undefined}
     */
    rightToRight?: number;
}

/**
 * The settings for the low pass filter.
 */
export interface LowPassSettings {
    /**
     * The smoothing of the low pass filter.
     * @type {number | undefined}
     */
    smoothing?: number;
}

export interface TremoloSettings {
    /**
     * The frequency of the tremolo effect.
     * @type {number}
     */
    frequency: number;
    /**
     * The depth of the tremolo effect.
     * @type {number}
     */
    depth: number;
}

/**
 * The options for the filters.
 */
export interface FilterSettings {
    /**
     * The volume of the filter.
     * @type {number | undefined}
     */
    volume?: number;
    /**
     * The equalizer settings.
     * @type {EQBandSettings[] | undefined}
     */
    equalizer?: EQBandSettings[];
    /**
     * The karaoke settings.
     * @type {KaraokeSettings | null}
     */
    karaoke?: KaraokeSettings | null;
    /**
     * The timescale settings.
     * @type {TimescaleSettings | null}
     */
    timescale?: TimescaleSettings | null;
    /**
     * The tremolo settings.
     * @type {FreqSettings | null}
     */
    tremolo?: FreqSettings | null;
    /**
     * The vibrato settings.
     * @type {FreqSettings | null}
     */
    vibrato?: FreqSettings | null;
    /**
     * The rotation settings.
     * @type {RotationSettings | null}
     */
    rotation?: RotationSettings | null;
    /**
     * The distortion settings.
     * @type {DistortionSettings | null}
     */
    distortion?: DistortionSettings | null;
    /**
     * The channel mix settings.
     * @type {ChannelMixSettings | null}
     */
    channelMix?: ChannelMixSettings | null;
    /**
     * The low pass settings.
     * @type {LowPassSettings | null}
     */
    lowPass?: LowPassSettings | null;
    /**
     * The plugin filters.
     * @type {PluginFilterSettings | undefined}
     */
    pluginFilters?: PluginFilterSettings;
}

/**
 * The settings for plugin filters.
 */
export interface PluginFilterSettings {
    /**
     * The normalization settings.
     * @type {NormalizationSettings | undefined}
     */
    normalization?: NormalizationSettings;
    /**
     * The echo settings.
     * @type {EchoSettings | undefined}
     */
    echo?: EchoSettings;
    /**
     * The high pass settings.
     * @type {FilterPluginPassSettings | undefined}
     */
    "high-pass"?: Partial<FilterPluginPassSettings>;
    /**
     * The low pass settings.
     * @type {FilterPluginPassSettings | undefined}
     */
    "low-pass"?: Partial<FilterPluginPassSettings>;
    /**
     * The settings for the lavalink filter plugin.
     * @type {LavalinkFilterPluginSettings | undefined}
     */
    "lavalink-filter-plugin"?: LavalinkFilterPluginSettings;
}

/**
 * The settings for the lavalink filter plugin.
 */
export interface LavalinkFilterPluginSettings {
    /**
     * The echo filter settings.
     * @type {LavalinkFilterPluginEchoSettings | undefined}
     */
    echo?: LavalinkFilterPluginEchoSettings;
    /**
     * The reverb filter settings.
     * @type {LavalinkFilterPluginReverbSettings | undefined}
     */
    reverb?: LavalinkFilterPluginReverbSettings;
}

/**
 * The settings for the echo filter.
 */
export interface EchoSettings {
    /**
     * The length of the echo.
     * @type {number | undefined}
     */
    echoLength?: number;
    /**
     * The decay of the echo.
     * @type {number | undefined}
     */
    decay?: number;
    /**
     * The delay of the echo.
     * @type {number | undefined}
     */
    delay?: number;
}

/**
 * The settings for the normalization filter.
 */
export interface NormalizationSettings {
    /**
     * The maximum amplitude for normalization.
     * @type {number}
     */
    maxAmplitude?: number;
    /**
     * Whether to use adaptive normalization.
     * @type {boolean}
     */
    adaptive?: boolean;
}

/**
 * The settings for the echo filter in plugins.
 */
export interface LavalinkFilterPluginEchoSettings {
    /**
     * The delay for the echo filter.
     * @type {number}
     */
    delay?: number;
    /**
     * The decay for the echo filter.
     * @type {number}
     */
    decay?: number;
}

/**
 * The settings for the reverb filter in plugins.
 */
export interface LavalinkFilterPluginReverbSettings {
    /**
     * The delays for the reverb filter.
     * @type {number[]}
     */
    delays?: number[];
    /**
     * The gains for the reverb filter.
     * @type {number[]}
     */
    gains?: number[];
}

export interface FilterPluginPassSettings {
    /**
     * The cutoff frequency for the high pass filter.
     * @type {number}
     */
    cutoffFrequency: number;
    /**
     * The boost factor for the high pass filter.
     * @type {number}
     */
    boostFactor: number;
}

/**
 * The active filters on the player.
 */
export interface EnabledPlayerFilters {
    /**
     * Check if any custom filter is enabled
     * @type {boolean}
     */
    custom: boolean;
    /**
     * Check if the nightcore filter is enabled or not.
     * @type {boolean}
     */
    nightcore: boolean;
    /**
     * Check if the vaporwave filter is enabled or not.
     * @type {boolean}
     */
    vaporwave: boolean;
    /**
     * Check if the rotation filter is enabled or not.
     * @type {boolean}
     */
    rotation: boolean;
    /**
     * Check if the karaoke filter is enabled or not.
     * @type {boolean}
     */
    karaoke: boolean;
    /**
     * Check if the tremolo filter is enabled or not.
     * @type {boolean}
     */
    tremolo: boolean;
    /**
     * Check if the vibrato filter is enabled or not.
     * @type {boolean}
     */
    vibrato: boolean;
    /**
     * Check if the low pass filter is enabled or not.
     * @type {boolean}
     */
    lowPass: boolean;
    /**
     * Set the audio output mode.
     * @type {AudioOutput}
     */
    audioOutput: AudioOutput;
    /**
     * Check if the volume filter is enabled or not.
     * @type {boolean}
     */
    volume: boolean;
    /**
     * Check if the distortion filter is enabled or not.
     * @type {boolean}
     */
    distortion: boolean;
    /**
     * Check if the timescale filter is enabled or not.
     * @type {boolean}
     */
    timescale: boolean;
    /**
     * The lavalink filter plugin enabled filters.
     * @type {EnabledLavalinkFilters}
     */
    lavalinkFilterPlugin: EnabledLavalinkFilters;
    /**
     * The lavadspx plugin enabled filters.
     * @type {EnabledDSPXPluginFilters}
     */
    lavalinkLavaDspxPlugin: EnabledDSPXPluginFilters;
}

/**
 * The enabled filters for the lavalink filter plugin.
 */
export interface EnabledLavalinkFilters {
    /**
     * Check if the echo filter is enabled or not.
     * @type {boolean}
     */
    echo: boolean;
    /**
     * Check if the reverb filter is enabled or not.
     * @type {boolean}
     */
    reverb: boolean;
}

/**
 * The enabled filters for the lavadspx plugin.
 */
export interface EnabledDSPXPluginFilters {
    /**
     * Check if the low pass filter is enabled or not.
     * @type {boolean}
     */
    lowPass: boolean;
    /**
     * Check if the high pass filter is enabled or not.
     * @type {boolean}
     */
    highPass: boolean;
    /**
     * Check if the normalization filter is enabled or not.
     * @type {boolean}
     */
    normalization: boolean;
    /**
     * Check if the echo filter is enabled or not.
     * @type {boolean}
     */
    echo: boolean;
}
