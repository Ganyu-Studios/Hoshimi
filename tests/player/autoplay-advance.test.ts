import { describe, expect, it, vi } from "vitest";
import { PlayerEventType, TrackEndReason } from "../../src/types/Player";
import type { PlayerStructure } from "../../src/types/Structures";
import { Structures } from "../../src/types/Structures";
import { trackEnd } from "../../src/util/events/player";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

const track = (identifier: string) => Structures.Track(createMockTrackData({ info: { identifier } }), {});

const endEvent = {
    op: "event",
    type: PlayerEventType.TrackEnd,
    guildId: "guild-1",
    track: createMockTrackData(),
    reason: TrackEndReason.Finished,
} as never;

/**
 * `queueEnd` nulls `current` before running the autoplay hook, so it must let `play()` do the single
 * shift-and-play. It used to also call `onEnd` first, which shifted one track in on its own — `play()`
 * then shifted again, skipping that track (two seeded) or hitting an empty queue and crashing in
 * `build()` (one seeded).
 */
describe("autoplay does not double-advance", () => {
    it("plays a single seeded track instead of crashing", async () => {
        const autoplayFn = vi.fn(async (player: PlayerStructure) => {
            await player.queue.add(track("auto-1"));
        });
        const manager = createRealManager({ queueOptions: { autoplayFn } } as never);
        createRealNode(manager);
        const player = createRealPlayer(manager);
        player.queue.current = track("ended");

        await expect(trackEnd.call(player, endEvent)).resolves.toBeUndefined();

        expect(player.queue.current?.info.identifier).toBe("auto-1");
        expect(player.queue.tracks).toHaveLength(0);
    });

    it("plays the first of several seeded tracks and keeps the rest queued", async () => {
        const autoplayFn = vi.fn(async (player: PlayerStructure) => {
            await player.queue.add(track("auto-1"));
            await player.queue.add(track("auto-2"));
        });
        const manager = createRealManager({ queueOptions: { autoplayFn } } as never);
        createRealNode(manager);
        const player = createRealPlayer(manager);
        player.queue.current = track("ended");

        await trackEnd.call(player, endEvent);

        // The first seeded track plays; the second waits its turn instead of being skipped.
        expect(player.queue.current?.info.identifier).toBe("auto-1");
        expect(player.queue.tracks.map((t) => t.info.identifier)).toEqual(["auto-2"]);
    });

    it("still ends the queue when autoplay seeds nothing", async () => {
        const autoplayFn = vi.fn().mockResolvedValue(undefined);
        const manager = createRealManager({ queueOptions: { autoplayFn } } as never);
        createRealNode(manager);
        const player = createRealPlayer(manager);
        player.queue.current = track("ended");

        const queueEnd = vi.fn();
        manager.on("queueEnd", queueEnd);

        await trackEnd.call(player, endEvent);

        expect(queueEnd).toHaveBeenCalledTimes(1);
        expect(player.queue.current).toBeNull();
    });
});
