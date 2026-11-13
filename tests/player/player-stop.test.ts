import { describe, expect, it, vi } from "vitest";
import { EventNames } from "../../src/types/Manager";
import { PlayerEventType, type TrackEndEvent, TrackEndReason } from "../../src/types/Player";
import { Structures } from "../../src/types/Structures";
import { trackEnd } from "../../src/util/events/player";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

const track = (id: string) =>
    Structures.Track(createMockTrackData({ encoded: `enc-${id}`, info: { identifier: id, title: id } }) as never, {});

const endOf = (t: { encoded: string }, reason: TrackEndReason = TrackEndReason.Stopped) =>
    ({ type: PlayerEventType.TrackEnd, reason, track: { encoded: t.encoded } }) as unknown as TrackEndEvent;

function setup(overrides?: Record<string, unknown>) {
    const manager = createRealManager(overrides as never);
    const node = createRealNode(manager);
    const player = createRealPlayer(manager);

    // The node answers the stop request, so a TrackEnd follows it.
    vi.mocked(node.stopPlayer).mockResolvedValue({} as never);
    vi.spyOn(player, "updatePlayer").mockResolvedValue(null);
    const play = vi.spyOn(player, "play");

    const A = track("A");
    const B = track("B");
    player.queue.current = A;
    player.queue.tracks = [B];
    player.playing = true;

    const ended = vi.fn();
    const queueEnd = vi.fn();
    manager.on(EventNames.TrackEnd, ended);
    manager.on(EventNames.QueueEnd, queueEnd);

    return { manager, node, player, play, A, B, ended, queueEnd };
}

describe("stop({ destroy: false })", () => {
    it("stops the track and keeps the queue instead of playing the next one", async () => {
        const { player, play, A, ended, queueEnd } = setup();

        await player.stop({ destroy: false });
        await trackEnd.call(player, endOf(A));

        expect(play).not.toHaveBeenCalled();
        expect(player.queue.current).toBeNull();
        expect(player.playing).toBe(false);
        expect(player.queue.tracks.map((t) => t.info.identifier)).toEqual(["B"]);
        expect(ended).toHaveBeenCalledWith(player, A, expect.anything());
        expect(queueEnd).not.toHaveBeenCalled();
        expect(await player.data.get("internal_stopPlaying")).toBeUndefined();
    });

    it("does not leave the flag behind for a later natural end", async () => {
        const { player, A } = setup();

        await player.stop({ destroy: false });
        await trackEnd.call(player, endOf(A));

        const C = track("C");
        player.queue.tracks = [];
        player.queue.current = C;

        await trackEnd.call(player, endOf(C, TrackEndReason.Finished));

        expect(player.queue.history.map((t) => t.info.identifier)).toContain("C");
    });

    it("does not run the autoplay when the last track is stopped", async () => {
        const autoplayFn = vi.fn();
        const { player, A, queueEnd } = setup({ queueOptions: { autoPlay: true, autoplayFn } });
        player.queue.tracks = [];

        await player.stop({ destroy: false });
        await trackEnd.call(player, endOf(A));

        expect(autoplayFn).not.toHaveBeenCalled();
        expect(queueEnd).not.toHaveBeenCalled();
        expect(player.queue.current).toBeNull();
    });

    it("catches a TrackEnd the node reports while the stop request is still in flight", async () => {
        const { node, player, play, A } = setup();
        vi.mocked(node.stopPlayer).mockImplementationOnce(async () => {
            await trackEnd.call(player, endOf(A));
            return {} as never;
        });

        await player.stop({ destroy: false });

        expect(play).not.toHaveBeenCalled();
        expect(player.queue.current).toBeNull();
        expect(await player.data.get("internal_stopPlaying")).toBeUndefined();
    });

    it("leaves a track played right after the stop alone", async () => {
        const { player, A, B } = setup();

        await player.stop({ destroy: false });
        player.queue.current = B; // play() ran before the stop's TrackEnd arrived

        await trackEnd.call(player, endOf(A));

        expect(player.queue.current).toBe(B);
        expect(await player.data.get("internal_stopPlaying")).toBeUndefined();
    });

    it("does not outlive the next play() when no TrackEnd reads it", async () => {
        const { player, B } = setup();
        player.queue.current = null; // nothing playing: no TrackEnd follows the stop

        await player.stop({ destroy: false });
        await player.play();

        expect(await player.data.get("internal_stopPlaying")).toBeUndefined();
        expect(player.queue.current).toBe(B);

        // The track the play() started ends normally later: it is not taken for a stop.
        await trackEnd.call(player, endOf(B, TrackEndReason.Finished));

        expect(player.queue.history.map((t) => t.info.identifier)).toContain("B");
    });

    it("does not outlive the next play() when the stop request fails", async () => {
        const { node, player } = setup();
        vi.mocked(node.stopPlayer).mockRejectedValueOnce(new Error("node down"));

        await expect(player.stop({ destroy: false })).rejects.toThrow("node down");
        await player.play();

        expect(await player.data.get("internal_stopPlaying")).toBeUndefined();
    });
});

describe("skip", () => {
    it("still plays the next track, since it stops without the flag", async () => {
        const { player, play, A } = setup();

        await player.skip();
        await trackEnd.call(player, endOf(A));

        expect(play).toHaveBeenCalledOnce();
        expect(player.queue.current?.info.identifier).toBe("B");
    });
});
