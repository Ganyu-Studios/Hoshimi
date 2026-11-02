import { describe, expect, it } from "vitest";
import { stringify } from "../../src/util/functions/utils";

describe("stringify", () => {
    it("keeps an object repeated in different branches", () => {
        const requester = { id: "123" };
        const settings = { frequency: 4, depth: 0.8 };

        expect(JSON.parse(stringify([{ requester }, { requester }]))).toEqual([{ requester }, { requester }]);
        expect(JSON.parse(stringify({ tremolo: settings, vibrato: settings }))).toEqual({ tremolo: settings, vibrato: settings });
    });

    it("replaces or omits real cycles", () => {
        const a: Record<string, unknown> = { name: "Ganyu" };
        a.self = a;

        expect(stringify(a)).toBe('{"name":"Ganyu","self":"[Circular]"}');
        expect(stringify(a, { omitCircular: true })).toBe('{"name":"Ganyu"}');
        expect(stringify([a], { circular: "<loop>" })).toBe('[{"name":"Ganyu","self":"<loop>"}]');
    });

    it("serializes Map, Set, Error and BigInt", () => {
        const error = new Error("boom", { cause: "root" });
        const parsed = JSON.parse(stringify({ map: new Map([["k", 1]]), set: new Set([1, 2]), big: 10n, error }));

        expect(parsed.map).toEqual([["k", 1]]);
        expect(parsed.set).toEqual([1, 2]);
        expect(parsed.big).toBe("10n");
        expect(parsed.error).toMatchObject({ name: "Error", message: "boom", cause: "root" });
    });

    it("respects toJSON, the replacer and the space", () => {
        const track = { toJSON: () => ({ encoded: "abc" }) };

        expect(stringify({ track })).toBe('{"track":{"encoded":"abc"}}');
        expect(stringify({ a: 1, b: 2 }, { replacer: (key, value) => (key === "b" ? undefined : value) })).toBe('{"a":1}');
        expect(stringify({ a: 1 }, { space: 2 })).toBe('{\n  "a": 1\n}');
    });
});
