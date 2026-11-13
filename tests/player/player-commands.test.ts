import { describe, expect, it, vi } from "vitest";
import { EventNames } from "../../src/types/Manager";
import { PlayerEventType, type TrackEndEvent, TrackEndReason } from "../../src/types/Player";
import { type PlayerStructure, Structures } from "../../src/types/Structures";
import { trackEnd } from "../../src/util/events/player";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

/**
 * Event handlers run one at a time, but the bot's commands do not wait for them. A command that lands while
 * a handler awaits (the storage, the autoplay search) owns the player from then on.
 */

const track = (id: string) =>
    Structures.Track(createMockTrackData({ encoded: `enc-${id}`, info: { identifier: id, title: id } }) as never, {});

const endOf = (t: { encoded: string }) =>
    ({ type: PlayerEventType.TrackEnd, reason: TrackEndReason.Finished, track: { encoded: t.encoded } }) as unknown as TrackEndEvent;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function setup(overrides?: Record<string, unknown>) {
    const manager = createRealManager(overrides as never);
    const node = createRealNode(manager);
    const player = createRealPlayer(manager);

    const A = track("A");
    player.queue.current = A;
    player.playing = true;

    const queueEnd = vi.fn();
    manager.on(EventNames.QueueEnd, queueEnd);

    return { manager, node, player, A, queueEnd };
}

/** What a bot's /play does: add the track, and start it when nothing is playing. */
async function userPlays(player: PlayerStructure, id: string): Promise<void> {
    await player.queue.add(track(id));
    if (!player.playing) await player.play();
}

describe("a command while an event is being handled", () => {
    it("a /play during the queue end save keeps the new song and ends no queue", async () => {
        const { player, A, queueEnd } = setup();

        // The first write is the queue end saving the history, slow like a Redis round trip. The /play
        // writes too, so it only fires once.
        let fired = false;
        let command: Promise<void> | undefined;
        const set = player.queue.utils.storage.set.bind(player.queue.utils.storage);
        vi.spyOn(player.queue.utils.storage, "set").mockImplementation(async (key, value) => {
            if (!fired) {
                fired = true;
                command = userPlays(player, "T");
            }
            await wait(10);
            return set(key, value);
        });

        await trackEnd.call(player, endOf(A));
        await command;

        expect(player.queue.current?.info.identifier).toBe("T");
        expect(queueEnd).not.toHaveBeenCalled();
    });

    it("a /play during the autoplay search keeps the user's song current and queues the recommendation", async () => {
        let player: PlayerStructure | undefined;
        const autoplayFn = vi.fn(async (p: PlayerStructure) => {
            await userPlays(player!, "T");
            await p.queue.add(track("R"));
        });

        const ctx = setup({ queueOptions: { autoPlay: true, autoplayFn } });
        player = ctx.player;

        await trackEnd.call(ctx.player, endOf(ctx.A));

        expect(ctx.player.queue.current?.info.identifier).toBe("T");
        expect(ctx.player.queue.tracks.map((t) => t.info.identifier)).toEqual(["R"]);
        expect(ctx.queueEnd).not.toHaveBeenCalled();
    });

    it("a destroy() during the autoplay search sends nothing to the node afterwards", async () => {
        let node: ReturnType<typeof createRealNode> | undefined;
        const autoplayFn = vi.fn(async (p: PlayerStructure) => {
            await p.destroy();
            vi.mocked(node!.updatePlayer).mockClear();
            await p.queue.add(track("R"));
        });

        const ctx = setup({ queueOptions: { autoPlay: true, autoplayFn } });
        node = ctx.node;

        await trackEnd.call(ctx.player, endOf(ctx.A));

        expect(ctx.node.updatePlayer).not.toHaveBeenCalled();
        expect(ctx.queueEnd).not.toHaveBeenCalled();
    });

    it("an autoplayFn that plays on its own is not played over", async () => {
        const autoplayFn = vi.fn(async (p: PlayerStructure) => {
            await p.queue.add([track("R1"), track("R2")]);
            await p.play();
        });

        const { player, A } = setup({ queueOptions: { autoPlay: true, autoplayFn } });
        const play = vi.spyOn(player, "play");

        await trackEnd.call(player, endOf(A));

        expect(play).toHaveBeenCalledOnce();
        expect(player.queue.current?.info.identifier).toBe("R1");
        expect(player.queue.tracks.map((t) => t.info.identifier)).toEqual(["R2"]);
    });
});

describe("a stop() while an end is being handled", () => {
    it("keeps the next track from playing when it lands while the end saves the history", async () => {
        const { player, A, queueEnd } = setup();
        player.queue.tracks = [track("B")];
        const play = vi.spyOn(player, "play");

        // The stop lands while the end records A in the history: A is already over, so no TrackEnd follows it.
        let fired = false;
        let command: Promise<void> | undefined;
        const set = player.queue.utils.storage.set.bind(player.queue.utils.storage);
        vi.spyOn(player.queue.utils.storage, "set").mockImplementation(async (key, value) => {
            if (!fired) {
                fired = true;
                command = player.stop({ destroy: false });
            }
            await wait(10);
            return set(key, value);
        });

        await trackEnd.call(player, endOf(A));
        await command;

        expect(play).not.toHaveBeenCalled();
        expect(player.queue.current).toBeNull();
        expect(player.queue.tracks.map((t) => t.info.identifier)).toEqual(["B"]);
        expect(queueEnd).not.toHaveBeenCalled();
        expect(await player.data.get("internal_stopPlaying")).toBeUndefined();
    });

    it("keeps the autoplay from playing when it lands during the search", async () => {
        let player: PlayerStructure | undefined;
        const autoplayFn = vi.fn(async (p: PlayerStructure) => {
            await player!.stop({ destroy: false });
            await p.queue.add(track("R"));
        });

        const ctx = setup({ queueOptions: { autoPlay: true, autoplayFn } });
        player = ctx.player;
        const play = vi.spyOn(ctx.player, "play");

        await trackEnd.call(ctx.player, endOf(ctx.A));

        expect(play).not.toHaveBeenCalled();
        expect(ctx.player.queue.current).toBeNull();
        expect(ctx.player.queue.tracks.map((t) => t.info.identifier)).toEqual(["R"]);
        expect(ctx.queueEnd).not.toHaveBeenCalled();
        expect(await ctx.player.data.get("internal_stopPlaying")).toBeUndefined();
    });
});

describe("a destroyed player", () => {
    it("sends no update to the node, which would create it there again", async () => {
        const { node, player } = setup();

        await player.destroy();
        vi.mocked(node.updatePlayer).mockClear();

        await player.setVolume(50);
        await player.setPaused(true);

        expect(node.updatePlayer).not.toHaveBeenCalled();
    });
});
