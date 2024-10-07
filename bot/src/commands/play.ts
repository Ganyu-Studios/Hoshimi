import { Command, type CommandContext, createStringOption, Declare, Options } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { LoadType } from "shoukaku";
import { LoopMode } from "hoshimi";

const options = {
	query: createStringOption({
		description: "Query to search.",
		required: true,
	}),
};

@Declare({
	name: "play",
	description: "Play songs!",
})
@Options(options)
export default class PlayCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { options, client } = ctx;

		if (!client.manager.isUseable())
			return ctx.editOrReply({ content: "I'm not connected to any node." });

		const voice = await ctx.member?.voice();
		if (!voice) return ctx.editOrReply({ content: "You need to be in a voice channel first." });

		const player = await client.manager.createPlayer({
			guildId: ctx.guildId!,
			voiceId: voice.channelId!,
			shardId: ctx.shardId,
			textId: ctx.channelId,
			selfDeaf: true,
			volume: 100,
		});

		const res = await player.search(options.query, { requester: ctx.author });

		player.set("enabledAutoplay", true);
		player.set("commandContext", ctx);

		if (res.loadType === LoadType.SEARCH || res.loadType === LoadType.TRACK) {
			const track = res.tracks[0];
			if (!track) return;

			player.queue.add(track);

			await player.play({ noReplace: true });
			await ctx.editOrReply({
				content: `Added: ${track.toHyperlink()} (${track.formatDuration()})`,
			});
		} else if (res.loadType === LoadType.PLAYLIST) {
			const playlist = res.playlist;
			if (!playlist) return;

			player.queue.add(res.tracks);

			await player.play({ noReplace: true });
			await ctx.editOrReply({
				content: `Added: ${playlist.name} (${res.tracks.length} tracks)`,
			});
		} else if (res.loadType === LoadType.ERROR) {
			console.info(res);
		}
	}
}
