import { describe, expect, it, vi } from "vitest";

import { PlayerVoiceState } from "../src/classes/player/Voice";

type VoiceTestPlayer = {
    guildId: string;
    voiceId: string | undefined;
    selfDeaf: boolean;
    selfMute: boolean;
    connected: boolean;
    options: { voiceId: string | undefined };
    manager: {
        options: {
            sendPayload: ReturnType<typeof vi.fn>;
        };
        emit: ReturnType<typeof vi.fn>;
    };
};

function createPlayer(): VoiceTestPlayer {
    return {
        guildId: "guild-1",
        voiceId: "voice-1",
        selfDeaf: true,
        selfMute: false,
        connected: false,
        options: { voiceId: "voice-1" },
        manager: {
            options: {
                sendPayload: vi.fn().mockResolvedValue(undefined),
            },
            emit: vi.fn(),
        },
    };
}

describe("PlayerVoiceState", () => {
    it("patch/reset and toJSON/toNode behave as expected", () => {
        const voice = new PlayerVoiceState(createPlayer() as never);

        voice.patch({ endpoint: "endpoint", sessionId: "session", token: "token", channelId: "voice-1" });

        expect(voice.toJSON()).toEqual({ endpoint: "endpoint", sessionId: "session", token: "token", channelId: "voice-1" });
        expect(voice.toNode()).toEqual({ endpoint: "endpoint", sessionId: "session", token: "token", channelId: "voice-1" });

        voice.reset();
        expect(voice.toNode()).toBeNull();
    });

    it("setState sends payload and updates player/voice fields", async () => {
        const player = createPlayer();
        const voice = new PlayerVoiceState(player as never);

        await voice.setState({ voiceId: "voice-2", selfMute: true, selfDeaf: false });

        expect(player.voiceId).toBe("voice-2");
        expect(player.selfMute).toBe(true);
        expect(player.selfDeaf).toBe(false);
        expect(player.manager.options.sendPayload).toHaveBeenCalledWith("guild-1", {
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
        const playerA = createPlayer();
        playerA.connected = true;

        const voiceA = new PlayerVoiceState(playerA as never);
        await voiceA.connect();
        expect(playerA.manager.options.sendPayload).not.toHaveBeenCalled();

        const playerB = createPlayer();
        playerB.voiceId = undefined;

        const voiceB = new PlayerVoiceState(playerB as never);
        await voiceB.connect();
        expect(playerB.manager.options.sendPayload).not.toHaveBeenCalled();
    });

    it("disconnect/move/mute/deaf paths update state", async () => {
        const player = createPlayer();
        const voice = new PlayerVoiceState(player as never);

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
        const player = createPlayer();
        player.manager.options.sendPayload.mockRejectedValueOnce(new Error("gateway unavailable"));

        const voice = new PlayerVoiceState(player as never);

        await expect(voice.setState({ voiceId: "voice-9" })).rejects.toThrow("gateway unavailable");
    });

    it("connect rejects when state update fails", async () => {
        const player = createPlayer();
        player.manager.options.sendPayload.mockRejectedValueOnce(new Error("cannot send payload"));

        const voice = new PlayerVoiceState(player as never);

        await expect(voice.connect()).rejects.toThrow("cannot send payload");
        expect(player.connected).toBe(false);
    });
});
