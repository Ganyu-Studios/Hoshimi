import { describe, expect, it, vi } from "vitest";

import { StorageError } from "../src/classes/Errors";
import { Queue } from "../src/classes/queue/Queue";
import { QueueUtils } from "../src/classes/queue/Utils";
import { SearchSources } from "../src/types/Manager";
import { Structures } from "../src/types/Structures";
import { SourceNames } from "../src";

function createPlayer() {
    return {
        guildId: "guild-1",
        manager: {
            emit: vi.fn(),
            options: {
                queueOptions: {
                    maxHistory: 2,
                    storage: {
                        set: vi.fn(),
                        get: vi.fn(),
                        delete: vi.fn(),
                    },
                },
                playerOptions: {
                    requesterFn: <T>(requester: unknown) => requester as T,
                },
                defaultSearchSource: SearchSources.Youtube,
            },
        },
    };
}

function basicTrack(id: string) {
    return {
        encoded: id,
        info: {
            identifier: id,
            title: id,
            author: "author",
            length: 1000,
            artworkUrl: null,
            uri: `https://example.com/${id}`,
            sourceName: "youtube",
            isSeekable: true,
            isStream: false,
            isrc: null,
            position: 0,
        },
    };
}

type QueueLike = {
    tracks: unknown[];
    history: unknown[];
    current: unknown;
    toJSON: () => { tracks: unknown[]; history: unknown[]; current: unknown };
    player: {
        guildId: string;
        manager: {
            emit: (...args: unknown[]) => unknown;
            options: {
                queueOptions: {
                    maxHistory: number;
                    storage: {
                        set: (key: string, value: unknown) => unknown;
                        get: (key: string) => unknown;
                        delete: (key: string) => unknown;
                    };
                };
            };
        };
    };
};

function createQueueUtilsHarness() {
    const set = vi.fn();
    const get = vi.fn();
    const del = vi.fn();

    const queue: QueueLike = {
        tracks: [],
        history: [],
        current: null,
        toJSON: vi.fn(function toJSON() {
            return {
                tracks: queue.tracks,
                history: queue.history,
                current: queue.current,
            };
        }),
        player: {
            guildId: "guild-1",
            manager: {
                emit: vi.fn(),
                options: {
                    queueOptions: {
                        maxHistory: 2,
                        storage: {
                            set,
                            get,
                            delete: del,
                        },
                    },
                },
            },
        },
    };

    return { queue, set, get, del };
}

describe("Queue", () => {
    it("adds and shifts tracks", async () => {
        const queue = new Queue(createPlayer() as never);
        vi.spyOn(queue.utils, "save").mockImplementation(() => undefined);

        await queue.add(basicTrack("t1") as never);
        await queue.add([basicTrack("t2"), basicTrack("t3")] as never);

        expect(queue.size).toBe(3);

        const first = await queue.shift();
        expect(first?.encoded).toBe("t1");
        expect(queue.size).toBe(2);
    });

    it("shuffle handles small and larger queues", async () => {
        const queue = new Queue(createPlayer() as never);
        vi.spyOn(queue.utils, "save").mockImplementation(() => undefined);
        vi.spyOn(Math, "random").mockReturnValue(0);

        await queue.add([basicTrack("a"), basicTrack("b")] as never);
        await queue.shuffle();
        expect(queue.tracks[0]?.encoded).toBe("b");

        await queue.add([basicTrack("c"), basicTrack("d")] as never);
        await queue.shuffle();
        expect(queue.size).toBe(4);
    });

    it("move does nothing when track is not present", async () => {
        const queue = new Queue(createPlayer() as never);
        vi.spyOn(queue.utils, "save").mockImplementation(() => undefined);

        await queue.add([basicTrack("a"), basicTrack("b")] as never);
        const snapshot = [...queue.tracks];

        await queue.move(basicTrack("x") as never, 1);

        expect(queue.tracks).toEqual(snapshot);
    });

    it("toJSON trims history to maxHistory", () => {
        const queue = new Queue(createPlayer() as never);
        queue.history = [basicTrack("h1"), basicTrack("h2"), basicTrack("h3")] as never;

        const json = queue.toJSON();

        expect(json.history.length).toBe(2);
    });
});

describe("QueueUtils", () => {
    it("save trims history and persists queue", () => {
        const { queue, set } = createQueueUtilsHarness();
        queue.tracks = [{}, {}, {}];
        queue.history = [{ id: 1 }, { id: 2 }, { id: 3 }];

        const utils = new QueueUtils(queue as never);
        utils.save();

        expect(queue.history.length).toBe(2);
        expect(set).toHaveBeenCalledWith("guild-1", queue.toJSON());
    });

    it("destroy delegates to storage delete", () => {
        const { queue, del } = createQueueUtilsHarness();
        const utils = new QueueUtils(queue as never);

        utils.destroy();

        expect(del).toHaveBeenCalledWith("guild-1");
    });

    it("sync throws StorageError when no saved data exists", async () => {
        const { queue, get } = createQueueUtilsHarness();
        get.mockResolvedValue(undefined);

        const utils = new QueueUtils(queue as never);

        await expect(utils.sync()).rejects.toThrow(StorageError);
    });

    it("sync merges queue when override is false", async () => {
        const { queue, get, set } = createQueueUtilsHarness();

        // Crear instancias reales de Track para los datos guardados
        const savedTrack = Structures.Track(
            {
                encoded: "s",
                info: {
                    identifier: "s",
                    title: "saved",
                    author: "author",
                    length: 1000,
                    artworkUrl: null,
                    uri: "https://example.com/s",
                    sourceName: SourceNames.Youtube,
                    isSeekable: true,
                    isStream: false,
                    isrc: null,
                    position: 0,
                },
                pluginInfo: {},
                userData: {},
            },
            {},
        );

        const historyTrack = Structures.Track(
            {
                encoded: "h",
                info: {
                    identifier: "h",
                    title: "history",
                    author: "author",
                    length: 1000,
                    artworkUrl: null,
                    uri: "https://example.com/h",
                    sourceName: SourceNames.Youtube,
                    isSeekable: true,
                    isStream: false,
                    isrc: null,
                    position: 0,
                },
                pluginInfo: {},
                userData: {},
            },
            {},
        );

        queue.tracks = [{ info: { title: "existing" }, encoded: "e" } as never];
        get.mockResolvedValue({
            tracks: [savedTrack],
            history: [historyTrack],
            current: null,
        });

        const utils = new QueueUtils(queue as never);

        await utils.sync({ override: false });

        expect(queue.tracks.length).toBe(2);
        expect(set).toHaveBeenCalled();
    });
});
