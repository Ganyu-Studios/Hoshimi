import { describe, expect, it, vi } from "vitest";
import { PlayerEventType, type TrackEndEvent, TrackEndReason } from "../../src/types/Player";
import { Structures } from "../../src/types/Structures";
import { trackEnd } from "../../src/util/events/player";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

describe("previous(true) history navigation", () => {
    it("marks the pulled track as isPrevious", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);

        const A = Structures.Track(createMockTrackData({ info: { identifier: "A", title: "Track A" } }) as never, {});
        player.queue.history = [A];

        const prev = await player.queue.previous(true);
        expect(prev).toBe(A);
        expect(prev!.isPrevious).toBe(true);
        expect(player.queue.history).toEqual([]);
    });

    it("a REPLACED end does not touch history", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);

        const A = Structures.Track(createMockTrackData({ info: { identifier: "A", title: "Track A" } }) as never, {});
        const B = Structures.Track(createMockTrackData({ info: { identifier: "B", title: "Track B" } }) as never, {});

        player.queue.current = B;
        player.queue.history = [A];

        await player.queue.previous(true); // removes A, history []
        vi.spyOn(player, "updatePlayer").mockResolvedValue(null);
        await player.play({ track: A }); // current -> A, replace B

        await trackEnd.call(player, {
            type: PlayerEventType.TrackEnd,
            guildId: player.guildId,
            reason: TrackEndReason.Replaced,
            track: B,
        } as unknown as TrackEndEvent);

        expect(player.queue.history).toEqual([]); // neither A nor B re-added on replace
    });

    it("a previous-sourced track ending naturally is not re-added to history", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);

        const A = Structures.Track(createMockTrackData({ info: { identifier: "A", title: "Track A" } }) as never, {});
        player.queue.history = [A];

        const prev = await player.queue.previous(true); // A.isPrevious = true
        player.queue.current = prev; // now playing A (from history)

        // A finishes naturally with an empty queue -> queueEnd path runs onEnd(false)
        await trackEnd.call(player, {
            type: PlayerEventType.TrackEnd,
            guildId: player.guildId,
            reason: TrackEndReason.Finished,
            track: A,
        } as unknown as TrackEndEvent);

        const ids = player.queue.history.map((t) => t.info.identifier);
        expect(ids).not.toContain("A"); // guard prevented the ping-pong
    });

    it("a normal track ending naturally IS added to history", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);

        const A = Structures.Track(createMockTrackData({ info: { identifier: "A", title: "Track A" } }) as never, {});
        const B = Structures.Track(createMockTrackData({ info: { identifier: "B", title: "Track B" } }) as never, {});
        player.queue.current = A; // fresh track, isPrevious = false
        player.queue.tracks = [B]; // a next track exists, so the queue does not end here
        vi.spyOn(player, "updatePlayer").mockResolvedValue(null);

        await trackEnd.call(player, {
            type: PlayerEventType.TrackEnd,
            guildId: player.guildId,
            reason: TrackEndReason.Finished,
            track: A,
        } as unknown as TrackEndEvent);

        expect(player.queue.history.map((t) => t.info.identifier)).toContain("A");
    });

    it("isPrevious survives toJSON -> rebuild", () => {
        const A = Structures.Track(createMockTrackData({ info: { identifier: "A", title: "Track A" } }) as never, {});
        A.isPrevious = true;

        const json = A.toJSON();
        expect(json.isPrevious).toBe(true);

        const rebuilt = Structures.Track(json as never, json.requester);
        expect(rebuilt.isPrevious).toBe(true);
    });
});
