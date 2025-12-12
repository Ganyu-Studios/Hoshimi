import { Events, Track } from "hoshimi";
import { createLavalinkEvent } from "../../manager/events";

export default createLavalinkEvent({
    name: Events.NodeResumed,
    async run(client, node, players, payload) {
        client.logger.debug(`[Hoshimi] Node resumed: ${node.id} with ${players.length} players. | Payload: ${JSON.stringify(payload)}`);

        for (const data of players) {
            const player = client.manager.createPlayer({
                guildId: data.guildId,
                voiceId: "1222873458778570814",
                textId: "1228578969184632882",
                node: node.id,
                selfDeaf: true,
                selfMute: false,
                volume: data.volume,
            });

            player.voice = data.voice;

            await player.connect();
            //await player.queue.utils.sync(true, false);

            if (data.track) player.queue.current = new Track(data.track);

            player.connected = data.state.connected;
            player.paused = data.paused;
            player.lastPosition = data.state.position;
            player.lastPositionUpdate = Date.now();
            player.playing = !data.paused && !!data.track;
            player.ping = data.state.ping;

            if (!player.playing) await player.play();
        }
    },
});
