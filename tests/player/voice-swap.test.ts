import { describe, expect, it, vi } from "vitest";
import { createRealManager, createRealNode, createRealPlayer } from "../helpers";

/**
 * Discord reallocates a guild's voice server every so often on its own, sending a VOICE_SERVER_UPDATE
 * with a null endpoint first — the current server is going away — then another with the new one. The
 * null update carries a fresh token but no usable endpoint, so acting on it would push the new token
 * onto the stale endpoint and point Lavalink at a server that no longer exists.
 */
describe("voice server reallocation", () => {
    async function connect() {
        const manager = createRealManager();
        manager.ready = true;
        manager.options.client = { id: "bot-1", username: "probe" };

        const node = createRealNode(manager);
        const player = createRealPlayer(manager);
        player.voiceId = "voice-1";

        const updatePlayer = vi.spyOn(node.rest, "updatePlayer").mockResolvedValue(null);

        await manager.updateVoiceState({
            t: "VOICE_STATE_UPDATE",
            d: { guild_id: "guild-1", user_id: "bot-1", session_id: "sess-A", channel_id: "voice-1" },
        } as never);
        await manager.updateVoiceState({
            t: "VOICE_SERVER_UPDATE",
            d: { guild_id: "guild-1", token: "token-A", endpoint: "old.discord.media:443" },
        } as never);

        updatePlayer.mockClear();

        return { manager, player, updatePlayer };
    }

    it("ignores the null-endpoint update instead of pushing a stale one", async () => {
        const { manager, player, updatePlayer } = await connect();

        await manager.updateVoiceState({
            t: "VOICE_SERVER_UPDATE",
            d: { guild_id: "guild-1", token: "token-B", endpoint: null },
        } as never);

        // Nothing goes to Lavalink, and neither the endpoint nor the token is disturbed: they still
        // describe the live connection until a real endpoint replaces them.
        expect(updatePlayer).not.toHaveBeenCalled();
        expect(player.voice.endpoint).toBe("old.discord.media:443");
        expect(player.voice.token).toBe("token-A");
    });

    it("applies the follow-up update that carries the new endpoint", async () => {
        const { manager, player, updatePlayer } = await connect();

        await manager.updateVoiceState({
            t: "VOICE_SERVER_UPDATE",
            d: { guild_id: "guild-1", token: "token-B", endpoint: null },
        } as never);
        await manager.updateVoiceState({
            t: "VOICE_SERVER_UPDATE",
            d: { guild_id: "guild-1", token: "token-B", endpoint: "new.discord.media:443" },
        } as never);

        expect(player.voice.endpoint).toBe("new.discord.media:443");
        expect(player.voice.token).toBe("token-B");
        expect(updatePlayer).toHaveBeenCalledTimes(1);

        const sent = (updatePlayer.mock.calls[0]![0] as { playerOptions: { voice: unknown } }).playerOptions.voice;
        expect(sent).toEqual({
            endpoint: "new.discord.media:443",
            sessionId: "sess-A",
            token: "token-B",
            channelId: "voice-1",
        });
    });
});
