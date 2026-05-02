import { describe, expect, it, vi } from "vitest";
import { Hoshimi, HoshimiDefaultOptions } from "../src";
import { PlayerError } from "../src/classes/Errors";
import { Player } from "../src/classes/player/Player";
import { State } from "../src/types/Node";
import { LoopMode } from "../src/types/Player";

describe("Player", () => {
    it("validates loop mode and basic play state", () => {
        const manager = new Hoshimi({
            nodes: HoshimiDefaultOptions.nodes,
        } as never);

        // Add a connected node to the manager
        manager.nodeManager.nodes.set("node-1", {
            id: "node-1",
            state: State.Connected,
            options: { host: "localhost", port: 2333, password: "pass" },
        } as never);

        const player = new Player(manager, { guildId: "guild-1", voiceId: "voice-1" } as never);

        expect(player.isPlaying()).toBe(false);

        player.playing = true;
        player.paused = false;
        expect(player.isPlaying()).toBe(true);

        expect(() => player.setLoop(999 as never)).toThrow(PlayerError);

        player.setLoop(LoopMode.Queue);
        expect(player.loop).toBe(LoopMode.Queue);
    });

    it("seek and setVolume throw on invalid input", async () => {
        const manager = new Hoshimi({
            nodes: HoshimiDefaultOptions.nodes,
        } as never);

        // Add a connected node to the manager
        manager.nodeManager.nodes.set("node-1", {
            id: "node-1",
            state: State.Connected,
            options: { host: "localhost", port: 2333, password: "pass" },
        } as never);

        const player = new Player(manager, { guildId: "guild-1", voiceId: "voice-1" } as never);

        await expect(player.seek(-1)).rejects.toThrow(PlayerError);
        await expect(player.setVolume(101)).rejects.toThrow(PlayerError);
    });

    it("move throws when target node is missing", async () => {
        const manager = new Hoshimi({
            nodes: HoshimiDefaultOptions.nodes,
        } as never);

        // Add a connected node to the manager
        manager.nodeManager.nodes.set("node-1", {
            id: "node-1",
            state: State.Connected,
            options: { host: "localhost", port: 2333, password: "pass" },
        } as never);

        manager.nodeManager.get = vi.fn().mockReturnValue(undefined);

        const player = new Player(manager, { guildId: "guild-1", voiceId: "voice-1" } as never);

        await expect(player.move("missing-node")).rejects.toThrow(PlayerError);
    });

    it("search delegates to manager.search", async () => {
        const manager = new Hoshimi({
            nodes: HoshimiDefaultOptions.nodes,
        } as never);

        // Add a connected node to the manager
        manager.nodeManager.nodes.set("node-1", {
            id: "node-1",
            state: State.Connected,
            options: { host: "localhost", port: 2333, password: "pass" },
            search: vi.fn(),
        } as never);

        // Spy on manager.search before creating the player
        const searchSpy = vi.spyOn(manager, "search");

        const player = new Player(manager, { guildId: "guild-1", voiceId: "voice-1" } as never);

        await player.search({ query: "hello", requester: {} });

        expect(searchSpy).toHaveBeenCalledWith({ query: "hello", node: player.node, requester: {} });
    });
});
