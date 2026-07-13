import { describe, expect, it, type Mock } from "vitest";
import { FilterRegistry, FilterScope } from "../../src/registry/FiltersRegistry";
import { PluginCapabilities } from "../../src/registry/PluginRegistry";
import { FilterType } from "../../src/types/Filters";
import { createRealManager, createRealNode, createRealPlayer } from "../helpers";

function fakeNode(plugins: string[], filters: string[] = []) {
    return {
        id: "n",
        isNodelink: () => false,
        info: { plugins: plugins.map((name) => ({ name })), filters },
    } as never;
}

function withBothPlugins() {
    const manager = createRealManager();
    const node = createRealNode(manager);
    node.info = {
        filters: ["echo"],
        plugins: [{ name: "lavadspx-plugin" }, { name: "lavalink-filter-plugin" }],
        isNodelink: false,
    } as never;
    const player = createRealPlayer(manager);
    return { manager, node, player };
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

describe("FilterManager envelope routing", () => {
    it("dspx.setEcho writes a flat pluginFilters.echo payload", async () => {
        const { player } = withBothPlugins();

        await player.filterManager.dspx.setEcho({ echoLength: 0.5, decay: 0.5 });

        const pf = player.filterManager.data.pluginFilters as Record<string, unknown>;
        expect(pf.echo).toEqual({ echoLength: 0.5, decay: 0.5 });
        // The nested lavalink-filter-plugin echo is left untouched (still the default).
        expect((pf["lavalink-filter-plugin"] as Record<string, unknown>).echo).toEqual({ delay: 0, decay: 0 });
    });

    it("plugin.setEcho writes a nested pluginFilters['lavalink-filter-plugin'].echo payload", async () => {
        const { player } = withBothPlugins();

        await player.filterManager.plugin.setEcho({ delay: 4, decay: 0.8 });

        const pf = player.filterManager.data.pluginFilters as Record<string, Record<string, unknown>>;
        expect(pf["lavalink-filter-plugin"].echo).toEqual({ delay: 4, decay: 0.8 });
    });

    it("commit keeps a dspx echo that only sets echoLength (uses the dspx default predicate)", async () => {
        const { player, node } = withBothPlugins();
        const spy = node.rest.updatePlayer as unknown as Mock;
        spy.mockClear();

        // decay 0 but echoLength set: with the filter-plugin predicate this would be wrongly stripped.
        await player.filterManager.dspx.setEcho({ echoLength: 0.5, decay: 0 });

        const sent = spy.mock.calls.at(-1)?.[0] as { playerOptions: { filters: { pluginFilters?: Record<string, unknown> } } };
        expect(sent.playerOptions.filters.pluginFilters?.echo).toEqual({ echoLength: 0.5, decay: 0 });
    });
});

describe("FilterManager player isolation (no shared default state)", () => {
    it("does not share pluginFilters objects between players and does not leak mutations", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.info = {
            filters: ["echo"],
            plugins: [{ name: "lavadspx-plugin" }, { name: "lavalink-filter-plugin" }],
            isNodelink: false,
        } as never;

        const a = createRealPlayer(manager, { guildId: "g-a", voiceId: "v-a" });
        const b = createRealPlayer(manager, { guildId: "g-b", voiceId: "v-b" });

        expect(a.filterManager.data.pluginFilters).not.toBe(b.filterManager.data.pluginFilters);

        await a.filterManager.dspx.setEcho({ echoLength: 0.5, decay: 0.5 });

        const bpf = b.filterManager.data.pluginFilters as Record<string, unknown>;
        expect(bpf.echo).toEqual({ decay: 0, delay: 0, echoLength: 0 }); // still default, not leaked from A
    });
});
