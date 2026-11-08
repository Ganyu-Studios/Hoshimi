import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createRoute } from "../src/classes/node/Route";
import type {
    LavalinkPlayer,
    LavalinkRawRoutes,
    LavalinkRoutes,
    LavalinkSession,
    LavalinkTrack,
    RestOptions,
    RouteArgs,
    RouteQueryArgs,
} from "../src/index";
import { HttpMethods } from "../src/index";

// Same thing a plugin author would write in their project: `declare module "hoshimi"`.
declare module "../src/index" {
    interface LavalinkRoutes {
        loadsearch: {
            get(args: RouteQueryArgs<{ query: string; types?: string }>): Promise<{ tracks: string[] } | null>;
        };
    }

    interface LavalinkPlayerRoutes {
        sponsorblock: {
            get(args?: RouteArgs): Promise<string[] | null>;
            put(args: { body: { categories: string[] } }): Promise<null>;
        };
    }
}

const setup = () => {
    const send = vi.fn(async (_: RestOptions) => null);
    return { send, route: createRoute<LavalinkRoutes>(send as never) };
};

describe("Route runtime", () => {
    it("builds the endpoint from segments and calls, encoding values", async () => {
        const { route, send } = setup();
        await route.sessions("abc").players("g/1").get();
        expect(send).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "/sessions/abc/players/g%2F1", method: HttpMethods.Get }));
    });

    it("stringifies the query, keeping false/0 and dropping undefined/null", async () => {
        const { route, send } = setup();
        await route.loadtracks.get({ query: { identifier: "ytsearch:faded" } });
        await route
            .sessions("s")
            .players("g")
            .patch({ body: { paused: true }, query: { noReplace: false } });
        expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({ params: { identifier: "ytsearch:faded" } }));
        expect(send).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ method: "PATCH", params: { noReplace: "false" }, body: { paused: true } }),
        );
    });

    it("sends arrays as body and never mutates a parent route", async () => {
        const { route, send } = setup();
        await route.decodetracks.post({ body: ["a", "b"] });
        const player = route.sessions("s").players("g");
        await player.get();
        await player.delete();
        expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({ body: ["a", "b"] }));
        expect(send).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ endpoint: "/sessions/s/players/g", method: "GET", body: undefined }),
        );
        expect(send).toHaveBeenNthCalledWith(3, expect.objectContaining({ endpoint: "/sessions/s/players/g", method: "DELETE" }));
    });

    it("passes per-request headers and is safe to await", async () => {
        const { route, send } = setup();
        await route.info.get({ headers: { "X-Test": "1" } });
        expect(send).toHaveBeenCalledWith(expect.objectContaining({ headers: { "X-Test": "1" } }));
        expect(await Promise.resolve(route.sessions)).toBeDefined();
    });

    it("works for augmented routes with no runtime changes", async () => {
        const { route, send } = setup();
        await route.loadsearch.get({ query: { query: "faded", types: "track" } });
        await route
            .sessions("s")
            .players("g")
            .sponsorblock.put({ body: { categories: ["sponsor"] } });
        expect(send).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ endpoint: "/loadsearch", params: { query: "faded", types: "track" } }),
        );
        expect(send).toHaveBeenNthCalledWith(2, expect.objectContaining({ endpoint: "/sessions/s/players/g/sponsorblock", method: "PUT" }));
    });

    it("reads as its endpoint in strings, logs and JSON", () => {
        const { route } = setup();
        const players = route.sessions("abc").players;

        expect(String(players)).toBe("/sessions/abc/players");
        expect(`${players}`).toBe("/sessions/abc/players");
        expect(JSON.stringify({ route: players })).toBe('{"route":"/sessions/abc/players"}');
        expect(String(route)).toBe("/");
    });

    it("reaches a segment named like a method by calling with it", async () => {
        const { route, send } = setup();
        const plugin = route as unknown as Record<string, (segment: string) => { post(): Promise<null> }>;

        await plugin.custom!("delete").post();

        expect(send).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "/custom/delete", method: "POST" }));
    });
});

describe("Route types", () => {
    it("infers the response of each route", () => {
        const { route } = setup();
        expectTypeOf(route.sessions("s").players.get).returns.resolves.toEqualTypeOf<LavalinkPlayer[] | null>();
        expectTypeOf(route.sessions("s").players("g").get).returns.resolves.toEqualTypeOf<LavalinkPlayer | null>();
        expectTypeOf(route.sessions("s").patch).returns.resolves.toEqualTypeOf<LavalinkSession | null>();
        expectTypeOf(route.decodetrack.get).returns.resolves.toEqualTypeOf<LavalinkTrack | null>();
        expectTypeOf(route.loadsearch.get).returns.resolves.toEqualTypeOf<{ tracks: string[] } | null>();
        expectTypeOf(createRoute<LavalinkRawRoutes>(vi.fn() as never).version.get).returns.resolves.toEqualTypeOf<string | null>();
    });

    it("rejects wrong routes, queries and bodies", () => {
        const { route } = setup();

        // @ts-expect-error typo in a segment
        route.sesions;
        // @ts-expect-error identifier is required
        route.loadtracks.get();
        // @ts-expect-error unknown query key
        route.loadtracks.get({ query: { identifier: "x", nope: 1 } });
        // @ts-expect-error body is required on patch
        route.sessions("s").players("g").patch({});
        const player = route.sessions("s").players("g");
        // @ts-expect-error wrong body field type
        player.patch({ body: { paused: "yes" } });
        // @ts-expect-error players(guildId) takes a string
        route.sessions("s").players(1);
        // @ts-expect-error decodetracks only has post
        route.decodetracks.get;
    });
});
