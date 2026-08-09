import { describe, expect, it, vi } from "vitest";
import { State } from "../../src/types/Node";
import { HoshimiDefaultOptions } from "../../src/util/constants";
import { toHeaderValue } from "../../src/util/functions/utils";
import { createRealManager } from "../helpers";

/**
 * `Client-Name` carries the bot's name exactly as Discord hands it over, so it can hold an emoji, a
 * non-latin script or a line break. Node rejects all of those with `ERR_INVALID_CHAR` from the
 * WebSocket constructor, which took the node down and — because the state had already been moved to
 * `Connecting` — left it there, silently ignoring every later attempt.
 */
describe("Header sanitisation", () => {
    it("keeps what a header may carry", () => {
        expect(toHeaderValue("Stelle", "fallback")).toBe("Stelle");
        expect(toHeaderValue("Ganyu Studios", "fallback")).toBe("Ganyu Studios");
        expect(toHeaderValue("hoshimi/v0.5.2 (https://example.com)", "fallback")).toBe("hoshimi/v0.5.2 (https://example.com)");
    });

    it("drops what it may not", () => {
        expect(toHeaderValue("Stelle 🌟", "fallback")).toBe("Stelle");
        expect(toHeaderValue("Sténle", "fallback")).toBe("Stnle");
        expect(toHeaderValue("Ste\nlle", "fallback")).toBe("Stelle");
        expect(toHeaderValue("Ste\rlle", "fallback")).toBe("Stelle");
    });

    it("falls back when nothing printable is left", () => {
        expect(toHeaderValue("星見", "hoshimi-client")).toBe("hoshimi-client");
        expect(toHeaderValue("🌟", "hoshimi-client")).toBe("hoshimi-client");
        expect(toHeaderValue("   ", "hoshimi-client")).toBe("hoshimi-client");
    });

    it("connects with a username node would have rejected", () => {
        const manager = createRealManager();
        manager.options.client = { id: "123456789", username: "Stelle 🌟" };

        const node = manager.nodeManager.create({
            host: "127.0.0.1",
            port: 1,
            password: "pass",
            id: "emoji",
            retryAmount: 0,
        });

        expect(() => node.connect()).not.toThrow();
        expect(node.ws).not.toBeNull();

        node.ws?.on("error", () => {});
        node.ws?.terminate();
    });

    it("sends the fallback when the name has nothing usable", () => {
        const manager = createRealManager();
        manager.options.client = { id: "123456789", username: "星見" };

        const node = manager.nodeManager.create({
            host: "127.0.0.1",
            port: 1,
            password: "pass",
            id: "cjk",
            retryAmount: 0,
        });

        node.connect();

        // The request `ws` built is where the header actually landed, so this reads what would go
        // out on the wire rather than what we meant to send.
        const request = (node.ws as unknown as { _req: { getHeader(name: string): string } })._req;

        expect(request.getHeader("client-name")).toBe(HoshimiDefaultOptions.client.username);
        expect(request.getHeader("user-id")).toBe("123456789");

        node.ws?.on("error", () => {});
        node.ws?.terminate();
    });

    it("leaves the state alone when the socket cannot be built", () => {
        const manager = createRealManager();
        manager.options.client = { id: "123456789", username: "Stelle" };

        const node = manager.nodeManager.create({
            host: "127.0.0.1",
            port: 1,
            password: "pass",
            id: "bad-address",
            retryAmount: 0,
        });

        // An address the WebSocket constructor refuses, standing in for anything that throws there.
        vi.spyOn(node, "address", "get").mockReturnValue("not-a-valid-url");

        const before: State = node.state;

        expect(() => node.connect()).toThrow();
        // Without the restore this stays on `Connecting`, and `connect` returns early on that
        // forever after, so the node would never reconnect.
        expect(node.state).toBe(before);
        expect(node.state).not.toBe(State.Connecting);
    });
});
