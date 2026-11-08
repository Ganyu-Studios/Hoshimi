import { describe, expect, it, vi } from "vitest";
import { Hoshimi } from "../../src";
import { PlayerError } from "../../src/classes/Errors";
import { PlayerMemoryStorage } from "../../src/classes/storage/PlayerMemory";
import { State } from "../../src/types/Node";
import { LoopMode } from "../../src/types/Player";
import { Structures } from "../../src/types/Structures";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

describe("Player", () => {
    it("validates loop mode and basic play state", () => {
        const manager = createRealManager();
        const player = createRealPlayer(manager);

        expect(player.isPlaying()).toBe(false);

        player.playing = true;
        player.paused = false;
        expect(player.isPlaying()).toBe(true);

        expect(() => player.setLoop(999 as never)).toThrow(PlayerError);

        player.setLoop(LoopMode.Queue);
        expect(player.loop).toBe(LoopMode.Queue);
    });

    it("setPaused freezes the position where it is and resumes from there", async () => {
        vi.useFakeTimers();

        try {
            const manager = createRealManager();
            const player = createRealPlayer(manager);
            vi.spyOn(player, "updatePlayer").mockResolvedValue(null);

            player.lastPosition = 10_000;
            player.lastPositionUpdate = Date.now();
            vi.advanceTimersByTime(3_000);

            await player.setPaused(true);
            expect(player.position).toBe(13_000);

            vi.advanceTimersByTime(5_000);
            expect(player.position).toBe(13_000);

            await player.setPaused(false);
            vi.advanceTimersByTime(1_000);
            expect(player.position).toBe(14_000);
        } finally {
            vi.useRealTimers();
        }
    });

    it("seek and setVolume throw on invalid input", async () => {
        const manager = createRealManager();
        const player = createRealPlayer(manager);
        player.queue.current = { info: { length: 10000 } } as never;

        await expect(player.seek(NaN)).rejects.toThrow(PlayerError);
        await expect(player.setVolume(NaN)).rejects.toThrow(PlayerError);
    });

    it("play keeps noReplace out of the player body and sends it as the option", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        const player = createRealPlayer(manager);
        const track = Structures.Track(createMockTrackData() as never, {});

        await player.play({ track, noReplace: true, paused: true });

        const data = vi.mocked(node.updatePlayer).mock.lastCall?.[0];
        expect(data?.noReplace).toBe(true);
        expect(data?.playerOptions).not.toHaveProperty("noReplace");
        expect(data?.playerOptions).toMatchObject({ paused: true, position: 0, track: { encoded: track.encoded } });
    });

    it("skip throws on an empty queue, or resolves when throwError is false", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        const player = createRealPlayer(manager);

        await expect(player.skip()).rejects.toThrow(PlayerError);

        await expect(player.skip({ throwError: false })).resolves.toBeUndefined();
        expect(node.stopPlayer).not.toHaveBeenCalled();
    });

    it("skip stops playback when a track is playing", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager);
        const player = createRealPlayer(manager);

        player.playing = true;
        player.paused = false;

        await player.skip({ throwError: false });

        expect(node.stopPlayer).toHaveBeenCalledWith(player.guildId);
    });

    it("move throws when target node is missing", async () => {
        const manager = createRealManager();
        createRealNode(manager);

        vi.spyOn(manager.nodeManager, "get").mockReturnValue(undefined);

        const player = createRealPlayer(manager);

        await expect(player.move("missing-node")).rejects.toThrow(PlayerError);
    });

    it("search delegates to manager.search", async () => {
        const manager = createRealManager();
        createRealNode(manager);

        const searchSpy = vi.spyOn(manager, "search").mockResolvedValue({
            loadType: 0,
            tracks: [],
            playlist: null,
            exception: null,
            pluginInfo: null,
        } as never);

        const player = createRealPlayer(manager);

        await player.search({ query: "hello", requester: {} });

        expect(searchSpy).toHaveBeenCalledWith({ query: "hello", node: player.node, requester: {} });
    });

    it("data is isolated between players and destroyed on destroy", async () => {
        const manager = new Hoshimi({
            nodes: [{ host: "localhost", port: 2333, password: "pass", id: "node-1", retryAmount: 0 }],
            sendPayload: vi.fn(),
        } as never);

        const nodeMock = {
            id: "node-1",
            state: State.Connected,
            options: { host: "localhost", port: 2333, password: "pass" },
            destroyPlayer: vi.fn().mockResolvedValue(undefined),
            stopPlayer: vi.fn().mockResolvedValue(null),
            rest: {
                request: vi.fn().mockResolvedValue(null),
                updatePlayer: vi.fn().mockResolvedValue(null),
                destroyPlayer: vi.fn().mockResolvedValue(undefined),
                stopPlayer: vi.fn().mockResolvedValue(null),
                getPlayers: vi.fn().mockResolvedValue([]),
                updateSession: vi.fn().mockResolvedValue(null),
            },
            decode: { single: vi.fn() },
            disconnect: vi.fn(),
        };
        manager.nodeManager.nodes.set("node-1", nodeMock as never);

        const playerA = manager.createPlayer({ guildId: "guild-a", voiceId: "voice-a" } as never);
        const playerB = manager.createPlayer({ guildId: "guild-b", voiceId: "voice-b" } as never);

        expect(playerA.data).not.toBe(playerB.data);
        expect(playerA.data).toBeInstanceOf(PlayerMemoryStorage);
        expect(playerB.data).toBeInstanceOf(PlayerMemoryStorage);

        await playerA.data.set("test_key", "secret");
        expect(await playerA.data.get("test_key")).toBe("secret");
        expect(await playerB.data.get("test_key")).toBeUndefined();

        await playerA.destroy({ disconnect: false });
        expect(manager.getPlayer("guild-a")).toBeUndefined();

        expect(await playerB.data.get("test_key")).toBeUndefined();
        expect(manager.getPlayer("guild-b")).toBe(playerB);
    });
});
