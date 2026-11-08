import { describe, expect, it } from "vitest";
import { PlayerEventType, TrackEndReason } from "../../src/types/Player";
import { Structures } from "../../src/types/Structures";
import { trackEnd } from "../../src/util/events/player";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

/**
 * The invariant is "empty queue -> no stored entry". `clear()` removes the entry, but the end-of-track
 * flow used to write an empty `{ tracks: [], history: [], current: null }` straight back, resurrecting
 * what was just cleared. `save()` now deletes instead of writing when the queue is fully empty.
 */
describe("empty queue is not persisted", () => {
    it("save() removes the stored entry when the queue is fully empty", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);

        const storage = player.queue.utils.storage;

        player.queue.current = Structures.Track(createMockTrackData(), {});
        await player.queue.utils.save();
        expect(await storage.has(player.guildId)).toBe(true);

        player.queue.current = null;
        player.queue.tracks = [];
        player.queue.history = [];
        await player.queue.utils.save();

        expect(await storage.has(player.guildId)).toBe(false);
    });

    it("does not resurrect the entry after clear() when a stop TrackEnd lands on a live player", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);

        const storage = player.queue.utils.storage;

        player.queue.current = Structures.Track(createMockTrackData(), {});
        await player.queue.utils.save();
        expect(await storage.has(player.guildId)).toBe(true);

        // Mirrors stop({ clearQueue: true, destroy: false }): clear() empties the queue and deletes the
        // entry, internal_stopPlaying is set, then Lavalink emits TrackEnd(Stopped). The player lives on.
        await player.queue.clear();
        await player.data.set("internal_stopPlaying", true);

        await trackEnd.call(player, {
            op: "event",
            type: PlayerEventType.TrackEnd,
            guildId: player.guildId,
            track: createMockTrackData(),
            reason: TrackEndReason.Stopped,
        } as never);

        expect(player.destroyed).toBe(false);
        expect(await storage.has(player.guildId)).toBe(false);
    });
});
