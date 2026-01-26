import type { LyricsLine, LyricsResult } from "../../../types/Node";
import type { NodelinkLyrics } from "../../../types/Nodelink";
import { HttpMethods } from "../../../types/Rest";
import type { Track } from "../../Track";
import { LyricsManager } from "../Lyrics";

export class NodelinkLyricsManager extends LyricsManager {
    public override async get(track: Track, skipSource?: boolean): Promise<LyricsResult | null> {
        const lyrics = await this.node.rest.request<NodelinkLyrics>({
            endpoint: "/loadlyrics",
            params: {
                encodedTrack: track.encoded,
                skipSource: `${skipSource ?? false}`,
            },
        });

        if (!lyrics || !lyrics.data.lines.length) return null;

        const lines: LyricsLine[] = lyrics.data.lines.map((line) => ({
            line: line.text,
            duration: line.duration ?? 0,
            timestamp: line.time ?? 0,
            plugin: {},
        }));

        return {
            lines,
            plugin: {},
            provider: lyrics.data.provider || "unknown",
            sourceName: lyrics.data.source || "unknown",
            text: null,
        };
    }

    public override current(guildId: string, skipSource?: boolean): Promise<LyricsResult | null> {
        const player = this.node.nodeManager.manager.getPlayer(guildId);
        if (!player) return Promise.resolve(null);

        const current = player.queue.current;
        if (!current) return Promise.resolve(null);

        return this.get(current, skipSource);
    }

    public override async subscribe(guildId: string, skipSource: boolean = false): Promise<void> {
        if (!this.node.sessionId) return;

        await this.node.rest.request({
            endpoint: `/sessions/${this.node.sessionId}/players/${guildId}/lyrics/subscribe`,
            method: HttpMethods.Post,
            params: {
                skipTrackSource: `${skipSource}`,
            },
        });
    }

    public override async unsubscribe(guildId: string): Promise<void> {
        if (!this.node.sessionId) return;

        await this.node.rest.request({
            endpoint: `/sessions/${this.node.sessionId}/players/${guildId}/lyrics/subscribe`,
            method: HttpMethods.Delete,
        });
    }
}
