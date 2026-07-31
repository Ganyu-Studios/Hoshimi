import { afterEach, describe, expect, it, vi } from "vitest";
import { RestError } from "../../src/classes/Errors";
import { Rest } from "../../src/classes/node/Rest";
import { HttpMethods, HttpStatusCodes, RestPathType, RestRoutes } from "../../src/types/Rest";
import { createRealManager, createRealNode } from "../helpers";

describe("Rest", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("builds base url and exposes restUrl/sessionId", () => {
        const manager = createRealManager({ nodeOptions: { userAgent: "hoshimi-test/v1 (https://example.com)" } } as never);
        const node = createRealNode(manager);
        node.sessionId = "sess-123";
        const rest = new Rest(node as never);

        expect(rest.restUrl).toBe("http://localhost:2333");
        expect(rest.sessionId).toBe("sess-123");
    });

    it("request performs GET and appends params + trace", async () => {
        const manager = createRealManager({ nodeOptions: { userAgent: "hoshimi-test/v1 (https://example.com)" } } as never);
        const node = createRealNode(manager);
        node.sessionId = "sess-123";
        const rest = new Rest(node as never);

        (node.rest.request as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.updatePlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.destroyPlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.stopPlayer as ReturnType<typeof vi.fn>).mockRestore();

        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            status: HttpStatusCodes.OK,
            json: vi.fn().mockResolvedValue({ ok: true }),
        } as never);
        vi.stubGlobal("fetch", fetchSpy);

        const result = await rest.request<{ ok: boolean }>({
            endpoint: RestRoutes.LoadTracks,
            params: { identifier: "ytsearch:test" },
        });

        expect(result).toEqual({ ok: true });
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const [url, opts] = fetchSpy.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];

        expect(url).toContain("/v4/loadtracks");
        expect(url).toContain("identifier=ytsearch%3Atest");
        expect(url).toContain("trace=true");
        expect(opts.method).toBe(HttpMethods.Get);
        expect(opts.headers.Authorization).toBe("pass");
        expect(opts.headers["User-Agent"]).toContain("hoshimi-test");
    });

    it("request censors the password in the debug log", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = "sess-123";
        const rest = new Rest(node as never);

        (node.rest.request as ReturnType<typeof vi.fn>).mockRestore();

        const debugSpy = vi.spyOn(manager, "debug");

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: HttpStatusCodes.OK,
                json: vi.fn().mockResolvedValue({}),
            } as never),
        );

        await rest.request({ endpoint: RestRoutes.NodeInfo });

        const logged = debugSpy.mock.calls.map(([, message]) => message).join("\n");

        expect(logged).toContain("Headers:");
        expect(logged).not.toContain("pass");
        expect(logged).toContain('"Authorization":"****"');
    });

    it("request sends POST body as string", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = "sess-123";
        const rest = new Rest(node as never);

        (node.rest.request as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.updatePlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.destroyPlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.stopPlayer as ReturnType<typeof vi.fn>).mockRestore();

        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            status: HttpStatusCodes.OK,
            json: vi.fn().mockResolvedValue({ done: true }),
        } as never);
        vi.stubGlobal("fetch", fetchSpy);

        await rest.request({
            endpoint: RestRoutes.DecodeTracks,
            method: HttpMethods.Post,
            body: { tracks: ["a", "b"] },
            pathType: RestPathType.V4,
        });

        const [, opts] = fetchSpy.mock.calls[0] as [string, { body?: string }];
        expect(opts.body).toBe('{"tracks":["a","b"]}');
    });

    it("request returns null on NoContent", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = "sess-123";
        const rest = new Rest(node as never);

        (node.rest.request as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.updatePlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.destroyPlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.stopPlayer as ReturnType<typeof vi.fn>).mockRestore();

        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            status: HttpStatusCodes.NoContent,
            json: vi.fn(),
        });
        vi.stubGlobal("fetch", fetchSpy);

        const result = await rest.request({ endpoint: RestRoutes.NodeInfo });

        expect(result).toBeNull();
    });

    it("request throws RestError when response is not ok", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = "sess-123";
        const rest = new Rest(node as never);

        (node.rest.request as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.updatePlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.destroyPlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.stopPlayer as ReturnType<typeof vi.fn>).mockRestore();

        const fetchSpy = vi.fn().mockResolvedValue({
            ok: false,
            status: HttpStatusCodes.BadRequest,
            json: vi.fn().mockResolvedValue({
                timestamp: 1,
                status: 400,
                error: "Bad Request",
                message: "invalid",
                path: RestRoutes.NodeInfo,
            }),
        } as never);
        vi.stubGlobal("fetch", fetchSpy);

        await expect(rest.request({ endpoint: RestRoutes.NodeInfo })).rejects.toThrow(RestError);
    });

    it("request throws fallback RestError when error payload cannot be parsed", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = "sess-123";
        const rest = new Rest(node as never);

        (node.rest.request as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.updatePlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.destroyPlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.stopPlayer as ReturnType<typeof vi.fn>).mockRestore();

        const fetchSpy = vi.fn().mockResolvedValue({
            ok: false,
            status: HttpStatusCodes.InternalServerError,
            json: vi.fn().mockRejectedValue(new Error("invalid json")),
        } as never);
        vi.stubGlobal("fetch", fetchSpy);

        await expect(rest.request({ endpoint: RestRoutes.NodeInfo })).rejects.toThrow(RestError);
    });

    it("request propagates fetch rejection", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = "sess-123";
        const rest = new Rest(node as never);

        (node.rest.request as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.updatePlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.destroyPlayer as ReturnType<typeof vi.fn>).mockRestore();
        (node.rest.stopPlayer as ReturnType<typeof vi.fn>).mockRestore();

        const fetchSpy = vi.fn().mockRejectedValue(new Error("network down"));
        vi.stubGlobal("fetch", fetchSpy);

        await expect(rest.request({ endpoint: RestRoutes.NodeInfo })).rejects.toThrow("network down");
    });

    it("updatePlayer returns null when there is no session", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = null as never;
        const rest = new Rest(node as never);

        const result = await rest.updatePlayer({ guildId: "guild-1", playerOptions: { paused: true } });

        expect(result).toBeNull();
    });

    it("stopPlayer delegates to updatePlayer with encoded null", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = "sess-123";
        const rest = new Rest(node as never);

        const updateSpy = vi.spyOn(rest, "updatePlayer").mockResolvedValue(null);

        await rest.stopPlayer("guild-1");

        expect(updateSpy).toHaveBeenCalledWith({
            guildId: "guild-1",
            playerOptions: {
                paused: false,
                track: { encoded: null },
            },
        });
    });

    it("destroyPlayer no-ops when there is no session", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = null as never;
        const rest = new Rest(node as never);

        const reqSpy = vi.spyOn(rest, "request").mockResolvedValue(null);

        await rest.destroyPlayer("guild-1");

        expect(reqSpy).not.toHaveBeenCalled();
    });

    it("destroyPlayer calls DELETE endpoint when session exists", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = "sess-123";
        const rest = new Rest(node as never);

        const reqSpy = vi.spyOn(rest, "request").mockResolvedValue(null);

        await rest.destroyPlayer("guild-1");

        expect(reqSpy).toHaveBeenCalledWith({
            method: HttpMethods.Delete,
            endpoint: RestRoutes.UpdatePlayer("sess-123", "guild-1"),
        });
    });

    it("getPlayers returns empty array when there is no session", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = null as never;
        const rest = new Rest(node as never);

        const result = await rest.getPlayers();

        expect(result).toEqual([]);
    });

    it("updateSession returns null when there is no session", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        node.sessionId = null as never;
        const rest = new Rest(node as never);

        const result = await rest.updateSession({ resuming: true, timeout: 1000 });

        expect(result).toBeNull();
    });
});
