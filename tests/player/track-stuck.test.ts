import { describe, expect, it, vi } from "vitest";
import { LoopMode, PlayerEventType, type TrackEndEvent, TrackEndReason, type TrackStuckEvent } from "../../src/types/Player";
import { Structures } from "../../src/types/Structures";
import { trackEnd, trackStuck } from "../../src/util/events/player";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

function setup() {
    const manager = createRealManager();
    const node = createRealNode(manager);
    const player = createRealPlayer(manager);
    vi.spyOn(player, "updatePlayer").mockResolvedValue(null);

    const track = (id: string) =>
        Structures.Track(createMockTrackData({ encoded: `enc-${id}`, info: { identifier: id, title: id } }) as never, {});

    const A = track("A");
    player.queue.current = A;
    player.queue.tracks = [track("B")];

    const stuck = (stuckTrack = A) =>
        trackStuck.call(player, {
            type: PlayerEventType.TrackStuck,
            guildId: player.guildId,
            track: stuckTrack,
            thresholdMs: 10_000,
        } as unknown as TrackStuckEvent);

    const end = () =>
        trackEnd.call(player, {
            type: PlayerEventType.TrackEnd,
            guildId: player.guildId,
            track: A,
            reason: TrackEndReason.Stopped,
        } as unknown as TrackEndEvent);

    return { node, player, A, stuck, end };
}

describe("trackStuck", () => {
    it("stops the stuck track so the node's TrackEnd advances the queue", async () => {
        const { node, player, stuck, end } = setup();

        await stuck();

        expect(node.updatePlayer).toHaveBeenCalledWith(
            expect.objectContaining({ guildId: player.guildId, playerOptions: { track: { encoded: null } } }),
        );
        expect(player.queue.current?.info.identifier).toBe("A");

        await end();

        expect(player.queue.current?.info.identifier).toBe("B");
        expect(player.queue.history.map((t) => t.info.identifier)).toEqual(["A"]);
    });

    it("applies the queue loop once when a TrackEnd follows the stuck event", async () => {
        const { player, stuck, end } = setup();
        player.setLoop(LoopMode.Queue);

        await stuck();
        await end();

        expect(player.queue.tracks.map((t) => t.info.identifier)).toEqual(["A"]);
    });

    it("does not stop a track that already replaced the stuck one", async () => {
        const { node, player, A, stuck, end } = setup();

        await end();
        vi.mocked(node.updatePlayer).mockClear();

        await stuck(A);

        expect(player.queue.current?.info.identifier).toBe("B");
        expect(node.updatePlayer).not.toHaveBeenCalled();
    });
});
