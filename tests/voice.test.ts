import { describe, expect, it, vi } from "vitest";

import { PlayerVoiceState } from "../src/classes/player/Voice";
import { createRealManager, createRealNode, createRealPlayer } from "./helpers";

describe("PlayerVoiceState", () => {
    it("patch/reset and toJSON/toNode behave as expected", () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const voice = player.voice;

        voice.patch({ endpoint: "endpoint", sessionId: "session", token: "token", channelId: "voice-1" });

        expect(voice.toJSON()).toEqual({ endpoint: "endpoint", sessionId: "session", token: "token", channelId: "voice-1" });
        expect(voice.toNode()).toEqual({ endpoint: "endpoint", sessionId: "session", token: "token", channelId: "voice-1" });

        voice.reset();
        expect(voice.toNode()).toBeNull();
    });

    it("setState sends payload and updates player/voice fields", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const voice = player.voice;

        await voice.setState({ voiceId: "voice-2", selfMute: true, selfDeaf: false });

        expect(player.voiceId).toBe("voice-2");
        expect(player.selfMute).toBe(true);
        expect(player.selfDeaf).toBe(false);
        expect(manager.options.sendPayload).toHaveBeenCalledWith("guild-1", {
            op: 4,
            d: {
                guild_id: "guild-1",
                self_deaf: false,
                self_mute: true,
                channel_id: "voice-2",
            },
        });
    });

    it("connect returns early when already connected or no voice channel", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const playerA = createRealPlayer(manager);
        playerA.connected = true;

        const voiceA = playerA.voice;
        await voiceA.connect();
        expect(manager.options.sendPayload).not.toHaveBeenCalled();

        const playerB = createRealPlayer(manager, { guildId: "guild-2" });
        playerB.voiceId = undefined as never;
        const voiceB = playerB.voice;
        await voiceB.connect();
        expect(manager.options.sendPayload).not.toHaveBeenCalled();
    });

    it("disconnect/move/mute/deaf paths update state", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        const voice = player.voice;

        await voice.disconnect();
        expect(player.voiceId).toBeUndefined();

        await voice.move("voice-3");
        expect(player.voiceId).toBe("voice-3");

        await voice.mute(true);
        expect(player.selfMute).toBe(true);

        await voice.deaf(false);
        expect(player.selfDeaf).toBe(false);
    });

    it("setState propagates sendPayload failures", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        (manager.options.sendPayload as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("gateway unavailable"));

        const voice = player.voice;

        await expect(voice.setState({ voiceId: "voice-9" })).rejects.toThrow("gateway unavailable");
    });

    it("connect rejects when state update fails", async () => {
        const manager = createRealManager();
        createRealNode(manager);
        const player = createRealPlayer(manager);
        (manager.options.sendPayload as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("cannot send payload"));

        const voice = player.voice;

        await expect(voice.connect()).rejects.toThrow("cannot send payload");
        expect(player.connected).toBe(false);
    });
});
