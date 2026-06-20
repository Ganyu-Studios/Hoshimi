import { describe, expect, it, vi } from "vitest";
import { Hoshimi, HoshimiDefaultOptions } from "../src";
import { PlayerError } from "../src/classes/Errors";
import { Player } from "../src/classes/player/Player";
import { PlayerMemoryStorage } from "../src/classes/storage/PlayerMemory";
import { State } from "../src/types/Node";
import { LoopMode } from "../src/types/Player";
import { createMockHoshimi } from "./helpers";

describe("Player", () => {
    it("validates loop mode and basic play state", () => {
        const manager = createMockHoshimi();

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
        const manager = createMockHoshimi();

        const player = new Player(manager as never, { guildId: "guild-1", voiceId: "voice-1" } as never);
        player.queue.current = { info: { length: 10000 } } as never;

        await expect(player.seek(NaN)).rejects.toThrow(PlayerError);
        await expect(player.setVolume(NaN)).rejects.toThrow(PlayerError);
    });

    it("move throws when target node is missing", async () => {
        const manager = createMockHoshimi();

        manager.nodeManager.get = vi.fn().mockReturnValue(undefined);

        const player = new Player(manager as never, { guildId: "guild-1", voiceId: "voice-1" } as never);

        await expect(player.move("missing-node")).rejects.toThrow(PlayerError);
    });

    it("search delegates to manager.search", async () => {
        const manager = createMockHoshimi();

        const searchSpy = vi.spyOn(manager, "search");

        const player = new Player(manager as never, { guildId: "guild-1", voiceId: "voice-1" } as never);

        await player.search({ query: "hello", requester: {} });

        expect(searchSpy).toHaveBeenCalledWith({ query: "hello", node: player.node, requester: {} });
    });

    it("data is isolated between players and destroyed on destroy", async () => {
        const manager = new Hoshimi({ nodes: HoshimiDefaultOptions.nodes } as never);

        const nodeMock = {
            id: "node-1",
            state: State.Connected,
            options: { host: "localhost", port: 2333, password: "pass" },
            destroyPlayer: vi.fn().mockResolvedValue(undefined),
            stopPlayer: vi.fn().mockResolvedValue(null),
        };
        manager.nodeManager.nodes.set("node-1", nodeMock as never);
        manager.options.sendPayload = vi.fn();

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
