import { EventNames, type PlayerStructure } from "hoshimi";
import { createLavalinkEvent } from "../../manager/events.js";
import { Sessions } from "../../manager/sessions.js";
import type { SessionJson } from "../../manager/types.js";

export default createLavalinkEvent({
    name: EventNames.NodeResumed,
    async run(client, node, players, payload) {
        client.logger.debug(`[Hoshimi] Node resumed: ${node.id} with ${players.length} players. | Payload: ${JSON.stringify(payload)}`);

        for (const data of players) {
            const session: SessionJson | undefined = Sessions.get<SessionJson>(data.guildId);
            if (!session) continue;

            if (!data.state.connected) {
                Sessions.delete(data.guildId);
                continue;
            }

            const player: PlayerStructure = client.manager.createPlayer({
                node,
                guildId: data.guildId,
                voiceId: session.voiceId!,
                textId: session.textId!,
                selfDeaf: session.selfDeaf,
                selfMute: session.selfMute,
                volume: data.volume,
            });

            player.voice.patch(data.voice);

            await player.connect();
            await player.queue.utils.sync(true, false);

            if (data.track) player.queue.current = await player.queue.utils.build(data.track, session.requester);

            if (session.enabledAutoplay) await player.data.set("enabledAutoplay", session.enabledAutoplay);
            if (session.enabledLyrics) await player.data.set("enabledLyrics", session.enabledLyrics);
            if (session.lyricsId) await player.data.set("lyricsId", session.lyricsId);

            player.loop = session.loop;
            player.filterManager.data = data.filters;
            player.connected = data.state.connected;
            player.paused = data.paused;
            player.lastPosition = data.state.position;
            player.lastPositionUpdate = Date.now();
            player.playing = !data.paused && !!data.track;
            player.ping = data.state.ping;

            if (!player.isPlaying() && player.queue.current) await player.play();

            await player.queue.utils.save();
        }
    },
});
