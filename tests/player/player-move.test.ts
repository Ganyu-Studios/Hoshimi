import { afterEach, describe, expect, it, vi } from "vitest";
import { Structures } from "../../src/types/Structures";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

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

describe("player move playback state", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    async function moveWith(paused: boolean) {
        vi.useFakeTimers();

        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const target = createRealNode(manager, { id: "node-2" });
        target.info = { sourceManagers: ["youtube"], plugins: [], filters: [] } as never;

        player.voice.patch({ endpoint: "endpoint", sessionId: "session", token: "token", channelId: "voice-1" });
        player.queue.current = Structures.Track(createMockTrackData() as never, {});
        player.lastPosition = 10_000;
        player.lastPositionUpdate = Date.now();
        vi.advanceTimersByTime(5_000);

        if (paused) {
            await player.setPaused(true);
            // Set by `updatePlayerState` when the REST update goes through, which is mocked here.
            player.paused = true;
            vi.advanceTimersByTime(5_000);
        }

        await player.move("node-2");

        return vi.mocked(target.rest.updatePlayer).mock.calls.find(([data]) => data.playerOptions?.track)?.[0].playerOptions;
    }

    it("resumes on the new node from the current position, not the last reported one", async () => {
        const sent = await moveWith(false);

        expect(sent?.position).toBe(15_000);
        expect(sent?.paused).toBe(false);
    });

    it("keeps a paused player paused, at the position it was paused at", async () => {
        const sent = await moveWith(true);

        expect(sent?.position).toBe(15_000);
        expect(sent?.paused).toBe(true);
    });
});
