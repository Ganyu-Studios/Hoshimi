import { describe, expect, it, vi } from "vitest";
import { NodeError, PlayerError } from "../src/classes/Errors";
import { DSPXPluginFilter } from "../src/classes/player/filters/DSPXPlugin";
import { LavalinkPluginFilter } from "../src/classes/player/filters/LavalinkPlugin";
import { FilterType } from "../src/types/Filters";
import { PluginNames } from "../src/types/Node";
import { createMockNode } from "./helpers";

function createFilterManager(filters: string[], plugins: string[]) {
    const node = createMockNode({
        info: { filters, plugins: plugins.map((name) => ({ name })) },
        isNodelink: () => false,
    });

    return {
        player: { node },
        data: {
            pluginFilters: {},
        },
        filters: {
            lavalinkLavaDspxPlugin: {
                lowPass: false,
                highPass: false,
                normalization: false,
                echo: false,
            },
            lavalinkFilterPlugin: {
                echo: false,
                reverb: false,
            },
        },
        apply: vi.fn().mockResolvedValue(undefined),
    };
}

describe("Filter plugins", () => {
    it("DSPX setLowPass toggles and applies on success", async () => {
        const manager = createFilterManager([FilterType.DSPXLowpass], [PluginNames.LavaDspx]);
        const dspx = new DSPXPluginFilter(manager as never);

        await dspx.setLowPass();

        expect(manager.filters.lavalinkLavaDspxPlugin.lowPass).toBe(true);
        expect(manager.apply).toHaveBeenCalled();
    });

    it("DSPX setLowPass throws when required plugin is missing", async () => {
        const manager = createFilterManager([FilterType.DSPXLowpass], []);
        const dspx = new DSPXPluginFilter(manager as never);

        await expect(dspx.setLowPass()).rejects.toThrow(NodeError);
    });

    it("DSPX setLowPass throws when node filter is missing", async () => {
        const manager = createFilterManager([], [PluginNames.LavaDspx]);
        const dspx = new DSPXPluginFilter(manager as never);

        await expect(dspx.setLowPass()).rejects.toThrow(PlayerError);
    });

    it("Lavalink setEcho toggles and applies on success", async () => {
        const manager = createFilterManager([FilterType.Echo], [PluginNames.FilterPlugin]);
        const plugin = new LavalinkPluginFilter(manager as never);

        await plugin.setEcho();

        expect(manager.filters.lavalinkFilterPlugin.echo).toBe(true);
        expect(manager.apply).toHaveBeenCalled();
    });

    it("Lavalink setEcho throws when node filter is missing", async () => {
        const manager = createFilterManager([], [PluginNames.FilterPlugin]);
        const plugin = new LavalinkPluginFilter(manager as never);

        await expect(plugin.setEcho()).rejects.toThrow(PlayerError);
    });

    it("Lavalink setEcho throws when required plugin is missing", async () => {
        const manager = createFilterManager([FilterType.Echo], []);
        const plugin = new LavalinkPluginFilter(manager as never);

        await expect(plugin.setEcho()).rejects.toThrow(NodeError);
    });

    it("DSPX setLowPass propagates apply failures", async () => {
        const manager = createFilterManager([FilterType.DSPXLowpass], [PluginNames.LavaDspx]);
        manager.apply.mockRejectedValueOnce(new Error("apply failed"));

        const dspx = new DSPXPluginFilter(manager as never);

        await expect(dspx.setLowPass()).rejects.toThrow("apply failed");
    });

    it("Lavalink setEcho propagates apply failures", async () => {
        const manager = createFilterManager([FilterType.Echo], [PluginNames.FilterPlugin]);
        manager.apply.mockRejectedValueOnce(new Error("apply failed"));

        const plugin = new LavalinkPluginFilter(manager as never);

        await expect(plugin.setEcho()).rejects.toThrow("apply failed");
    });
});
