import { describe, expect, it, vi } from "vitest";

import type { LavalinkTrack, TrackResolvableStructure } from "../../src";
import { QueueError, StorageError } from "../../src/classes/Errors";
import { Structures } from "../../src/types/Structures";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

function mockedTrack(id: string) {
    return Structures.Track(
        createMockTrackData({
            encoded: id,
            info: { identifier: id, title: id, author: "author", length: 1000 },
        }) as LavalinkTrack,
        {},
    );
}

describe("Queue", () => {
    it("adds and shifts tracks", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;
        vi.spyOn(queue.utils, "save").mockImplementation(() => undefined);

        await queue.add(mockedTrack("t1") as never);
        await queue.add([mockedTrack("t2"), mockedTrack("t3")] as never);

        expect(queue.size).toBe(3);

        const first = await queue.shift();
        expect(first?.encoded).toBe("t1");
        expect(queue.size).toBe(2);
    });

    it("shuffle handles small and larger queues", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;
        vi.spyOn(queue.utils, "save").mockImplementation(() => undefined);
        vi.spyOn(Math, "random").mockReturnValue(0);

        await queue.add([mockedTrack("a"), mockedTrack("b")] as never);
        await queue.shuffle();
        expect(queue.tracks[0]?.encoded).toBe("b");

        await queue.add([mockedTrack("c"), mockedTrack("d")] as never);
        await queue.shuffle();
        expect(queue.size).toBe(4);
    });

    it("move does nothing when track is not present", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;
        vi.spyOn(queue.utils, "save").mockImplementation(() => undefined);

        await queue.add([mockedTrack("a"), mockedTrack("b")] as never);
        const snapshot = [...queue.tracks];

        await queue.move(mockedTrack("x") as never, 1);

        expect(queue.tracks).toEqual(snapshot);
    });

    it("move places the track at the given position", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;
        vi.spyOn(queue.utils, "save").mockImplementation(() => undefined);

        const [a, b, c] = [mockedTrack("a"), mockedTrack("b"), mockedTrack("c")];
        await queue.add([a, b, c] as never);

        await queue.move(c as never, 0);
        expect(queue.tracks.map((track) => track.encoded)).toEqual(["c", "a", "b"]);

        await queue.move(c as never, 1);
        expect(queue.tracks.map((track) => track.encoded)).toEqual(["a", "c", "b"]);
    });

    it("move clamps an out of range position", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;
        vi.spyOn(queue.utils, "save").mockImplementation(() => undefined);

        const [a, b, c] = [mockedTrack("a"), mockedTrack("b"), mockedTrack("c")];
        await queue.add([a, b, c] as never);

        await queue.move(a as never, 99);
        expect(queue.tracks.map((track) => track.encoded)).toEqual(["b", "c", "a"]);

        await queue.move(a as never, -5);
        expect(queue.tracks.map((track) => track.encoded)).toEqual(["a", "b", "c"]);
    });

    it("toJSON trims history to maxHistory without mutating it", () => {
        const manager = createRealManager({ queueOptions: { maxHistory: 2 } } as never);
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;

        queue.history = [mockedTrack("h1"), mockedTrack("h2"), mockedTrack("h3")];
        const json = queue.toJSON();

        expect(json.history.length).toBe(2);
        expect(queue.history.length).toBe(3);
    });
});

describe("QueueUtils", () => {
    it("save trims history and persists queue", async () => {
        const manager = createRealManager({ queueOptions: { maxHistory: 2 } } as never);
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;

        queue.utils.storage.set = vi.fn();

        queue.tracks = [mockedTrack("t1"), mockedTrack("t2"), mockedTrack("t3")] as TrackResolvableStructure[];
        queue.history = [mockedTrack("h1"), mockedTrack("h2"), mockedTrack("h3")];

        await queue.utils.save();

        expect(queue.history.length).toBe(2);
        expect(queue.utils.storage.set).toHaveBeenCalledWith("guild-1", queue.toJSON());
    });

    it("destroy delegates to storage delete", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;
        queue.utils.storage.delete = vi.fn().mockResolvedValue(true);

        await queue.utils.destroy();

        expect(queue.utils.storage.delete).toHaveBeenCalledWith("guild-1");
    });

    it("sync throws StorageError when no saved data exists", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;

        queue.utils.storage.get = vi.fn().mockResolvedValue(undefined);

        await expect(queue.utils.sync()).rejects.toThrow(StorageError);
    });

    it("sync merges queue when override is false", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;
        queue.utils.storage.get = vi.fn().mockResolvedValue(undefined);
        queue.utils.storage.set = vi.fn();

        queue.tracks = [mockedTrack("c")];
        queue.utils.storage.get = vi.fn().mockResolvedValue({
            tracks: [mockedTrack("s")],
            history: [mockedTrack("h1"), mockedTrack("h2")],
            current: null,
        });

        await queue.utils.sync({ override: false });

        expect(queue.tracks.length).toBe(2);
        expect(queue.utils.storage.set).toHaveBeenCalled();
    });

    it("throws when json contains invalid tracks", () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;

        queue.tracks.push({ encoded: "track" } as TrackResolvableStructure);

        expect(() => queue.toJSON()).toThrow(QueueError);
    });

    it("throws when only some tracks are invalid", () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const queue = player.queue;

        queue.tracks.push(mockedTrack("valid"));
        queue.tracks.push({ encoded: "track" } as TrackResolvableStructure);

        expect(() => queue.toJSON()).toThrow(QueueError);
    });
});
