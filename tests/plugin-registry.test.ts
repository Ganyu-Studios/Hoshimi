import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodeError } from "../src/classes/Errors";
import { PluginCapabilities, PluginRegistry } from "../src/registry/PluginRegistry";
import { PluginNames } from "../src/types/Node";

interface NodeMockOptions {
    /**
     * Plugin names reported by the node's /v4/info endpoint.
     * @default []
     */
    plugins?: string[];
    /**
     * Whether `isNodelink()` should return true.
     * @default false
     */
    isNodelink?: boolean;
    /**
     * Whether `info` is populated. Set to false to simulate a not-ready node.
     * @default true
     */
    ready?: boolean;
}

function createNodeMock(opts: NodeMockOptions = {}) {
    const emit = vi.fn();
    return {
        node: {
            id: "test-node",
            info: opts.ready === false ? null : { plugins: (opts.plugins ?? []).map((name): { name: string } => ({ name })) },
            isNodelink: (): boolean => opts.isNodelink ?? false,
            nodeManager: {
                manager: { emit },
            },
        } as never,
        emit,
    };
}

function registerBuiltins(): void {
    PluginRegistry.register([
        { capability: PluginCapabilities.Lyrics, name: PluginNames.LavaLyrics },
        { capability: PluginCapabilities.Lyrics, name: PluginNames.JavaLyrics },
        { capability: PluginCapabilities.Lyrics, name: PluginNames.LavaSrc },
        { capability: PluginCapabilities.ExtraSources, name: PluginNames.LavaSrc },
        { capability: PluginCapabilities.ExtraSources, name: PluginNames.Jiosaavn },
        { capability: PluginCapabilities.Filters, name: PluginNames.FilterPlugin },
        { capability: PluginCapabilities.Dspx, name: PluginNames.LavaDspx },
        { capability: PluginCapabilities.SponsorBlock, name: PluginNames.SponsorBlock },
        { capability: PluginCapabilities.Youtube, name: PluginNames.Youtube },
        { capability: PluginCapabilities.Search, name: PluginNames.LavaSearch },
    ]);
}

describe("PluginRegistry", () => {
    beforeEach(() => {
        PluginRegistry.clear();
        registerBuiltins();
    });

    afterEach(() => {
        PluginRegistry.clear();
        registerBuiltins();
    });

    describe("register", () => {
        it("registers a single plugin under a capability and returns its canonical name", () => {
            const result = PluginRegistry.register({
                capability: PluginCapabilities.Lyrics,
                name: "lavasrc-fork-plugin",
            });

            expect(result).toEqual(["lavasrc-fork-plugin"]);
            expect(PluginRegistry.getPluginsFor(PluginCapabilities.Lyrics)).toContain("lavasrc-fork-plugin");
        });

        it("registers multiple plugins via rest arguments", () => {
            const result = PluginRegistry.register(
                { capability: PluginCapabilities.Lyrics, name: "fork-one-plugin" },
                { capability: PluginCapabilities.ExtraSources, name: "fork-two-plugin" },
            );

            expect(result).toEqual(["fork-one-plugin", "fork-two-plugin"]);
        });

        it("registers multiple plugins via a single array argument", () => {
            const result = PluginRegistry.register([
                { capability: PluginCapabilities.Lyrics, name: "array-one-plugin" },
                { capability: PluginCapabilities.Dspx, name: "array-two-plugin" },
            ]);

            expect(result).toEqual(["array-one-plugin", "array-two-plugin"]);
            expect(PluginRegistry.hasCapability([{ name: "array-one-plugin" }], PluginCapabilities.Lyrics)).toBe(true);
            expect(PluginRegistry.hasCapability([{ name: "array-two-plugin" }], PluginCapabilities.Dspx)).toBe(true);
        });

        it("ignores entries with empty capability or name strings", () => {
            const result = PluginRegistry.register(
                { capability: "", name: "ignored-plugin" },
                { capability: PluginCapabilities.Lyrics, name: "" },
                { capability: "   ", name: "   " },
            );

            expect(result).toEqual([]);
            expect(PluginRegistry.getPluginsFor(PluginCapabilities.Lyrics)).not.toContain("ignored-plugin");
        });

        it("treats lookups as case-insensitive while preserving canonical casing in listings", () => {
            PluginRegistry.register({ capability: "CustomCapability", name: "Forked-Plugin" });

            expect(PluginRegistry.hasCapability([{ name: "forked-plugin" }], "customcapability")).toBe(true);
            expect(PluginRegistry.hasCapability([{ name: "FORKED-PLUGIN" }], "CUSTOMCAPABILITY")).toBe(true);
            expect(PluginRegistry.getPlugins()).toContain("Forked-Plugin");
        });

        it("allows a single plugin to provide multiple capabilities", () => {
            PluginRegistry.register(
                { capability: PluginCapabilities.Lyrics, name: "multi-fork-plugin" },
                { capability: PluginCapabilities.ExtraSources, name: "multi-fork-plugin" },
            );

            expect(PluginRegistry.getCapabilitiesOf("multi-fork-plugin").sort()).toEqual(["extra-sources", "lyrics"].sort());
        });

        it("does not duplicate canonical entries when the same plugin is registered twice", () => {
            PluginRegistry.register(
                { capability: PluginCapabilities.Lyrics, name: "twice-plugin" },
                { capability: PluginCapabilities.Lyrics, name: "twice-plugin" },
            );

            const occurrences = PluginRegistry.getPlugins().filter((name): boolean => name === "twice-plugin").length;
            expect(occurrences).toBe(1);
        });
    });

    describe("unregister", () => {
        it("removes a plugin from a single capability when specified", () => {
            PluginRegistry.register(
                { capability: PluginCapabilities.Lyrics, name: "scoped-plugin" },
                { capability: PluginCapabilities.ExtraSources, name: "scoped-plugin" },
            );

            PluginRegistry.unregister("scoped-plugin", PluginCapabilities.Lyrics);

            expect(PluginRegistry.getPluginsFor(PluginCapabilities.Lyrics)).not.toContain("scoped-plugin");
            expect(PluginRegistry.getPluginsFor(PluginCapabilities.ExtraSources)).toContain("scoped-plugin");
            expect(PluginRegistry.getCapabilitiesOf("scoped-plugin")).toEqual(["extra-sources"]);
        });

        it("removes a plugin from every capability when capability is omitted", () => {
            PluginRegistry.register(
                { capability: PluginCapabilities.Lyrics, name: "bulk-plugin" },
                { capability: PluginCapabilities.ExtraSources, name: "bulk-plugin" },
            );

            PluginRegistry.unregister("bulk-plugin");

            expect(PluginRegistry.getCapabilitiesOf("bulk-plugin")).toEqual([]);
            expect(PluginRegistry.getPluginsFor(PluginCapabilities.Lyrics)).not.toContain("bulk-plugin");
            expect(PluginRegistry.getPluginsFor(PluginCapabilities.ExtraSources)).not.toContain("bulk-plugin");
            expect(PluginRegistry.getPlugins()).not.toContain("bulk-plugin");
        });

        it("is a no-op for unknown plugin names", () => {
            expect(() => PluginRegistry.unregister("nonexistent-plugin")).not.toThrow();
            expect(() => PluginRegistry.unregister("nonexistent-plugin", PluginCapabilities.Lyrics)).not.toThrow();
        });

        it("does not affect other plugins under the same capability", () => {
            PluginRegistry.register({ capability: PluginCapabilities.Lyrics, name: "sibling-plugin" });

            PluginRegistry.unregister("sibling-plugin", PluginCapabilities.Lyrics);

            expect(PluginRegistry.getPluginsFor(PluginCapabilities.Lyrics)).toContain(PluginNames.LavaLyrics);
            expect(PluginRegistry.getPluginsFor(PluginCapabilities.Lyrics)).toContain(PluginNames.JavaLyrics);
        });
    });

    describe("hasCapability", () => {
        it("returns true when at least one installed plugin provides the capability", () => {
            expect(PluginRegistry.hasCapability([{ name: PluginNames.LavaLyrics }], PluginCapabilities.Lyrics)).toBe(true);
        });

        it("returns false when no installed plugin provides the capability", () => {
            expect(PluginRegistry.hasCapability([{ name: "unrelated-plugin" }], PluginCapabilities.Lyrics)).toBe(false);
        });

        it("returns false for an unregistered capability even if plugins are installed", () => {
            expect(PluginRegistry.hasCapability([{ name: PluginNames.LavaLyrics }], "ghost-capability")).toBe(false);
        });

        it("recognizes a fork registered after the fact", () => {
            expect(PluginRegistry.hasCapability([{ name: "fork-only-plugin" }], PluginCapabilities.Lyrics)).toBe(false);

            PluginRegistry.register({ capability: PluginCapabilities.Lyrics, name: "fork-only-plugin" });

            expect(PluginRegistry.hasCapability([{ name: "fork-only-plugin" }], PluginCapabilities.Lyrics)).toBe(true);
        });
    });

    describe("skip and restore validation", () => {
        it("skipValidation(true) reports global skip via isValidationSkipped()", () => {
            expect(PluginRegistry.isValidationSkipped()).toBe(false);

            PluginRegistry.skipValidation(true);

            expect(PluginRegistry.isValidationSkipped()).toBe(true);
            expect(PluginRegistry.isValidationSkipped(PluginCapabilities.Lyrics)).toBe(true);
        });

        it("skipValidation(capability) only affects the given capability", () => {
            PluginRegistry.skipValidation(PluginCapabilities.Filters);

            expect(PluginRegistry.isValidationSkipped()).toBe(false);
            expect(PluginRegistry.isValidationSkipped(PluginCapabilities.Filters)).toBe(true);
            expect(PluginRegistry.isValidationSkipped(PluginCapabilities.Lyrics)).toBe(false);
        });

        it("skipValidation accepts an array of capabilities", () => {
            PluginRegistry.skipValidation([PluginCapabilities.Lyrics, PluginCapabilities.Dspx]);

            expect(PluginRegistry.isValidationSkipped(PluginCapabilities.Lyrics)).toBe(true);
            expect(PluginRegistry.isValidationSkipped(PluginCapabilities.Dspx)).toBe(true);
            expect(PluginRegistry.isValidationSkipped(PluginCapabilities.Filters)).toBe(false);
        });

        it("restoreValidation() with no argument clears every skip", () => {
            PluginRegistry.skipValidation(true);
            PluginRegistry.skipValidation([PluginCapabilities.Lyrics, PluginCapabilities.Dspx]);

            PluginRegistry.restoreValidation();

            expect(PluginRegistry.isValidationSkipped()).toBe(false);
            expect(PluginRegistry.isValidationSkipped(PluginCapabilities.Lyrics)).toBe(false);
        });

        it("restoreValidation(capability) only restores the given capability", () => {
            PluginRegistry.skipValidation([PluginCapabilities.Lyrics, PluginCapabilities.Dspx]);

            PluginRegistry.restoreValidation(PluginCapabilities.Lyrics);

            expect(PluginRegistry.isValidationSkipped(PluginCapabilities.Lyrics)).toBe(false);
            expect(PluginRegistry.isValidationSkipped(PluginCapabilities.Dspx)).toBe(true);
        });
    });

    describe("validate", () => {
        it("passes when a required capability is provided by an installed plugin", () => {
            const { node } = createNodeMock({ plugins: [PluginNames.FilterPlugin] });

            expect(() => PluginRegistry.validate({ node, required: [PluginCapabilities.Filters] })).not.toThrow();
        });

        it("throws NodeError when a required capability is missing", () => {
            const { node } = createNodeMock({ plugins: [PluginNames.LavaLyrics] });

            expect(() => PluginRegistry.validate({ node, required: [PluginCapabilities.Filters] })).toThrow(NodeError);
        });

        it("passes when one of the `any` capabilities is present", () => {
            const { node } = createNodeMock({ plugins: [PluginNames.JavaLyrics] });

            expect(() =>
                PluginRegistry.validate({
                    node,
                    any: [PluginCapabilities.Lyrics, PluginCapabilities.Filters],
                }),
            ).not.toThrow();
        });

        it("throws NodeError when none of the `any` capabilities are present", () => {
            const { node } = createNodeMock({ plugins: ["unrelated-plugin"] });

            expect(() =>
                PluginRegistry.validate({
                    node,
                    any: [PluginCapabilities.Lyrics, PluginCapabilities.Filters],
                }),
            ).toThrow(NodeError);
        });

        it("throws NodeError when the node is not ready", () => {
            const { node } = createNodeMock({ ready: false });

            expect(() => PluginRegistry.validate({ node, required: [PluginCapabilities.Lyrics] })).toThrow(NodeError);
        });

        it("does not validate Nodelink nodes and emits a debug event", () => {
            const { node, emit } = createNodeMock({ plugins: [], isNodelink: true });

            expect(() => PluginRegistry.validate({ node, required: [PluginCapabilities.Filters] })).not.toThrow();
            expect(emit).toHaveBeenCalled();
        });

        it("recognizes a registered fork as satisfying the capability", () => {
            const { node } = createNodeMock({ plugins: ["lavasrc-fork-plugin"] });

            // Before registering the fork: missing capability.
            expect(() => PluginRegistry.validate({ node, any: [PluginCapabilities.Lyrics] })).toThrow(NodeError);

            PluginRegistry.register({ capability: PluginCapabilities.Lyrics, name: "lavasrc-fork-plugin" });

            // After registering: validation passes.
            expect(() => PluginRegistry.validate({ node, any: [PluginCapabilities.Lyrics] })).not.toThrow();
        });

        it("bypasses validation globally when skipValidation(true) is active", () => {
            const { node, emit } = createNodeMock({ plugins: [] });

            PluginRegistry.skipValidation(true);

            expect(() => PluginRegistry.validate({ node, required: [PluginCapabilities.Filters] })).not.toThrow();
            expect(emit).toHaveBeenCalled();
        });

        it("bypasses validation for individually-skipped capabilities", () => {
            const { node } = createNodeMock({ plugins: [] });

            PluginRegistry.skipValidation(PluginCapabilities.Filters);

            expect(() => PluginRegistry.validate({ node, required: [PluginCapabilities.Filters] })).not.toThrow();
        });

        it("still enforces non-skipped capabilities when only one is skipped", () => {
            const { node } = createNodeMock({ plugins: [] });

            PluginRegistry.skipValidation(PluginCapabilities.Filters);

            expect(() =>
                PluginRegistry.validate({
                    node,
                    required: [PluginCapabilities.Filters, PluginCapabilities.Lyrics],
                }),
            ).toThrow(NodeError);
        });

        it("is a no-op when called without required or any", () => {
            const { node } = createNodeMock({ plugins: [PluginNames.LavaLyrics] });

            expect(() => PluginRegistry.validate({ node })).not.toThrow();
        });
    });

    describe("built-in pre-registrations", () => {
        it("registers LavaLyrics, JavaLyrics, and LavaSrc under Lyrics", () => {
            const lyrics = PluginRegistry.getPluginsFor(PluginCapabilities.Lyrics);

            expect(lyrics).toContain(PluginNames.LavaLyrics);
            expect(lyrics).toContain(PluginNames.JavaLyrics);
            expect(lyrics).toContain(PluginNames.LavaSrc);
        });

        it("registers LavaSrc under both Lyrics and ExtraSources", () => {
            const capabilities = PluginRegistry.getCapabilitiesOf(PluginNames.LavaSrc);

            expect(capabilities).toContain("lyrics");
            expect(capabilities).toContain("extra-sources");
        });

        it("registers FilterPlugin under Filters", () => {
            expect(PluginRegistry.getPluginsFor(PluginCapabilities.Filters)).toContain(PluginNames.FilterPlugin);
        });

        it("registers LavaDspx under Dspx", () => {
            expect(PluginRegistry.getPluginsFor(PluginCapabilities.Dspx)).toContain(PluginNames.LavaDspx);
        });
    });
});
