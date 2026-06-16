import PackageJson from "../../package.json";
import { QueueMemoryStorage } from "../classes/storage/QueueMemory";
import type { ChannelMixSettings, FilterSettings } from "../types/Filters";
import { AudioOutput } from "../types/Filters";
import { type RequiredHoshimiOptions, SearchSources } from "../types/Manager";
import { NodeSortTypes, type UserAgent } from "../types/Node";
import { LoopMode } from "../types/Player";
import { autoplayFn } from "./functions/autoplay";
import { requesterFn } from "./functions/utils";

/**
 * The auto output record type.
 */
type AudioOutputRecord = Record<AudioOutput, Required<ChannelMixSettings>>;

/**
 * The user agent for Hoshimi.
 * @type {UserAgent}
 */
export const HoshimiAgent: UserAgent = `hoshimi/v${PackageJson.version} (${PackageJson.repository.url})`;

/**
 * The url regex for Hoshimi.
 * @type {RegExp}
 */
export const UrlRegex: RegExp = /^(https?:\/\/)?([a-zA-Z0-9\-_]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/;

/**
 * The audio output data for Hoshimi.
 * @type {Readonly<Record<AudioOutput, Required<ChannelMixSettings>>>}
 */
export const AudioOutputData: Readonly<AudioOutputRecord> = Object.freeze<AudioOutputRecord>({
    [AudioOutput.Mono]: {
        leftToLeft: 0.5,
        leftToRight: 0.5,
        rightToLeft: 0.5,
        rightToRight: 0.5,
    },
    [AudioOutput.Stereo]: {
        leftToLeft: 1,
        leftToRight: 0,
        rightToLeft: 0,
        rightToRight: 1,
    },
    [AudioOutput.Left]: {
        leftToLeft: 1,
        leftToRight: 0,
        rightToLeft: 1,
        rightToRight: 0,
    },
    [AudioOutput.Right]: {
        leftToLeft: 0,
        leftToRight: 1,
        rightToLeft: 0,
        rightToRight: 1,
    },
});

/**
 * The default filter presets.
 */
export const DefaultFilterPreset = Object.freeze({
    Karaoke: { level: 1, monoLevel: 1, filterBand: 220, filterWidth: 100 },
    Vaporwave: { speed: 0.8500000238418579, pitch: 0.800000011920929, rate: 1 },
    Nightcore: { speed: 1.289999523162842, pitch: 1.289999523162842, rate: 0.9365999523162842 },
    Lowpass: { smoothing: 20 },
    Tremolo: { frequency: 4, depth: 0.8 },
    Vibrato: { frequency: 4, depth: 0.8 },
    Distortion: { cosOffset: 0.4, sinOffset: 0.4, tanOffset: 0.4, offset: 0.4, scale: 1.5, cosScale: 1.5, sinScale: 1.5, tanScale: 1.5 },

    DSPXHighPass: { boostFactor: 1.0, cutoffFrequency: 80 },
    DSPXLowPass: { boostFactor: 1.0, cutoffFrequency: 80 },
    DSPXNormalization: { adaptive: true, maxAmplitude: 0.1 },
    DSPXEcho: { decay: 0.5, echoLength: 0.5 },

    PluginEcho: { decay: 0.8, delay: 4 },
    PluginReverb: { delays: [0.037, 0.042, 0.048, 0.053], gains: [0.84, 0.83, 0.82, 0.81] },
});

/**
 * The default filter settings.
 * @type {Readonly<FilterSettings>} DefaultFilters
 */
export const DefaultPlayerFilters: Readonly<FilterSettings> = Object.freeze<FilterSettings>({
    volume: 1,
    equalizer: [],
    channelMix: AudioOutputData.mono,
    lowPass: {
        smoothing: 0,
    },
    karaoke: {
        level: 0,
        monoLevel: 0,
        filterBand: 0,
        filterWidth: 0,
    },
    timescale: {
        speed: 1,
        pitch: 1,
        rate: 1,
    },
    rotation: {
        rotationHz: 0,
    },
    tremolo: {
        frequency: 0,
        depth: 0,
    },
    vibrato: {
        frequency: 0,
        depth: 0,
    },
    pluginFilters: {
        "high-pass": {
            boostFactor: 0,
            cutoffFrequency: 0,
        },
        "low-pass": {
            boostFactor: 0,
            cutoffFrequency: 0,
        },
        "lavalink-filter-plugin": {
            echo: {
                delay: 0,
                decay: 0,
            },
            reverb: {
                delays: [],
                gains: [],
            },
        },
        echo: {
            decay: 0,
            delay: 0,
            echoLength: 0,
        },
        normalization: {
            adaptive: false,
            maxAmplitude: 0,
        },
    },
    distortion: {
        cosOffset: 0,
        sinOffset: 0,
        tanOffset: 0,
        offset: 0,
        scale: 1,
        cosScale: 1,
        sinScale: 1,
        tanScale: 1,
    },
});

/**
 * The valid loop mode values.
 * @type {LoopMode[]}
 */
export const LoopValues: LoopMode[] = Object.values(LoopMode).filter((v): v is LoopMode => typeof v === "number");

/**
 * The default options for Hoshimi.
 * @type {Readonly<RequiredHoshimiOptions>}
 */
export const HoshimiDefaultOptions: Readonly<RequiredHoshimiOptions> = Object.freeze<RequiredHoshimiOptions>({
    nodes: [{ host: "localhost", port: 2333, password: "youshallnotpass" }],
    sendPayload: () => {},
    defaultSearchSource: SearchSources.Youtube,
    restOptions: {
        resumeTimeout: 10000,
    },
    nodeOptions: {
        userAgent: HoshimiAgent,
        closeOnError: true,
        sessionOptions: {
            resumable: false,
            timeout: 60,
            byLibrary: false,
        },
        moveOptions: {
            filterBy: NodeSortTypes.Penalties,
            move: false,
        },
        heartbeatOptions: {
            interval: 30000,
            statsTimeout: 65000,
        },
    },
    queueOptions: {
        autoplayFn,
        storage: new QueueMemoryStorage(),
        maxHistory: 25,
        autoPlay: false,
    },
    playerOptions: {
        requesterFn,
        onDisconnect: {
            autoDestroy: false,
            autoReconnect: false,
            autoQueue: false,
        },
    },
    client: {
        id: "0",
        username: "hoshimi-client",
    },
});
