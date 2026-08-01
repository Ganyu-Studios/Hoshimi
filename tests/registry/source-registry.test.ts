import { describe, expect, it } from "vitest";
import { SourceProtocol, SourceRegistry } from "../../src/registry/SourceRegistry";
import { SearchSources } from "../../src/types/Manager";
import { SourceNames } from "../../src/types/Node";

describe("SourceRegistry", () => {
    describe("register", () => {
        it("registers a single source and returns its canonical identifier", () => {
            const result = SourceRegistry.register({ source: "src-single-1" });

            expect(result).toEqual(["src-single-1"]);
            expect(SourceRegistry.isRegistered("src-single-1")).toBe(true);
        });

        it("registers a source with an alias name", () => {
            SourceRegistry.register({ source: "src-alias-1", name: "alias-1" });

            expect(SourceRegistry.resolve("alias-1")).toBe("src-alias-1");
            expect(SourceRegistry.resolve("src-alias-1")).toBe("src-alias-1");
        });

        it("registers multiple sources via rest arguments", () => {
            const result = SourceRegistry.register(
                { source: "src-rest-1" },
                { source: "src-rest-2", protocol: SourceProtocol.DoubleSlash },
            );

            expect(result).toEqual(["src-rest-1", "src-rest-2"]);
            expect(SourceRegistry.isRegistered("src-rest-1")).toBe(true);
            expect(SourceRegistry.isRegistered("src-rest-2")).toBe(true);
        });

        it("registers multiple sources via a single array argument", () => {
            const result = SourceRegistry.register([{ source: "src-array-1" }, { source: "src-array-2", protocol: SourceProtocol.Raw }]);

            expect(result).toEqual(["src-array-1", "src-array-2"]);
        });

        it("ignores entries with empty source identifiers", () => {
            const result = SourceRegistry.register({ source: "   " }, { source: "" });

            expect(result).toEqual([]);
        });

        it("defaults to the colon protocol when none is specified", () => {
            SourceRegistry.register({ source: "src-protocol-default" });

            expect(SourceRegistry.createIdentifier("src-protocol-default", "query")).toBe("src-protocol-default:query");
        });

        it("uses the double-slash protocol when configured", () => {
            SourceRegistry.register({ source: "src-protocol-slash", protocol: SourceProtocol.DoubleSlash });

            expect(SourceRegistry.createIdentifier("src-protocol-slash", "value")).toBe("src-protocol-slash://value");
        });

        it("uses the raw protocol when configured", () => {
            SourceRegistry.register({ source: "src-protocol-raw", protocol: SourceProtocol.Raw });

            expect(SourceRegistry.createIdentifier("src-protocol-raw", "https://example.com/file.mp3")).toBe(
                "https://example.com/file.mp3",
            );
        });

        it("allows re-registering the same source to update its protocol", () => {
            SourceRegistry.register({ source: "src-reregister-1" });
            expect(SourceRegistry.createIdentifier("src-reregister-1", "x")).toBe("src-reregister-1:x");

            SourceRegistry.register({ source: "src-reregister-1", protocol: SourceProtocol.DoubleSlash });
            expect(SourceRegistry.createIdentifier("src-reregister-1", "x")).toBe("src-reregister-1://x");
        });
    });

    describe("resolve", () => {
        it("returns the canonical identifier for an exact match", () => {
            SourceRegistry.register({ source: "src-resolve-1" });

            expect(SourceRegistry.resolve("src-resolve-1")).toBe("src-resolve-1");
        });

        it("is case-insensitive", () => {
            SourceRegistry.register({ source: "src-resolve-case", name: "Resolve-Name" });

            expect(SourceRegistry.resolve("SRC-RESOLVE-CASE")).toBe("src-resolve-case");
            expect(SourceRegistry.resolve("resolve-name")).toBe("src-resolve-case");
            expect(SourceRegistry.resolve("RESOLVE-NAME")).toBe("src-resolve-case");
        });

        it("trims whitespace before lookup", () => {
            SourceRegistry.register({ source: "src-resolve-trim" });

            expect(SourceRegistry.resolve("  src-resolve-trim  ")).toBe("src-resolve-trim");
        });

        it("returns undefined for unknown sources", () => {
            expect(SourceRegistry.resolve("never-registered-source")).toBeUndefined();
        });

        it("returns undefined for empty input", () => {
            expect(SourceRegistry.resolve("")).toBeUndefined();
            expect(SourceRegistry.resolve("   ")).toBeUndefined();
        });
    });

    describe("isRegistered", () => {
        it("returns true for a registered source", () => {
            SourceRegistry.register({ source: "src-isreg-1" });

            expect(SourceRegistry.isRegistered("src-isreg-1")).toBe(true);
        });

        it("returns true for a registered alias", () => {
            SourceRegistry.register({ source: "src-isreg-alias", name: "alias-isreg" });

            expect(SourceRegistry.isRegistered("alias-isreg")).toBe(true);
        });

        it("returns false for unknown sources", () => {
            expect(SourceRegistry.isRegistered("unknown-source-xyz")).toBe(false);
        });
    });

    describe("createIdentifier", () => {
        it("trims the query before assembling the identifier", () => {
            SourceRegistry.register({ source: "src-ci-trim" });

            expect(SourceRegistry.createIdentifier("src-ci-trim", "   hello world   ")).toBe("src-ci-trim:hello world");
        });

        it("resolves aliases before formatting", () => {
            SourceRegistry.register({ source: "src-ci-alias", name: "alias-ci" });

            expect(SourceRegistry.createIdentifier("alias-ci", "song")).toBe("src-ci-alias:song");
        });

        it("throws TypeError for an unknown source", () => {
            expect(() => SourceRegistry.createIdentifier("ghost-source", "query")).toThrow(TypeError);
        });

        it("respects the raw protocol and returns the query untouched", () => {
            SourceRegistry.register({ source: "src-ci-raw", protocol: SourceProtocol.Raw });

            expect(SourceRegistry.createIdentifier("src-ci-raw", "https://files.example/track.mp3")).toBe(
                "https://files.example/track.mp3",
            );
        });
    });

    describe("parseQuery", () => {
        it("parses a colon-prefixed query", () => {
            SourceRegistry.register({ source: "src-parse-colon" });

            expect(SourceRegistry.parseQuery("src-parse-colon:hello")).toEqual({
                source: "src-parse-colon",
                value: "hello",
            });
        });

        it("parses a double-slash-prefixed query", () => {
            SourceRegistry.register({ source: "src-parse-slash", protocol: SourceProtocol.DoubleSlash });

            expect(SourceRegistry.parseQuery("src-parse-slash://value")).toEqual({
                source: "src-parse-slash",
                value: "value",
            });
        });

        it("trims the parsed value", () => {
            SourceRegistry.register({ source: "src-parse-trim" });

            expect(SourceRegistry.parseQuery("src-parse-trim:   foo   ")).toEqual({
                source: "src-parse-trim",
                value: "foo",
            });
        });

        it("returns null when no registered source matches", () => {
            expect(SourceRegistry.parseQuery("nothing-here just a free-text query")).toBeNull();
        });

        it("returns null for empty queries", () => {
            expect(SourceRegistry.parseQuery("")).toBeNull();
            expect(SourceRegistry.parseQuery("   ")).toBeNull();
        });

        it("prefers the double-slash form when both colon and slashes appear", () => {
            SourceRegistry.register({ source: "src-parse-both" });

            // The colon form matches first because `://` includes the colon; the
            // registry checks `://` before `:`, so the value should not retain
            // the leading slashes.
            expect(SourceRegistry.parseQuery("src-parse-both://value")).toEqual({
                source: "src-parse-both",
                value: "value",
            });
        });
    });

    describe("getRegistered", () => {
        it("includes every registered source", () => {
            SourceRegistry.register({ source: "src-list-1" });
            SourceRegistry.register({ source: "src-list-2" });

            const registered = SourceRegistry.getRegistered();

            expect(registered).toContain("src-list-1");
            expect(registered).toContain("src-list-2");
        });
    });

    describe("built-in pre-registrations", () => {
        it("registers YouTube search source and its alias", () => {
            expect(SourceRegistry.resolve(SearchSources.Youtube)).toBe(SearchSources.Youtube);
            expect(SourceRegistry.resolve(SourceNames.Youtube)).toBe(SearchSources.Youtube);
        });

        it("registers Spotify search source and its alias", () => {
            expect(SourceRegistry.resolve(SearchSources.Spotify)).toBe(SearchSources.Spotify);
            expect(SourceRegistry.resolve(SourceNames.Spotify)).toBe(SearchSources.Spotify);
        });

        it("registers FloweryTTS with the double-slash protocol", () => {
            expect(SourceRegistry.createIdentifier(SearchSources.FloweryTTS, "hello")).toBe(`${SearchSources.FloweryTTS}://hello`);
        });

        it("registers HTTP with the raw protocol", () => {
            expect(SourceRegistry.createIdentifier(SearchSources.HTTP, "https://files.example/track.mp3")).toBe(
                "https://files.example/track.mp3",
            );
        });

        it("registers Local with the raw protocol", () => {
            expect(SourceRegistry.createIdentifier(SearchSources.Local, "/path/to/file.mp3")).toBe("/path/to/file.mp3");
        });

        it("isRegistered returns true for every built-in SearchSources member", () => {
            for (const value of Object.values(SearchSources)) {
                expect(SourceRegistry.isRegistered(value)).toBe(true);
            }
        });
    });
});
