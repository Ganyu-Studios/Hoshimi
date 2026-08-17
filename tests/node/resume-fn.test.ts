import { describe, expect, it, vi } from "vitest";
import { resumeByLibrary as exportedResume } from "../../src";
import { OptionError } from "../../src/classes/Errors";
import type { HoshimiOptions } from "../../src/types/Manager";
import { resumeByLibrary } from "../../src/util/events/player";
import { onMessage } from "../../src/util/events/websocket";
import { Validations } from "../../src/util/functions/validations";
import { createRealManager, createRealNode, createRealPlayer } from "../helpers";

const ready = (sessionId: string, resumed = false): string => JSON.stringify({ op: "ready", sessionId, resumed });

describe("sessionOptions.resumeFn", () => {
    it("defaults to the built-in resumeByLibrary", () => {
        const manager = createRealManager();

        expect(manager.options.nodeOptions.sessionOptions.resumeFn).toBe(resumeByLibrary);
        // And it is the same function the package exports.
        expect(exportedResume).toBe(resumeByLibrary);
    });

    it("keeps a custom handler over the default", () => {
        const custom = vi.fn();
        const manager = createRealManager({ nodeOptions: { sessionOptions: { resumeFn: custom } } } as never);

        expect(manager.options.nodeOptions.sessionOptions.resumeFn).toBe(custom);
    });

    it("runs the handler on a fresh ready when byLibrary is on", async () => {
        const custom = vi.fn().mockResolvedValue(undefined);
        const manager = createRealManager({ nodeOptions: { sessionOptions: { byLibrary: true, resumeFn: custom } } } as never);
        const node = createRealNode(manager);
        const player = createRealPlayer(manager);

        await onMessage.call(node, ready("session-1"));

        expect(custom).toHaveBeenCalledTimes(1);
        expect(custom).toHaveBeenCalledWith(node, [player]);
    });

    it("does not run when byLibrary is off", async () => {
        const custom = vi.fn().mockResolvedValue(undefined);
        const manager = createRealManager({ nodeOptions: { sessionOptions: { byLibrary: false, resumeFn: custom } } } as never);
        const node = createRealNode(manager);
        createRealPlayer(manager);

        await onMessage.call(node, ready("session-1"));

        expect(custom).not.toHaveBeenCalled();
    });

    it("does not run on a resumed session", async () => {
        const custom = vi.fn().mockResolvedValue(undefined);
        const manager = createRealManager({ nodeOptions: { sessionOptions: { byLibrary: true, resumeFn: custom } } } as never);
        const node = createRealNode(manager);
        vi.spyOn(node.rest, "getPlayers").mockResolvedValue([]);
        createRealPlayer(manager);

        await onMessage.call(node, ready("session-1", true));

        expect(custom).not.toHaveBeenCalled();
    });

    it("rejects a resumeFn that is not a function", () => {
        const base: HoshimiOptions = {
            sendPayload: () => {},
            nodes: [],
            nodeOptions: { sessionOptions: { resumeFn: "nope" as never } },
        } as never;

        expect(() => Validations.validateManagerOptions(base)).toThrow(OptionError);
    });
});
