import { describe, expect, it, type Mock } from "vitest";
import { PlayerError } from "../../src/classes/Errors";
import { defineFilter, FilterRegistry, FilterScope } from "../../src/registry/FiltersRegistry";
import { PluginCapabilities } from "../../src/registry/PluginRegistry";
import { AudioOutput, FilterType } from "../../src/types/Filters";
import type { FilterManagerStructure } from "../../src/types/Structures";
import { AudioOutputData, DefaultFilterPreset } from "../../src/util/constants";
import { createRealManager, createRealNode, createRealPlayer } from "../helpers";

// Built-in top-level filters a real Lavalink node advertises via /v4/info.
const BUILTIN_FILTERS = [
    "volume",
    "equalizer",
    "karaoke",
    "timescale",
    "tremolo",
    "vibrato",
    "rotation",
    "distortion",
    "channelMix",
    "lowPass",
];
const DSPX_FILTERS = ["low-pass", "high-pass", "echo", "normalization"];
const FILTER_PLUGIN_FILTERS = ["echo", "reverb"];
const ALL_FILTERS = [...new Set([...BUILTIN_FILTERS, ...DSPX_FILTERS, ...FILTER_PLUGIN_FILTERS])];

/** A bare node shape for pure {@link FilterRegistry} resolution (no player needed). */
function fakeNode(plugins: string[], filters: string[] = []) {
    return {
        id: "n",
        isNodelink: () => false,
        info: { plugins: plugins.map((name) => ({ name })), filters },
    } as never;
}

/**
 * Build a real manager + connected node + player. The node advertises a realistic filter set so the
 * "advertised" drop in commit() cannot mask filters that failed to be recognised as default.
 */
function setup(opts: { filters?: string[]; plugins?: string[] } = {}) {
    const manager = createRealManager();
    const node = createRealNode(manager);
    node.info = {
        filters: opts.filters ?? BUILTIN_FILTERS,
        plugins: (opts.plugins ?? []).map((name) => ({ name })),
        isNodelink: false,
    } as never;
    const player = createRealPlayer(manager);
    const spy = node.rest.updatePlayer as unknown as Mock;
    spy.mockClear();
    return { manager, node, player, fm: player.filterManager, spy };
}

/** A node with both filter plugins installed and everything advertised. */
function bothPlugins() {
    return setup({ filters: ALL_FILTERS, plugins: ["lavadspx-plugin", "lavalink-filter-plugin"] });
}

/** The `filters` object of the most recent updatePlayer call (throws if none happened). */
function sentFilters(spy: Mock): Record<string, unknown> {
    const call = spy.mock.calls.at(-1)?.[0] as { playerOptions?: { filters?: Record<string, unknown> } } | undefined;
    if (!call) throw new Error("updatePlayer was never called");
    return call.playerOptions?.filters ?? {};
}

describe("FilterRegistry echo disambiguation", () => {
    it("resolves Echo and DSPXEcho to distinct registrations", () => {
        const both = fakeNode(["lavalink-filter-plugin", "lavadspx-plugin"], ["echo"]);

        const echo = FilterRegistry.resolve(FilterType.Echo, both);
        const dspx = FilterRegistry.resolve(FilterType.DSPXEcho, both);

        expect(echo).not.toBeNull();
        expect(dspx).not.toBeNull();
        expect(echo).not.toBe(dspx);

        expect(echo?.scope).toBe(FilterScope.Plugin);
        expect(echo?.pluginName).toBe("lavalink-filter-plugin");

        expect(dspx?.scope).toBe(FilterScope.Plugin);
        expect(dspx?.pluginName).toBeUndefined();
        expect(dspx?.capability).toBe(PluginCapabilities.Dspx);
        expect(dspx?.wireName).toBe(FilterType.Echo); // written flat as `echo`
    });

    it("resolves DSPXEcho on a dspx-only node while Echo does not resolve", () => {
        const dspxOnly = fakeNode(["lavadspx-plugin"], ["echo"]);

        expect(FilterRegistry.resolve(FilterType.DSPXEcho, dspxOnly)).not.toBeNull();
        expect(FilterRegistry.resolve(FilterType.Echo, dspxOnly)).toBeNull();
    });
});

describe("FilterRegistry key classification", () => {
    it("isPluginName only recognises plugins that own nested filters", () => {
        expect(FilterRegistry.isPluginName("lavalink-filter-plugin")).toBe(true);

        // Flat DSPX filters declare no pluginName, so their keys are filters, not envelopes.
        expect(FilterRegistry.isPluginName("echo")).toBe(false);
        expect(FilterRegistry.isPluginName("low-pass")).toBe(false);

        // Never registered: a filter of its own.
        expect(FilterRegistry.isPluginName("my-fork-plugin")).toBe(false);
    });

    it("isKnown separates unregistered names from unresolvable ones", () => {
        expect(FilterRegistry.isKnown(FilterType.Echo)).toBe(true);
        expect(FilterRegistry.isKnown(FilterType.DSPXEcho)).toBe(true);
        expect(FilterRegistry.isKnown("myFilter")).toBe(false);

        // Known, yet unresolvable on a node without the backing plugin.
        expect(FilterRegistry.resolve(FilterType.Echo, fakeNode([], []))).toBeNull();
        expect(FilterRegistry.isKnown(FilterType.Echo)).toBe(true);
    });

    it("defineFilter is a pass-through", () => {
        const registration = { name: "passthrough", scope: FilterScope.Core };

        expect(defineFilter(registration)).toBe(registration);
    });
});

describe("FilterManager envelope routing", () => {
    it("dspx.setEcho writes a flat pluginFilters.echo payload and leaves the nested one untouched", async () => {
        const { fm } = bothPlugins();

        await fm.dspx.setEcho({ echoLength: 0.5, decay: 0.5 });

        const pf = fm.data.pluginFilters as Record<string, Record<string, unknown>>;
        expect(pf.echo).toEqual({ echoLength: 0.5, decay: 0.5 });
        expect(pf["lavalink-filter-plugin"]).toBeUndefined(); // the nested envelope is never created
    });

    it("plugin.setEcho writes a nested pluginFilters['lavalink-filter-plugin'].echo payload", async () => {
        const { fm } = bothPlugins();

        await fm.plugin.setEcho({ delay: 4, decay: 0.8 });

        const pf = fm.data.pluginFilters as Record<string, Record<string, unknown>>;
        expect(pf["lavalink-filter-plugin"]!.echo).toEqual({ delay: 4, decay: 0.8 });
        expect(pf.echo).toBeUndefined(); // the flat dspx echo is never created
    });

    it("dspx.setLowPass sends exactly the flat DSPX low-pass envelope", async () => {
        const { fm, spy } = setup({ filters: [...BUILTIN_FILTERS, ...DSPX_FILTERS], plugins: ["lavadspx-plugin"] });

        await fm.dspx.setLowPass({ cutoffFrequency: 500, boostFactor: 1.5 });

        expect(sentFilters(spy)).toEqual({
            pluginFilters: { "low-pass": { boostFactor: 1.5, cutoffFrequency: 500 } },
        });
    });

    it("plugin.setReverb sends exactly the nested lavalink-filter-plugin reverb envelope", async () => {
        const { fm, spy } = setup({ filters: [...BUILTIN_FILTERS, ...FILTER_PLUGIN_FILTERS], plugins: ["lavalink-filter-plugin"] });

        await fm.plugin.setReverb({ delays: [0.1], gains: [0.5] });

        expect(sentFilters(spy)).toEqual({
            pluginFilters: { "lavalink-filter-plugin": { reverb: { delays: [0.1], gains: [0.5] } } },
        });
    });

    it("commit keeps a dspx echo whose decay is 0", async () => {
        const { fm, spy } = bothPlugins();

        // Presence is what activates a filter, so a zero member does not make the payload disappear.
        await fm.dspx.setEcho({ echoLength: 0.5, decay: 0 });

        expect(sentFilters(spy)).toEqual({ pluginFilters: { echo: { echoLength: 0.5, decay: 0 } } });
    });
});

describe("FilterManager wire payload contract (core setters)", () => {
    const CORE_CASES: Array<[string, (fm: FilterManagerStructure) => Promise<unknown>, Record<string, unknown>]> = [
        ["setVolume(2)", (fm) => fm.setVolume(2), { volume: 2 }],
        ["setKaraoke()", (fm) => fm.setKaraoke(), { karaoke: { ...DefaultFilterPreset.Karaoke } }],
        ["setTremolo()", (fm) => fm.setTremolo(), { tremolo: { frequency: 4, depth: 0.8 } }],
        ["setVibrato()", (fm) => fm.setVibrato(), { vibrato: { frequency: 4, depth: 0.8 } }],
        ["setLowPass()", (fm) => fm.setLowPass(), { lowPass: { smoothing: 20 } }],
        ["setDistortion()", (fm) => fm.setDistortion(), { distortion: { ...DefaultFilterPreset.Distortion } }],
        ["setNightcore()", (fm) => fm.setNightcore(), { timescale: { ...DefaultFilterPreset.Nightcore } }],
        ["setVaporwave()", (fm) => fm.setVaporwave(), { timescale: { ...DefaultFilterPreset.Vaporwave } }],
        ["setAudioOutput(Mono)", (fm) => fm.setAudioOutput(AudioOutput.Mono), { channelMix: { ...AudioOutputData.mono } }],
        ["setEQBand({band:0,gain:0.25})", (fm) => fm.setEQBand({ band: 0, gain: 0.25 }), { equalizer: [{ band: 0, gain: 0.25 }] }],
    ];

    it.each(CORE_CASES)("%s sends exactly that filter and nothing else", async (_label, apply, expected) => {
        const { fm, spy } = setup();
        await apply(fm);
        expect(sentFilters(spy)).toEqual(expected);
    });
});

describe("FilterManager combined / clear / reset semantics", () => {
    it("keeps every applied filter and nothing extra", async () => {
        const { fm, spy } = setup();

        await fm.setNightcore();
        await fm.setKaraoke({ level: 0.5 });

        expect(sentFilters(spy)).toEqual({
            timescale: { ...DefaultFilterPreset.Nightcore },
            karaoke: { level: 0.5, monoLevel: 0, filterBand: 0, filterWidth: 0 },
        });
    });

    it("clearing one filter leaves only the remaining active filter", async () => {
        const { fm, spy } = setup();

        await fm.setNightcore();
        await fm.setKaraoke();
        await fm.clear(FilterType.Karaoke);

        expect(Object.keys(sentFilters(spy))).toEqual(["timescale"]);
    });

    it("reset() sends an empty payload after filters were applied", async () => {
        const { fm, spy } = setup();

        await fm.setNightcore();
        await fm.setDistortion();
        await fm.reset();

        expect(sentFilters(spy)).toEqual({});
    });
});

describe("FilterManager presence semantics", () => {
    it("a fresh commit sends a completely empty filters payload", async () => {
        const { fm, spy } = bothPlugins();

        await fm.apply(); // no-arg commit on an untouched payload

        expect(fm.data).toEqual({});
        expect(sentFilters(spy)).toEqual({});
    });

    it("applying a single filter sends only that key", async () => {
        const { fm, spy } = setup();

        await fm.setNightcore();

        const filters = sentFilters(spy);
        expect(filters).not.toHaveProperty("karaoke");
        expect(filters).not.toHaveProperty("distortion");
        expect(filters).not.toHaveProperty("pluginFilters");
        expect(Object.keys(filters)).toEqual(["timescale"]);
    });

    it("sends an all-zero payload, since presence is what activates a filter", async () => {
        const { fm, spy } = setup();

        await fm.setKaraoke({ level: 0, monoLevel: 0, filterBand: 0, filterWidth: 0 });

        expect(sentFilters(spy)).toEqual({ karaoke: { level: 0, monoLevel: 0, filterBand: 0, filterWidth: 0 } });
        expect(fm.isEnabled(FilterType.Karaoke)).toBe(true);
    });

    it("isEnabled tracks presence, not payload values", async () => {
        const { fm } = setup();

        expect(fm.isEnabled(FilterType.Volume)).toBe(false);

        await fm.setVolume(1); // the old neutral volume: active now that it was set explicitly

        expect(fm.isEnabled(FilterType.Volume)).toBe(true);
    });

    it("get returns the active payload, and undefined once cleared", async () => {
        const { fm } = setup();

        expect(fm.get(FilterType.Timescale)).toBeUndefined();

        await fm.setNightcore();
        expect(fm.get(FilterType.Timescale)).toEqual({ ...DefaultFilterPreset.Nightcore });

        await fm.clear(FilterType.Timescale);
        expect(fm.get(FilterType.Timescale)).toBeUndefined();
    });

    it("get reads from the envelope the routing options point at", async () => {
        const { fm } = setup();

        await fm.set("boost", { gain: 2 }, { plugin: "my-plugin" });

        expect(fm.get("boost", { plugin: "my-plugin" })).toEqual({ gain: 2 });
        expect(fm.get("boost")).toBeUndefined(); // flat envelope, nothing there
    });

    it("clear() removes the key instead of neutralising it", async () => {
        const { fm, spy } = setup();

        await fm.setNightcore();
        expect(fm.isEnabled(FilterType.Timescale)).toBe(true);

        await fm.clear(FilterType.Timescale);

        expect(fm.isEnabled(FilterType.Timescale)).toBe(false);
        expect(fm.data.timescale).toBeUndefined();
        expect(sentFilters(spy)).toEqual({});
    });

    it("clearEQBands removes the equalizer key", async () => {
        const { fm, spy } = setup();

        await fm.setEQBand({ band: 0, gain: 0.25 });
        expect(fm.isEnabled(FilterType.Equalizer)).toBe(true);

        await fm.clearEQBands();

        expect(fm.data.equalizer).toBeUndefined();
        expect(fm.isEnabled(FilterType.Equalizer)).toBe(false);
        expect(sentFilters(spy)).toEqual({});
    });
});

describe("FilterManager.set with unregistered filters", () => {
    it("routes an unknown filter to a flat pluginFilters entry", async () => {
        const { fm, spy } = setup();

        await fm.set("myFilter", { gain: 2 });

        expect(sentFilters(spy)).toEqual({ pluginFilters: { myFilter: { gain: 2 } } });
        expect(fm.isEnabled("myFilter")).toBe(true);
    });

    it("nests an unknown filter under the given plugin", async () => {
        const { fm, spy } = setup();

        await fm.set("boost", { gain: 2 }, { plugin: "my-fork-plugin" });

        expect(sentFilters(spy)).toEqual({ pluginFilters: { "my-fork-plugin": { boost: { gain: 2 } } } });
        expect(fm.isEnabled("boost", { plugin: "my-fork-plugin" })).toBe(true);
        expect(fm.isEnabled("boost")).toBe(false); // not the flat envelope
    });

    it("writes an unknown filter at the top level with top: true and keeps it through commit", async () => {
        const { fm, spy } = setup();

        // The node advertises none of this: an unknown top-level key must survive anyway.
        await fm.set("forkEcho", { decay: 0.5 }, { top: true });

        expect(sentFilters(spy)).toEqual({ forkEcho: { decay: 0.5 } });
        expect(fm.isEnabled("forkEcho", { top: true })).toBe(true);
    });

    it("clears an unknown filter from the envelope it was written to", async () => {
        const { fm, spy } = setup();

        await fm.set("boost", { gain: 2 }, { plugin: "my-fork-plugin" });
        await fm.clear("boost", { plugin: "my-fork-plugin" });

        expect(sentFilters(spy)).toEqual({});
        expect(fm.data.pluginFilters).toBeUndefined(); // empty wrapper pruned
    });

    it("keeps registered and unregistered filters side by side", async () => {
        const { fm, spy } = setup();

        await fm.setNightcore();
        await fm.set("myFilter", { gain: 2 });
        await fm.set("forkEcho", { decay: 0.5 }, { top: true });

        expect(sentFilters(spy)).toEqual({
            timescale: { ...DefaultFilterPreset.Nightcore },
            forkEcho: { decay: 0.5 },
            pluginFilters: { myFilter: { gain: 2 } },
        });
    });

    it("rejects contradictory routing options", async () => {
        const { fm } = setup();

        await expect(fm.set("x", {}, { plugin: true, top: true })).rejects.toThrow(PlayerError);
    });

    it("skips node validation for unknown filters, but honours validate: true", async () => {
        const { fm, spy } = setup({ filters: [...BUILTIN_FILTERS, "advertisedFork"] });

        // Not advertised, no validation asked for: goes through.
        await expect(fm.set("myFilter", { gain: 2 })).resolves.toBe(fm);

        // Not advertised and validation asked for: refused.
        await expect(fm.set("ghost", { gain: 2 }, { validate: true })).rejects.toThrow(PlayerError);

        // Advertised and validation asked for: goes through.
        spy.mockClear();
        await fm.set("advertisedFork", { gain: 1 }, { top: true, validate: true });
        expect(sentFilters(spy)).toHaveProperty("advertisedFork");
    });

    it("lets an explicit envelope override what the registry resolved", async () => {
        const { fm, spy } = bothPlugins();

        // FilterType.Echo normally nests under lavalink-filter-plugin.
        await fm.set(FilterType.Echo, { delay: 4, decay: 0.8 }, { top: true });

        expect(sentFilters(spy)).toEqual({ echo: { delay: 4, decay: 0.8 } });
    });

    it("validates registered filters unless validate: false", async () => {
        const { fm, spy } = setup({ filters: ["volume"] }); // timescale not advertised

        await expect(fm.setNightcore()).rejects.toThrow();

        spy.mockClear();
        await fm.set(FilterType.Timescale, { speed: 1.2, pitch: 1, rate: 1 }, { validate: false });

        // Written, but commit still drops a registered filter the node does not advertise.
        expect(fm.data.timescale).toEqual({ speed: 1.2, pitch: 1, rate: 1 });
        expect(sentFilters(spy)).toEqual({});
    });

    it("apply(name, payload) still works as a deprecated alias of set", async () => {
        const { fm, spy } = setup();

        await fm.apply(FilterType.Volume, 2);

        expect(sentFilters(spy)).toEqual({ volume: 2 });
    });
});

describe("FilterManager player isolation", () => {
    it("does not leak payload writes between players", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.info = {
            filters: ALL_FILTERS,
            plugins: [{ name: "lavadspx-plugin" }, { name: "lavalink-filter-plugin" }],
            isNodelink: false,
        } as never;

        const a = createRealPlayer(manager, { guildId: "g-a", voiceId: "v-a" });
        const b = createRealPlayer(manager, { guildId: "g-b", voiceId: "v-b" });

        expect(a.filterManager.data).not.toBe(b.filterManager.data);
        expect(a.filterManager.data).toEqual({});
        expect(b.filterManager.data).toEqual({});

        await a.filterManager.dspx.setEcho({ echoLength: 0.5, decay: 0.5 });

        expect((a.filterManager.data.pluginFilters as Record<string, unknown>).echo).toEqual({ echoLength: 0.5, decay: 0.5 });
        expect(b.filterManager.data).toEqual({}); // nothing created on B
    });
});

describe("FilterManager capability pruning on commit", () => {
    it("drops plugin filters the node cannot host, keeping the ones it can", async () => {
        // dspx installed, but NOT lavalink-filter-plugin.
        const { fm, spy } = setup({ filters: [...BUILTIN_FILTERS, ...DSPX_FILTERS], plugins: ["lavadspx-plugin"] });

        // Simulate state carried over from another node: a flat DSPX echo (hostable here)
        // and a nested lavalink-filter-plugin echo (NOT hostable — plugin absent).
        fm.data.pluginFilters = {
            echo: { echoLength: 0.5, decay: 0.5 },
            "lavalink-filter-plugin": { echo: { delay: 4, decay: 0.8 } },
        };
        spy.mockClear();

        await fm.apply(); // no-arg commit

        expect(sentFilters(spy)).toEqual({ pluginFilters: { echo: { echoLength: 0.5, decay: 0.5 } } });
    });

    it("keeps top-level filters when the node has not reported its info yet", async () => {
        const { node, fm, spy } = setup();

        fm.data.timescale = { speed: 1.29, pitch: 1.29, rate: 0.94 };
        fm.data.rotation = { rotationHz: 0.2 };

        // Not ready yet: no /v4/info response, so the advertised list is unknown, not empty.
        node.info = null;
        spy.mockClear();

        await fm.apply();

        expect(sentFilters(spy)).toEqual({
            timescale: { speed: 1.29, pitch: 1.29, rate: 0.94 },
            rotation: { rotationHz: 0.2 },
        });
    });

    it("still drops top-level filters the node reports it does not support", async () => {
        const { fm, spy } = setup({ filters: ["volume", "equalizer"] });

        fm.data.timescale = { speed: 1.29, pitch: 1.29, rate: 0.94 };
        spy.mockClear();

        await fm.apply();

        expect(sentFilters(spy)).toEqual({});
    });
});
