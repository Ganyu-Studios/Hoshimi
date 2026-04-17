import { describe, expect, it, vi } from "vitest";
import { PlayerError } from "../src/classes/Errors";
import { Player } from "../src/classes/player/Player";
import { PlayerMemoryStorage } from "../src/classes/storage/PlayerMemory";
import { QueueMemoryStorage } from "../src/classes/storage/QueueMemory";
import { SearchSources } from "../src/types/Manager";
import { State } from "../src/types/Node";
import { LoopMode } from "../src/types/Player";

function createManager() {
    const node = {
        id: "node-1",
        state: State.Connected,
        info: { sourceManagers: ["youtube"], filters: [] },
        updatePlayer: vi.fn().mockResolvedValue(null),
        stopPlayer: vi.fn().mockResolvedValue(null),
        destroyPlayer: vi.fn().mockResolvedValue(undefined),
        toJSON: vi.fn().mockReturnValue({ id: "node-1" }),
        lyricsManager: {
            subscribe: vi.fn(),
            unsubscribe: vi.fn(),
            current: vi.fn(),
            get: vi.fn(),
        },
    };

    const manager = {
        emit: vi.fn(),
        search: vi.fn().mockResolvedValue({ tracks: [] }),
        deletePlayer: vi.fn().mockReturnValue(true),
        nodeManager: {
            get: vi.fn().mockReturnValue(node),
            getLeastUsed: vi.fn().mockReturnValue(node),
        },
        options: {
            sendPayload: vi.fn().mockResolvedValue(undefined),
            defaultSearchSource: SearchSources.Youtube,
            queueOptions: {
                maxHistory: 5,
                autoPlay: false,
                autoplayFn: vi.fn(),
                storage: new QueueMemoryStorage(),
            },
            playerOptions: {
                storage: new PlayerMemoryStorage(),
                requesterFn: <T>(requester: unknown) => requester as T,
                onDisconnect: {
                    autoDestroy: false,
                    autoReconnect: false,
                    autoQueue: false,
                },
                onError: {
                    autoDestroy: false,
                    autoSkip: false,
                    autoStop: false,
                },
            },
            nodeOptions: {
                resumable: false,
                resumeByLibrary: false,
                resumeTimeout: 60,
                userAgent: "ua",
            },
            restOptions: { resumeTimeout: 10000 },
            client: { id: "1", username: "bot" },
            nodes: [{ host: "localhost", port: 2333, password: "pass" }],
        },
    };

    return { manager, node };
}

describe("Player", () => {
    it("validates loop mode and basic play state", () => {
        const { manager } = createManager();
        const player = new Player(manager as never, { guildId: "guild-1", voiceId: "voice-1" } as never);

        expect(player.isPlaying()).toBe(false);

        player.playing = true;
        player.paused = false;
        expect(player.isPlaying()).toBe(true);

        expect(() => player.setLoop(999 as never)).toThrow(PlayerError);

        player.setLoop(LoopMode.Queue);
        expect(player.loop).toBe(LoopMode.Queue);
    });

    it("seek and setVolume throw on invalid input", async () => {
        const { manager } = createManager();
        const player = new Player(manager as never, { guildId: "guild-1", voiceId: "voice-1" } as never);

        await expect(player.seek(-1)).rejects.toThrow(PlayerError);
        await expect(player.setVolume(101)).rejects.toThrow(PlayerError);
    });

    it("move throws when target node is missing", async () => {
        const { manager } = createManager();
        manager.nodeManager.get = vi.fn().mockReturnValue(undefined);

        const player = new Player(manager as never, { guildId: "guild-1", voiceId: "voice-1" } as never);

        await expect(player.move("missing-node")).rejects.toThrow(PlayerError);
    });

    it("search delegates to manager.search", async () => {
        const { manager } = createManager();
        const player = new Player(manager as never, { guildId: "guild-1", voiceId: "voice-1" } as never);

        await player.search({ query: "hello", requester: {} });

        expect(manager.search).toHaveBeenCalledWith({ query: "hello", node: player.node, requester: {} });
    });
});
