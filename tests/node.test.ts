import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ws", () => {
    class MockWS {
        static OPEN = 1;
        static CONNECTING = 0;
        static instances: MockWS[] = [];

        public readyState = MockWS.CONNECTING;
        public listeners: Record<string, Array<(...args: unknown[]) => unknown>> = {};
        public closedWith: { code?: number; reason?: string } = {};
        public url: string;
        public options: unknown;

        constructor(url: string, options?: unknown) {
            this.url = url;
            this.options = options;
            MockWS.instances.push(this);
        }

        on(event: string, handler: (...args: unknown[]) => unknown): this {
            this.listeners[event] ??= [];
            this.listeners[event].push(handler);
            return this;
        }

        close(code?: number, reason?: string): void {
            this.closedWith = { code, reason };
        }

        removeAllListeners(): void {
            this.listeners = {};
        }
    }

    return { WebSocket: MockWS };
});

import { WebSocket } from "ws";
import { NodeError, OptionError } from "../src/classes/Errors";
import { LyricsManager } from "../src/classes/node/Lyrics";
import { Node } from "../src/classes/node/Node";
import { EventNames, SearchSources } from "../src/types/Manager";
import { NodeDestroyReasons, PluginNames, State, WebsocketCloseCodes } from "../src/types/Node";
import { HttpMethods, RestRoutes } from "../src/types/Rest";

function createNode(client?: { id?: string; username?: string }) {
    const emit = vi.fn();
    const nodeManager = {
        manager: {
            emit,
            options: {
                client,
                defaultSearchSource: SearchSources.Youtube,
                playerOptions: {
                    requesterFn: <T>(requester: unknown) => requester as T,
                },
                nodeOptions: {
                    userAgent: "hoshimi-test/v1 (https://example.com)",
                    resumable: false,
                    resumeTimeout: 120,
                    resumeByLibrary: false,
                },
                restOptions: {
                    resumeTimeout: 120,
                },
            },
        },
        delete: vi.fn(),
    };

    const node = new Node(nodeManager as never, {
        host: "localhost",
        port: 2333,
        password: "pass",
        id: "node-1",
        retryAmount: 2,
        retryDelay: 50,
    });

    return { node, nodeManager, emit };
}

function createLyricsNode(
    sessionId: string | null = "session-1",
    plugins: string[] = [PluginNames.LavaLyrics, PluginNames.JavaLyrics, PluginNames.LavaSrc],
) {
    const request = vi.fn().mockResolvedValue({ lines: [] });

    const node = {
        id: "node-1",
        sessionId,
        rest: { request },
        info: {
            plugins: plugins.map((name) => ({ name })),
            filters: [],
            isNodelink: false,
        },
        isNodelink: () => false,
        nodeManager: {
            manager: {
                emit: vi.fn(),
            },
        },
    };

    return { node, request };
}

describe("Node", () => {
    beforeEach(() => {
        (WebSocket as unknown as { instances: unknown[] }).instances = [];
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("builds secure address using port 443", () => {
        const { node } = createNode({ id: "1", username: "bot" });
        const secureNode = new Node(node.nodeManager, {
            host: "example.com",
            port: 2333,
            password: "pass",
            secure: true,
            id: "secure-1",
        });

        expect(secureNode.options.port).toBe(443);
        expect(secureNode.address).toBe("wss://example.com:443/v4/websocket");
    });

    it("throws when connect is called without client data", () => {
        const { node } = createNode(undefined);

        expect(() => node.connect()).toThrow("No valid client data provided.");
    });

    it("throws when connect is called without client id", () => {
        const { node } = createNode({ username: "bot" });

        expect(() => node.connect()).toThrow("No valid client id provided.");
    });

    it("connect creates websocket and registers handlers", () => {
        const { node } = createNode({ id: "123", username: "bot" });

        node.connect();

        const instances = WebSocket as unknown as { instances: Array<Record<string, unknown>> };
        const ws = instances.instances[0];

        expect(node.state).toBe(State.Connecting);
        expect(ws.url).toBe("ws://localhost:2333/v4/websocket");
        expect(Object.keys(ws.listeners as Record<string, unknown>)).toEqual(
            expect.arrayContaining(["upgrade", "close", "error", "message"]),
        );

        const headers = (ws.options as { headers: Record<string, string> }).headers;
        expect(headers.Authorization).toBe("pass");
        expect(headers["User-Id"]).toBe("123");
        expect(headers["Client-Name"]).toBe("bot");
        expect(headers["User-Agent"]).toContain("hoshimi-test");
    });

    it("connect is a no-op when node is already connected", () => {
        const { node } = createNode({ id: "123", username: "bot" });
        node.state = State.Connected;

        node.connect();

        const instances = WebSocket as unknown as { instances: unknown[] };
        expect(instances.instances.length).toBe(0);
    });

    it("ready getter reflects websocket OPEN state", () => {
        const { node } = createNode({ id: "123", username: "bot" });

        node.connect();

        const instances = WebSocket as unknown as { OPEN: number; instances: Array<{ readyState: number }> };
        instances.instances[0].readyState = instances.OPEN;

        expect(node.ready).toBe(true);
    });

    it("penalties returns 0 without stats and computes value with stats", () => {
        const { node } = createNode({ id: "123", username: "bot" });

        expect(node.penalties).toBe(0);

        node.stats = {
            players: 2,
            playingPlayers: 1,
            uptime: 10,
            memory: { free: 1, used: 1, allocated: 2, reservable: 3 },
            cpu: { cores: 1, systemLoad: 0.1, lavalinkLoad: 0.1 },
            frameStats: { sent: 0, nulled: 2, deficit: 3 },
        } as never;

        const cpuPenalty = Math.round(1.05 ** (100 * 0.1) * 10 - 10);
        const framePenalty = 3 + 2 * 2;

        expect(node.penalties).toBe(2 + cpuPenalty + framePenalty);
    });

    it("search builds identifier and delegates request to rest", async () => {
        const { node } = createNode({ id: "123", username: "bot" });
        const requestSpy = vi.spyOn(node.rest, "request").mockResolvedValue(null);

        await node.search({ query: "hello world", source: SearchSources.Youtube });

        expect(requestSpy).toHaveBeenCalledWith({
            endpoint: RestRoutes.LoadTracks,
            params: {
                identifier: "ytsearch:hello world",
            },
        });
    });

    it("search throws OptionError for invalid source", async () => {
        const { node } = createNode({ id: "123", username: "bot" });

        expect(() => node.search({ query: "hello", source: "invalid-source" as never })).toThrow(OptionError);
    });

    it("disconnect closes websocket, clears listeners and emits event", () => {
        const { node, emit } = createNode({ id: "123", username: "bot" });

        node.connect();
        node.disconnect({ code: 1000, reason: "bye" });

        const instances = WebSocket as unknown as { instances: Array<{ closedWith: { code?: number; reason?: string } }> };
        const ws = instances.instances[0];

        expect(ws.closedWith).toEqual({ code: 1000, reason: "bye" });
        expect(node.ws).toBeNull();
        expect(node.state).toBe(State.Disconnected);
        expect(emit).toHaveBeenCalledWith(EventNames.NodeDisconnect, node);
    });

    it("destroy closes websocket, emits event and deletes from manager", () => {
        const { node, emit, nodeManager } = createNode({ id: "123", username: "bot" });

        node.connect();
        node.destroy({ code: 4000, reason: "destroy-test" });

        expect(node.ws).toBeNull();
        expect(node.state).toBe(State.Destroyed);
        expect(node.retryAmount).toBe(0);
        expect(emit).toHaveBeenCalledWith(EventNames.NodeDestroy, node, { code: 4000, reason: "destroy-test" });
        expect(nodeManager.delete).toHaveBeenCalledWith("node-1");
    });

    it("reconnect retries and calls connect when retries remain", () => {
        vi.useFakeTimers();

        const { node, emit } = createNode({ id: "123", username: "bot" });
        node.state = State.Connected;
        node.ws = { removeAllListeners: vi.fn() } as never;

        const connectSpy = vi.spyOn(node, "connect").mockImplementation(() => undefined);

        node.reconnect();

        expect(emit).toHaveBeenCalledWith(EventNames.NodeReconnecting, node, 2, 50);

        vi.advanceTimersByTime(60);

        expect(node.retryAmount).toBe(1);
        expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it("reconnect emits error and destroys when retries are exhausted", () => {
        vi.useFakeTimers();

        const { node, emit } = createNode({ id: "123", username: "bot" });
        node.state = State.Connected;
        node.retryAmount = 0;

        const destroySpy = vi.spyOn(node, "destroy").mockImplementation(() => undefined);

        node.reconnect();
        vi.advanceTimersByTime(60);

        expect(destroySpy).toHaveBeenCalledWith({
            code: WebsocketCloseCodes.NormalClosure,
            reason: NodeDestroyReasons.Destroy,
        });
        expect(emit).toHaveBeenCalledWith(EventNames.NodeError, node, expect.any(Error));
    });
});

describe("LyricsManager", () => {
    it("current returns null when there is no session", async () => {
        const { node, request } = createLyricsNode(null);
        const manager = new LyricsManager(node as never);

        const result = await manager.current("guild-1");

        expect(result).toBeNull();
        expect(request).not.toHaveBeenCalled();
    });

    it("current requests current lyrics with params", async () => {
        const { node, request } = createLyricsNode("sess-1");
        const manager = new LyricsManager(node as never);

        await manager.current("guild-1", true);

        expect(request).toHaveBeenCalledWith({
            endpoint: RestRoutes.CurrentLyrics("sess-1", "guild-1"),
            params: { skipTrackSource: "true" },
        });
    });

    it("get requests track lyrics", async () => {
        const { node, request } = createLyricsNode("sess-1");
        const manager = new LyricsManager(node as never);

        await manager.get({ encoded: "abc" } as never, false);

        expect(request).toHaveBeenCalledWith({
            endpoint: RestRoutes.GetLyrics,
            params: {
                track: "abc",
                skipTrackSource: "false",
            },
        });
    });

    it("subscribe and unsubscribe call expected REST endpoints", async () => {
        const { node, request } = createLyricsNode("sess-1");
        const manager = new LyricsManager(node as never);

        await manager.subscribe("guild-1", true);
        await manager.unsubscribe("guild-1");

        expect(request).toHaveBeenNthCalledWith(1, {
            endpoint: RestRoutes.SubscribeLyrics("sess-1", "guild-1"),
            method: HttpMethods.Post,
            params: { skipTrackSource: "true" },
        });
        expect(request).toHaveBeenNthCalledWith(2, {
            endpoint: RestRoutes.SubscribeLyrics("sess-1", "guild-1"),
            method: HttpMethods.Delete,
        });
    });

    it("throws NodeError when required plugins are missing", async () => {
        const { node } = createLyricsNode("sess-1", []);
        const manager = new LyricsManager(node as never);

        await expect(manager.current("guild-1")).rejects.toThrow(NodeError);
    });
});
