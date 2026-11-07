import { afterEach, describe, expect, it, vi } from "vitest";
import { State } from "../../src/types/Node";
import { HttpMethods } from "../../src/types/Rest";
import { createRealManager, createRealNode } from "../helpers";

/**
 * `Node` owns the session guards and the optimistic player-state update; `Rest` is only the transport.
 * `createRealNode` spies `updatePlayer`, `destroyPlayer` and `stopPlayer` so the rest of the suite stays isolated,
 * hence each test restores the one it checks.
 */
const setup = (restore: Array<"updatePlayer" | "destroyPlayer" | "stopPlayer" | "getPlayers"> = []) => {
    const manager = createRealManager();
    const node = createRealNode(manager);
    for (const name of restore) (node[name] as unknown as { mockRestore?: () => void }).mockRestore?.();

    const request = vi.spyOn(node.rest, "request").mockResolvedValue(null);
    return { manager, node, request };
};

describe("Node REST methods", () => {
    afterEach(() => vi.restoreAllMocks());

    describe("updatePlayer", () => {
        it("PATCHes the player with the body and noReplace", async () => {
            const { node, request } = setup(["updatePlayer"]);

            await node.updatePlayer({ guildId: "guild-1", noReplace: true, playerOptions: { paused: true } });

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({
                    endpoint: "/sessions/session-1/players/guild-1",
                    method: HttpMethods.Patch,
                    params: { noReplace: "true" },
                    body: { paused: true },
                }),
            );
        });

        it("defaults noReplace to false", async () => {
            const { node, request } = setup(["updatePlayer"]);

            await node.updatePlayer({ guildId: "guild-1", playerOptions: { volume: 50 } });

            expect(request).toHaveBeenCalledWith(expect.objectContaining({ params: { noReplace: "false" } }));
        });

        it("updates the local player state before sending", async () => {
            const { manager, node, request } = setup(["updatePlayer"]);
            const player = { paused: false, playing: true, volume: 100 };
            vi.spyOn(manager, "getPlayer").mockReturnValue(player as never);
            request.mockImplementation(async () => {
                // by the time the request goes out the local state is already patched
                expect(player).toMatchObject({ paused: true, playing: false, volume: 30 });
                return null;
            });

            await node.updatePlayer({ guildId: "guild-1", playerOptions: { paused: true, volume: 30 } });

            expect(request).toHaveBeenCalledTimes(1);
        });

        it("returns null and sends nothing when there is no session", async () => {
            const { node, request } = setup(["updatePlayer"]);
            node.sessionId = null as never;

            expect(await node.updatePlayer({ guildId: "guild-1", playerOptions: { paused: true } })).toBeNull();
            expect(request).not.toHaveBeenCalled();
        });

        it("returns null and sends nothing when the node is not connected", async () => {
            const { node, request } = setup(["updatePlayer"]);
            node.state = State.Disconnected;

            expect(await node.updatePlayer({ guildId: "guild-1", playerOptions: { paused: true } })).toBeNull();
            expect(request).not.toHaveBeenCalled();
        });
    });

    describe("stopPlayer", () => {
        it("updates the player with an encoded null track", async () => {
            const { node, request } = setup(["updatePlayer", "stopPlayer"]);

            await node.stopPlayer("guild-1");

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({
                    endpoint: "/sessions/session-1/players/guild-1",
                    method: HttpMethods.Patch,
                    body: { paused: false, track: { encoded: null } },
                }),
            );
        });

        it("does nothing when the session is not ready", async () => {
            const { node, request } = setup(["updatePlayer", "stopPlayer"]);
            node.sessionId = null as never;

            expect(await node.stopPlayer("guild-1")).toBeNull();
            expect(request).not.toHaveBeenCalled();
        });
    });

    describe("destroyPlayer", () => {
        it("no-ops when there is no session", async () => {
            const { node, request } = setup(["destroyPlayer"]);
            node.sessionId = null as never;

            await node.destroyPlayer("guild-1");

            expect(request).not.toHaveBeenCalled();
        });

        it("calls DELETE when the session exists", async () => {
            const { node, request } = setup(["destroyPlayer"]);

            await node.destroyPlayer("guild-1");

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: HttpMethods.Delete,
                    endpoint: "/sessions/session-1/players/guild-1",
                }),
            );
        });
    });

    describe("getPlayers", () => {
        it("returns an empty array when there is no session", async () => {
            const { node, request } = setup();
            node.sessionId = null as never;

            expect(await node.getPlayers()).toEqual([]);
            expect(request).not.toHaveBeenCalled();
        });

        it("returns what the node answers, and [] on an empty response", async () => {
            const { node, request } = setup();
            request.mockResolvedValueOnce([{ guildId: "g1" }] as never);

            expect(await node.getPlayers()).toEqual([{ guildId: "g1" }]);
            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({ endpoint: "/sessions/session-1/players", method: HttpMethods.Get }),
            );
            expect(await node.getPlayers()).toEqual([]);
        });
    });

    describe("updateSession", () => {
        it("returns null when there is no session", async () => {
            const { node, request } = setup();
            node.sessionId = null as never;

            expect(await node.updateSession({ resuming: true, timeout: 1000 })).toBeNull();
            expect(request).not.toHaveBeenCalled();
        });

        it("PATCHes the session and stores the answer", async () => {
            const { node, request } = setup();
            request.mockResolvedValueOnce({ resuming: true, timeout: 1000 } as never);

            const session = await node.updateSession({ resuming: true, timeout: 1000 });

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({
                    endpoint: "/sessions/session-1",
                    method: HttpMethods.Patch,
                    body: { resuming: true, timeout: 1000 },
                }),
            );
            expect(session).toEqual({ resuming: true, timeout: 1000 });
            expect(node.session).toEqual({ resuming: true, timeout: 1000 });
        });

        it("keeps the previous session when the node answers nothing", async () => {
            const { node } = setup();
            const before = { ...node.session };

            expect(await node.updateSession({ resuming: false })).toBeNull();
            expect(node.session).toEqual(before);
        });
    });
});
