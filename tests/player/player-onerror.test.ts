import { describe, expect, it, vi } from "vitest";
import { Track } from "../../src/classes/Track";
import { DestroyReasons } from "../../src/types/Manager";
import { PlayerEventType, TrackEndReason } from "../../src/types/Player";
import { createMockTrackData, createRealManager, createRealPlayer } from "../helpers";

const exceptionPayload = (guildId: string) =>
    ({
        op: "event",
        type: PlayerEventType.TrackException,
        guildId,
        track: createMockTrackData(),
        exception: { message: "boom", severity: "common", cause: "test" },
    }) as never;

const endPayload = (guildId: string) =>
    ({
        op: "event",
        type: PlayerEventType.TrackEnd,
        guildId,
        track: createMockTrackData(),
        reason: TrackEndReason.LoadFailed,
    }) as never;

describe("Player onError", () => {
    it("autoDestroy destroys the player on track error", async () => {
        const manager = createRealManager({ playerOptions: { onError: { autoDestroy: true } } });
        const { trackError } = await import("../../src/util/events/player");
        const player = createRealPlayer(manager);

        const destroySpy = vi.spyOn(player, "destroy").mockResolvedValue();

        await trackError.call(player, exceptionPayload(player.guildId));

        expect(destroySpy).toHaveBeenCalledWith({ reason: DestroyReasons.TrackError });
    });

    it("autoStop halts playback and suppresses the trailing track end", async () => {
        const manager = createRealManager({ playerOptions: { onError: { autoStop: true } } });
        const { trackEnd, trackError } = await import("../../src/util/events/player");
        const player = createRealPlayer(manager);

        player.playing = true;
        player.queue.current = new Track(createMockTrackData() as never, {});
        player.queue.tracks.push(new Track(createMockTrackData({ encoded: "next" }) as never, {}));

        await trackError.call(player, exceptionPayload(player.guildId));

        expect(player.playing).toBe(false);
        expect(player.queue.current).toBeNull();
        expect(await player.data.get("internal_errorStopped")).toBe(true);

        const playSpy = vi.spyOn(player, "play");
        await trackEnd.call(player, endPayload(player.guildId));

        // The trailing TrackEnd(loadFailed) was swallowed: queue was not advanced.
        expect(playSpy).not.toHaveBeenCalled();
        expect(player.queue.tracks).toHaveLength(1);
        expect(await player.data.get("internal_errorStopped")).toBeUndefined();
    });

    it("default behaviour neither destroys nor stops the player", async () => {
        const manager = createRealManager();
        const { trackError } = await import("../../src/util/events/player");
        const player = createRealPlayer(manager);

        const destroySpy = vi.spyOn(player, "destroy").mockResolvedValue();
        player.playing = true;

        await trackError.call(player, exceptionPayload(player.guildId));

        expect(destroySpy).not.toHaveBeenCalled();
        expect(player.playing).toBe(true);
        expect(await player.data.get("internal_errorStopped")).toBeUndefined();
    });
});
