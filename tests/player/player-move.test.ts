import { describe, expect, it, vi } from "vitest";
import { createRealManager, createRealNode, createRealPlayer } from "../helpers";

/**
 * Player.move() sets `internal_nodeChange` while it migrates and is supposed
 * to clear it at the end. If anything mid-move throws, the flag used to stay
 * set forever, and the track end handlers ignore the player while it is set
 * — so the queue stalled permanently after one failed move.
 */
describe("player move nodeChange flag", () => {
    async function setup() {
        const manager = createRealManager();
        createRealNode(manager);
        // The player must start on node-1, otherwise the move is a no-op.
        const player = createRealPlayer(manager);
        const target = createRealNode(manager, { id: "node-2" });
        target.info = { sourceManagers: [] } as never;

        expect(player.node.id).toBe("node-1");
        player.voice.endpoint = "old.discord.media:443";
        player.voice.sessionId = "sess-A";
        player.voice.token = "token-A";
        player.voice.channelId = "voice-1";

        return { player, target };
    }

    it("clears the flag after a successful move", async () => {
        const { player, target } = await setup();

        await player.move("node-2");

        expect(player.node).toBe(target);
        expect(await player.data.get("internal_nodeChange")).toBeUndefined();
    });

    it("clears the flag when the move fails midway", async () => {
        const { player, target } = await setup();
        vi.spyOn(target.rest, "updatePlayer").mockRejectedValueOnce(new Error("rest down"));

        await expect(player.move("node-2")).rejects.toThrow("rest down");
        expect(await player.data.get("internal_nodeChange")).toBeUndefined();
    });
});
