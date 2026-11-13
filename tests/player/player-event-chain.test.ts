import { describe, expect, it, vi } from "vitest";
import { EventNames } from "../../src/types/Manager";
import { PlayerEventType, type TrackEndEvent, TrackEndReason } from "../../src/types/Player";
import { Structures } from "../../src/types/Structures";
import { trackEnd } from "../../src/util/events/player";
import { onMessage } from "../../src/util/events/websocket";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

function setup() {
    const manager = createRealManager();
    const node = createRealNode(manager);
    const player = createRealPlayer(manager);

    const A = Structures.Track(createMockTrackData({ encoded: "enc-A", info: { identifier: "A", title: "A" } }) as never, {});
    player.queue.current = A;
    player.playing = true;

    const queueEnd = vi.fn();
    const nodeError = vi.fn();
    manager.on(EventNames.QueueEnd, queueEnd);
    manager.on(EventNames.NodeError, nodeError);

    const send = (payload: Record<string, unknown>, guildId: string = player.guildId) =>
        onMessage.call(node, JSON.stringify({ op: "event", guildId, ...payload }));

    const end = (guildId?: string) =>
        send({ type: PlayerEventType.TrackEnd, reason: TrackEndReason.Finished, track: { encoded: "enc-A", info: A.info } }, guildId);

    return { manager, node, player, A, queueEnd, nodeError, send, end };
}

/** A storage write that takes a while, like a Redis round trip. */
function slowWrites(player: ReturnType<typeof setup>["player"], ms: number = 20) {
    const set = player.queue.utils.storage.set.bind(player.queue.utils.storage);
    return vi.spyOn(player.queue.utils.storage, "set").mockImplementation(async (key, value) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return set(key, value);
    });
}

describe("player event chain", () => {
    it("ends the queue once when the node reports the same end twice while the queue is saving", async () => {
        const { player, queueEnd, nodeError, end } = setup();
        slowWrites(player);

        await Promise.all([end(), end()]);

        expect(nodeError).not.toHaveBeenCalled();
        expect(queueEnd).toHaveBeenCalledOnce();
        expect(player.queue.current).toBeNull();
        expect(player.queue.history.map((t) => t.info.identifier)).toEqual(["A"]);
    });

    it("keeps running the next events of a player after one fails", async () => {
        const { player, queueEnd, nodeError, send, end } = setup();
        vi.spyOn(player.data, "get").mockRejectedValueOnce(new Error("storage down"));

        await Promise.all([send({ type: PlayerEventType.TrackStart, track: { encoded: "enc-A" } }), end()]);

        expect(nodeError).toHaveBeenCalledOnce();
        expect(nodeError.mock.calls[0]?.[1]).toMatchObject({ message: "storage down" });
        expect(queueEnd).toHaveBeenCalledOnce();
    });

    it("ignores an event type it has no handler for, like NodeLink's own events", async () => {
        const { queueEnd, nodeError, send, end } = setup();

        await Promise.all([send({ type: "PlayerCreatedEvent" }), end()]);

        expect(nodeError).not.toHaveBeenCalled();
        expect(queueEnd).toHaveBeenCalledOnce();
    });

    it("does not make one player wait for another", async () => {
        const { manager, player, queueEnd, end } = setup();
        const other = createRealPlayer(manager, { guildId: "guild-2" });
        other.queue.current = player.queue.current;

        // The first player's write never finishes until released.
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const set = player.queue.utils.storage.set.bind(player.queue.utils.storage);
        vi.spyOn(player.queue.utils.storage, "set").mockImplementation(async (key, value) => {
            if (key === player.guildId) await gate;
            return set(key, value);
        });

        const first = end();
        await end("guild-2");

        // The second player ended its queue while the first one is still blocked on its write.
        expect(queueEnd.mock.calls.map(([p]) => p.guildId)).toEqual(["guild-2"]);

        release();
        await first;

        expect(queueEnd.mock.calls.map(([p]) => p.guildId)).toEqual(["guild-2", player.guildId]);
    });
});

describe("track end of a track that is no longer current", () => {
    const endOf = (encoded: string) =>
        ({
            type: PlayerEventType.TrackEnd,
            reason: TrackEndReason.Finished,
            track: { encoded },
        }) as unknown as TrackEndEvent;

    it("is ignored when another track is current", async () => {
        const { manager, player, A, queueEnd } = setup();
        const ended = vi.fn();
        manager.on(EventNames.TrackEnd, ended);

        await trackEnd.call(player, endOf("enc-other"));

        expect(player.queue.current).toBe(A);
        expect(queueEnd).not.toHaveBeenCalled();
        expect(ended).not.toHaveBeenCalled();
    });

    it("is ignored when the queue already ended", async () => {
        const { player, queueEnd } = setup();
        player.queue.current = null;

        await trackEnd.call(player, endOf("enc-A"));

        expect(queueEnd).not.toHaveBeenCalled();
    });
});

describe("queue end", () => {
    it("clears the playing state before it waits on the storage", async () => {
        const { player, end } = setup();

        const seen: { current: unknown; playing: boolean }[] = [];
        const set = player.queue.utils.storage.set.bind(player.queue.utils.storage);
        vi.spyOn(player.queue.utils.storage, "set").mockImplementation(async (key, value) => {
            seen.push({ current: player.queue.current, playing: player.playing });
            return set(key, value);
        });

        await end();

        expect(seen.length).toBeGreaterThan(0);
        expect(seen.every((state) => state.current === null && state.playing === false)).toBe(true);
    });
});
