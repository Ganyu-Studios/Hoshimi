import { describe, expect, it, vi } from "vitest";
import { PlayerEventType, TrackEndReason } from "../../src/types/Player";
import { Structures } from "../../src/types/Structures";
import { trackEnd, trackStart } from "../../src/util/events/player";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

/**
 * Lavalink keeps talking while `destroy()` is in flight: the REST `DELETE .../players/{guildId}`
 * makes the track stop, and the resulting `TrackEndEvent` lands on the websocket while that same
 * request is still awaited — with the player still registered in the manager, since `deletePlayer`
 * only runs in the `finally` block.
 */
describe("Player destroy vs. late node events", () => {
    it("does not re-persist the queue when a TrackEnd lands mid-destroy", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        const player = createRealPlayer(manager);

        const storage = player.queue.utils.storage;

        player.queue.current = Structures.Track(createMockTrackData(), {});
        await player.queue.utils.save();
        expect(await storage.has(player.guildId)).toBe(true);

        // The websocket frame is processed while the DELETE is pending, exactly as it happens in
        // production: same tick window between `queue.utils.destroy()` and `manager.deletePlayer()`.
        vi.spyOn(node.rest, "destroyPlayer").mockImplementation(async (): Promise<void> => {
            expect(manager.getPlayer(player.guildId)).toBe(player);

            await trackEnd.call(player, {
                op: "event",
                type: PlayerEventType.TrackEnd,
                guildId: player.guildId,
                track: createMockTrackData(),
                reason: TrackEndReason.Stopped,
            } as never);
        });

        await player.destroy();

        expect(await storage.has(player.guildId)).toBe(false);
    });

    it("does not run the autoplay function for a player being destroyed", async () => {
        const autoplayFn = vi.fn().mockResolvedValue(undefined);
        const manager = createRealManager({ queueOptions: { autoplayFn } } as never);
        const node = createRealNode(manager);
        const player = createRealPlayer(manager);

        player.queue.current = Structures.Track(createMockTrackData(), {});

        vi.spyOn(node.rest, "destroyPlayer").mockImplementation(async (): Promise<void> => {
            await trackEnd.call(player, {
                op: "event",
                type: PlayerEventType.TrackEnd,
                guildId: player.guildId,
                track: createMockTrackData(),
                reason: TrackEndReason.Stopped,
            } as never);
        });

        await player.destroy();

        expect(autoplayFn).not.toHaveBeenCalled();
    });

    it("does not re-persist the queue when a TrackStart lands mid-destroy", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        const player = createRealPlayer(manager);

        const storage = player.queue.utils.storage;
        player.queue.current = Structures.Track(createMockTrackData(), {});

        vi.spyOn(node.rest, "destroyPlayer").mockImplementation(async (): Promise<void> => {
            await trackStart.call(player, {
                op: "event",
                type: PlayerEventType.TrackStart,
                guildId: player.guildId,
                track: createMockTrackData(),
            } as never);
        });

        await player.destroy();

        expect(await storage.has(player.guildId)).toBe(false);
    });

    it("still persists the queue for a live player", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);

        const storage = player.queue.utils.storage;
        player.queue.current = Structures.Track(createMockTrackData(), {});

        await trackStart.call(player, {
            op: "event",
            type: PlayerEventType.TrackStart,
            guildId: player.guildId,
            track: createMockTrackData(),
        } as never);

        expect(await storage.has(player.guildId)).toBe(true);
    });
});
