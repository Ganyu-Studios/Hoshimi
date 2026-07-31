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
     * DSPX echo filter. Distinct canonical name from {@link FilterType.Echo} so the registry can tell them
     * apart; both are written to the wire as `echo` (DSPX flat under `pluginFilters`, the filter-plugin nested).
     * @type {string}
     */
    DSPXEcho = "dspx-echo",
    /**
     * DSPX normalization filter.
     * @type {string}
     */
    DSPXNormalization = "normalization",
    /**
     * Channel mix filter.
     * @type {string}
     */
    ChannelMix = "channelMix",
    /**
     * Equalizer filter.
     * @type {string}
     */
    Equalizer = "equalizer",
}

/**
 * Options for `FilterManager.set`, controlling where the payload is written and whether the node is
 * checked for support.
 *
 * | given | envelope | `validate` default |
 * | --- | --- | --- |
 * | nothing, registered filter | whatever the registry resolves | `true` |
 * | nothing, unknown filter | `pluginFilters[name]` (flat) | `false` |
 * | `plugin: true` | `pluginFilters[name]` (flat) | `false` |
 * | `plugin: "some-plugin"` | `pluginFilters["some-plugin"][name]` | `false` |
 * | `top: true` | `filters[name]` (top level) | `false` |
 *
 * Passing a routing option always wins over the registry, so an explicit envelope can be forced for a
 * registered name too.
 */
export interface SetFilterOptions {
    /**
     * Write the filter under `pluginFilters`: `true` places it flat, a plugin name nests it under that
     * plugin (the shape the Lavalink spec defines for plugin filters).
     * @type {string | true | undefined}
     */
    plugin?: string | true;
    /**
     * Write the filter at the top level of the payload, next to the built-in Lavalink filters — where a
     * fork exposes its own filters.
     *
     * Hoshimi does not check which server it is talking to: whether a fork-specific filter is safe to send
     * is the node's business, so pointing a player at the right node is the caller's. Registering the
     * filter (scope {@link FilterScope.Core}) buys routing by name and a check against the node's
     * advertised list, when the fork does advertise it.
     * @type {boolean | undefined}
     */
    top?: boolean;
    /**
     * Whether to check that the node advertises the filter (and installs its backing plugin) before
     * writing. Only meaningful for registered filters — there is nothing to check an unknown key
     * against. See the table above for the defaults.
     * @type {boolean | undefined}
     */
    validate?: boolean;
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
 * Custom top-level filter settings for Hoshimi.
 *
 * Extend this interface via module augmentation to declare typed top-level filter keys
 * provided by a fork (e.g. Nodelink) or by code that integrates with Hoshimi.
 *
 * Runtime registration via {@link FilterRegistry} works without augmenting this interface;
 * augmentation only adds compile-time autocompletion and type-checking for the new keys.
 *
 * @example
 * ```ts
 * declare module "hoshimi" {
 *   interface CustomizableFilterSettings {
 *     "nodelink-echo"?: { decay: number; delay: number };
 *   }
 * }
 * ```
 */
export interface CustomizableFilterSettings {}

/**
 * The options for the filters.
 */
export interface FilterSettings extends CustomizableFilterSettings {
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
    /**
     * Open index for vendor-scoped (fork) filters registered at runtime via {@link FilterRegistry}.
     * Declared keys above (and any key augmented through {@link CustomizableFilterSettings}) keep their precise types.
     */
    [key: string]: unknown;
}

/**
 * Custom plugin filter payloads for Hoshimi.
 *
 * Extend this interface via module augmentation to declare typed plugin payload keys
 * (either nested under a plugin name, e.g. `"my-plugin"`, or flat filter keys
 * placed directly under `pluginFilters`).
 *
 * Runtime registration via {@link FilterRegistry} works without augmenting this interface;
 * augmentation only adds compile-time autocompletion and type-checking for the new keys.
 *
 * @example
 * ```ts
 * declare module "hoshimi" {
 *   interface CustomizablePluginPayloads {
 *     "my-fork-plugin"?: { gain?: number };
 *   }
 * }
 * ```
 */
export interface CustomizablePluginPayloads {}

/**
 * The settings for plugin filters.
 */
export interface PluginFilterSettings extends CustomizablePluginPayloads {
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
    /**
     * Open index for plugin-scoped filter payloads registered at runtime via {@link FilterRegistry}.
     * Declared keys above (and any key augmented through {@link CustomizablePluginPayloads}) keep their precise types.
     */
    [key: string]: unknown;
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
