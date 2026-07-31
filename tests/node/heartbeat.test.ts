import { afterEach, describe, expect, it, vi } from "vitest";

import { clearHeartbeatTimer, onPong, startHeartbeat } from "../../src/util/events/websocket";

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
