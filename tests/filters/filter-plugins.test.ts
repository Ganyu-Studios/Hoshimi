import { describe, expect, it, vi } from "vitest";
import { DSPXPluginFilter } from "../../src/classes/player/filters/DSPXPlugin";
import { LavalinkPluginFilter } from "../../src/classes/player/filters/LavalinkPlugin";
import { FilterType } from "../../src/types/Filters";

function createManagerMock() {
    return {
        set: vi.fn().mockResolvedValue(undefined),
    };
}

describe("Filter plugin facades", () => {
    it("LavalinkPluginFilter.setEcho delegates to manager.set with FilterType.Echo and the given payload", async () => {
        const manager = createManagerMock();
        const plugin = new LavalinkPluginFilter(manager as never);

        await plugin.setEcho({ decay: 0.5, delay: 200 });

        expect(manager.set).toHaveBeenCalledTimes(1);
        expect(manager.set).toHaveBeenCalledWith(FilterType.Echo, { decay: 0.5, delay: 200 });
    });

    it("LavalinkPluginFilter.setEcho applies preset defaults when called without args", async () => {
        const manager = createManagerMock();
        const plugin = new LavalinkPluginFilter(manager as never);

        await plugin.setEcho();

        expect(manager.set).toHaveBeenCalledWith(
            FilterType.Echo,
            expect.objectContaining({ decay: expect.any(Number), delay: expect.any(Number) }),
        );
    });

    it("LavalinkPluginFilter.setReverb delegates to manager.set with FilterType.Reverb", async () => {
        const manager = createManagerMock();
        const plugin = new LavalinkPluginFilter(manager as never);

        await plugin.setReverb({ delays: [50, 100], gains: [0.5, 0.3] });

        expect(manager.set).toHaveBeenCalledWith(FilterType.Reverb, {
            delays: [50, 100],
            gains: [0.5, 0.3],
        });
    });

    it("LavalinkPluginFilter.setEcho propagates errors from manager.set", async () => {
        const manager = createManagerMock();
        manager.set.mockRejectedValueOnce(new Error("apply failed"));
        const plugin = new LavalinkPluginFilter(manager as never);

        await expect(plugin.setEcho()).rejects.toThrow("apply failed");
    });

    it("DSPXPluginFilter.setLowPass delegates to manager.set with FilterType.DSPXLowpass", async () => {
        const manager = createManagerMock();
        const dspx = new DSPXPluginFilter(manager as never);

        await dspx.setLowPass({ cutoffFrequency: 200, boostFactor: 1.2 });

        expect(manager.set).toHaveBeenCalledWith(FilterType.DSPXLowpass, {
            cutoffFrequency: 200,
            boostFactor: 1.2,
        });
    });

    it("DSPXPluginFilter.setHighPass delegates to manager.set with FilterType.DSPXHighpass", async () => {
        const manager = createManagerMock();
        const dspx = new DSPXPluginFilter(manager as never);

        await dspx.setHighPass({ cutoffFrequency: 2000, boostFactor: 0.8 });

        expect(manager.set).toHaveBeenCalledWith(FilterType.DSPXHighpass, {
            cutoffFrequency: 2000,
            boostFactor: 0.8,
        });
    });

    it("DSPXPluginFilter.setNormalization delegates to manager.set with FilterType.DSPXNormalization", async () => {
        const manager = createManagerMock();
        const dspx = new DSPXPluginFilter(manager as never);

        await dspx.setNormalization({ maxAmplitude: 0.9, adaptive: true });

        expect(manager.set).toHaveBeenCalledWith(
            FilterType.DSPXNormalization,
            expect.objectContaining({ maxAmplitude: 0.9, adaptive: true }),
        );
    });

    it("DSPXPluginFilter.setEcho delegates to manager.set with FilterType.DSPXEcho", async () => {
        const manager = createManagerMock();
        const dspx = new DSPXPluginFilter(manager as never);

        await dspx.setEcho({ decay: 0.5, echoLength: 0.5 });

        expect(manager.set).toHaveBeenCalledWith(FilterType.DSPXEcho, expect.objectContaining({ decay: 0.5, echoLength: 0.5 }));
    });

    it("DSPXPluginFilter.setLowPass propagates errors from manager.set", async () => {
        const manager = createManagerMock();
        manager.set.mockRejectedValueOnce(new Error("apply failed"));
        const dspx = new DSPXPluginFilter(manager as never);

        await expect(dspx.setLowPass()).rejects.toThrow("apply failed");
    });
});
