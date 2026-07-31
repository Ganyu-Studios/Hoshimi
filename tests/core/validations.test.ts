import { describe, expect, it } from "vitest";

import { OptionError } from "../../src/classes/Errors";
import { type HoshimiOptions, SearchSources } from "../../src/types/Manager";
import type { NodeOptions } from "../../src/types/Node";
import { Validations } from "../../src/util/functions/validations";

function createOptions(): HoshimiOptions {
    return {
        sendPayload: () => {},
        nodes: [{ host: "localhost", port: 2333, password: "pass" }],
    };
}

describe("Validations.validateQuery", () => {
    it("keeps a full URL untouched", () => {
        expect(Validations.validateQuery({ query: "http://files.example/track.mp3", source: SearchSources.Youtube })).toBe(
            "http://files.example/track.mp3",
        );
        expect(Validations.validateQuery({ query: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", source: SearchSources.Youtube })).toBe(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        );
    });

    it("builds an identifier for free text using the given source", () => {
        expect(Validations.validateQuery({ query: "  never gonna give you up  ", source: SearchSources.Youtube })).toBe(
            "ytsearch:never gonna give you up",
        );
    });

    it("honours an explicit source prefix over the given source", () => {
        expect(Validations.validateQuery({ query: "scsearch:some song", source: SearchSources.Youtube })).toBe("scsearch:some song");
    });

    it("unwraps a URL placed behind a source prefix", () => {
        expect(Validations.validateQuery({ query: "spsearch:https://open.spotify.com/track/abc", source: SearchSources.Youtube })).toBe(
            "https://open.spotify.com/track/abc",
        );
    });
});

describe("Validations.validateManagerOptions", () => {
    it("rejects numeric manager options that are not non-negative integers", () => {
        const cases: Partial<HoshimiOptions>[] = [
            { queueOptions: { maxHistory: Number.NaN } },
            { queueOptions: { maxHistory: -1 } },
            { restOptions: { restTimeout: Number.NaN } },
            { restOptions: { resumeTimeout: 1.5 } },
            { nodeOptions: { heartbeatOptions: { interval: Number.NaN } } },
            { nodeOptions: { sessionOptions: { timeout: Number.POSITIVE_INFINITY } } },
        ];

        for (const override of cases) {
            expect(() => Validations.validateManagerOptions({ ...createOptions(), ...override })).toThrow(OptionError);
        }
    });

    it("rejects numeric node options that are not non-negative integers", () => {
        const nodes: NodeOptions[] = [
            { host: "localhost", port: 0, password: "pass" },
            { host: "localhost", port: 70000, password: "pass" },
            { host: "localhost", port: 2333.5, password: "pass" },
            { host: "localhost", port: Number.NaN, password: "pass" },
            { host: "localhost", port: 2333, password: "pass", retryAmount: Number.NaN },
            { host: "localhost", port: 2333, password: "pass", retryDelay: -1 },
            { host: "localhost", port: 2333, password: "pass", restTimeout: Number.POSITIVE_INFINITY },
            { host: "localhost", port: 2333, password: "pass", heartbeat: { interval: Number.NaN } },
        ];

        for (const node of nodes) {
            expect(() => Validations.validateManagerOptions({ ...createOptions(), nodes: [node] })).toThrow(OptionError);
        }
    });

    it("accepts valid numeric options", () => {
        expect(() =>
            Validations.validateManagerOptions({
                ...createOptions(),
                nodes: [{ host: "localhost", port: 443, password: "pass", retryAmount: 0, retryDelay: 20000 }],
                queueOptions: { maxHistory: 0 },
                restOptions: { restTimeout: 5000, resumeTimeout: 10000 },
                nodeOptions: {
                    sessionOptions: { timeout: 60 },
                    heartbeatOptions: { interval: 0 },
                },
            }),
        ).not.toThrow();
    });
});

describe("Validations.validatePlayerOptions", () => {
    it("rejects a non-finite or negative volume", () => {
        for (const volume of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
            expect(() => Validations.validatePlayerOptions({ guildId: "guild-1", voiceId: "voice-1", volume })).toThrow(OptionError);
        }
    });

    it("accepts a fractional volume, since setVolume rounds it", () => {
        expect(() => Validations.validatePlayerOptions({ guildId: "guild-1", voiceId: "voice-1", volume: 50.5 })).not.toThrow();
    });
});
