import { describe, expect, it, vi } from "vitest";
import { Structures } from "../../src/types/Structures";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "../helpers";

function setup() {
    const manager = createRealManager({ playerOptions: { onDisconnect: { autoReconnect: true } } } as never);
    createRealNode(manager);
    const player = createRealPlayer(manager);

    manager.ready = true;
    manager.options.client.id = "bot";

    player.connected = true;
    player.voice.patch({ endpoint: "endpoint", sessionId: "session", token: "token", channelId: "voice-1" });
    player.queue.current = Structures.Track(createMockTrackData() as never, {});

    const sendPayload = vi.mocked(manager.options.sendPayload);
    sendPayload.mockClear();

    const left = () =>
        manager.updateVoiceState({
            t: "VOICE_STATE_UPDATE",
            d: { guild_id: player.guildId, user_id: "bot", channel_id: null, session_id: "session" },
        } as never);

    return { manager, player, sendPayload, left };
}

describe("onDisconnect.autoReconnect", () => {
    it("rejoins the channel and replays the current track where it was", async () => {
        const { player, sendPayload, left } = setup();
        const play = vi.spyOn(player, "play").mockResolvedValue();
        player.paused = true;
        player.lastPosition = 42_000;
        player.lastPositionUpdate = null;

        await left();

        expect(sendPayload).toHaveBeenCalledWith(
            player.guildId,
            expect.objectContaining({ d: expect.objectContaining({ channel_id: "voice-1" }) }),
        );
        expect(player.connected).toBe(true);
        // The old session, token and endpoint are dropped: the join brings new ones.
        expect(player.voice.toNode()).toBeNull();
        expect(play).toHaveBeenCalledWith({ track: player.queue.current, paused: true, position: 42_000 });
    });

    it("does not undo a disconnect of our own", async () => {
        const { player, sendPayload, left } = setup();
        const play = vi.spyOn(player, "play").mockResolvedValue();

        await player.disconnect();
        sendPayload.mockClear();

        await left();

        expect(sendPayload).not.toHaveBeenCalled();
        expect(play).not.toHaveBeenCalled();
        expect(player.connected).toBe(false);
    });

    it("rejoins but does not start the queue when nothing was playing", async () => {
        const { player, sendPayload, left } = setup();
        const play = vi.spyOn(player, "play").mockResolvedValue();

        player.queue.current = null;
        player.queue.tracks = [Structures.Track(createMockTrackData({ encoded: "next" }) as never, {})];

        await left();

        expect(sendPayload).toHaveBeenCalledWith(
            player.guildId,
            expect.objectContaining({ d: expect.objectContaining({ channel_id: "voice-1" }) }),
        );
        expect(play).not.toHaveBeenCalled();
        expect(player.queue.size).toBe(1);
    });

    it("destroys the player and stops there when replaying fails", async () => {
        const { manager, player, left } = setup();
        vi.spyOn(player, "play").mockRejectedValue(new Error("node down"));
        const playerError = vi.fn();
        manager.on("playerError", playerError);

        await left();

        expect(playerError).toHaveBeenCalledWith(player, expect.objectContaining({ message: "node down" }));
        expect(player.destroyed).toBe(true);
    });
});
