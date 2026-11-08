import { afterEach, describe, expect, it, vi } from "vitest";

import { NodeDestroyReasons, WebsocketCloseCodes } from "../../src/types/Node";
import { clearHeartbeatTimer, onClose, onPong, startHeartbeat } from "../../src/util/events/websocket";

function createFakeNode(interval: number = 30000) {
    const ws = { readyState: 1, terminate: vi.fn(), ping: vi.fn() };

    const node = {
        id: "node-1",
        ws,
        isAlive: true,
        heartbeatInterval: null as NodeJS.Timeout | null,
        options: { heartbeat: { interval } },
        nodeManager: { manager: { debug: vi.fn() } },
    };

    return { node, ws };
}

describe("heartbeat ping/pong", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("pings on every interval and terminates when no pong answers", () => {
        vi.useFakeTimers();
        const { node, ws } = createFakeNode(1000);

        startHeartbeat.call(node as never);

        vi.advanceTimersByTime(1000);
        expect(ws.ping).toHaveBeenCalledTimes(1);
        expect(node.isAlive).toBe(false);

        onPong.call(node as never);
        expect(node.isAlive).toBe(true);

        vi.advanceTimersByTime(1000);
        expect(ws.ping).toHaveBeenCalledTimes(2);

        vi.advanceTimersByTime(1000);
        expect(ws.terminate).toHaveBeenCalledTimes(1);
    });

    it("stays disabled when the interval is 0", () => {
        vi.useFakeTimers();
        const { node, ws } = createFakeNode(0);

        startHeartbeat.call(node as never);

        expect(node.heartbeatInterval).toBeNull();

        vi.advanceTimersByTime(600000);
        expect(ws.ping).not.toHaveBeenCalled();
    });

    it("clearHeartbeatTimer stops the interval", () => {
        vi.useFakeTimers();
        const { node, ws } = createFakeNode(1000);

        startHeartbeat.call(node as never);
        expect(node.heartbeatInterval).not.toBeNull();

        clearHeartbeatTimer.call(node as never);
        expect(node.heartbeatInterval).toBeNull();

        vi.advanceTimersByTime(10000);
        expect(ws.ping).not.toHaveBeenCalled();
        expect(ws.terminate).not.toHaveBeenCalled();
    });
});

describe("onClose", () => {
    function createClosingNode() {
        const node = {
            id: "node-1",
            address: "ws://localhost:2333/v4/websocket",
            heartbeatInterval: null,
            sessionId: "session-1",
            state: "CONNECTED",
            reconnect: vi.fn(),
            nodeManager: {
                nodes: { has: () => true },
                manager: { debug: vi.fn(), emit: vi.fn(), options: { nodeOptions: { moveOptions: { move: false } } } },
            },
        };

        return node;
    }

    it("does not reconnect on a destroy close, with the reason as the Buffer ws gives", async () => {
        const node = createClosingNode();

        await onClose.call(node as never, WebsocketCloseCodes.NormalClosure, Buffer.from(NodeDestroyReasons.Destroy));

        expect(node.reconnect).not.toHaveBeenCalled();
    });

    it("reconnects on any other close", async () => {
        const node = createClosingNode();

        await onClose.call(node as never, WebsocketCloseCodes.AbnormalClosure, Buffer.from(""));

        expect(node.reconnect).toHaveBeenCalledOnce();
    });
});
