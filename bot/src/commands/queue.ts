import { Command, type CommandContext, Declare, Embed } from "seyfert";

@Declare({
	name: "queue",
	description: "Show the queue.",
})
export default class QueueCommand extends Command {
	public override async run(ctx: CommandContext) {
		const { client } = ctx;

		const player = client.manager.getPlayer(ctx.guildId!);
		if (!player)
			return ctx.write({
				content: "There is no player in this guild",
			});

		if (!player.queue.size) return ctx.editOrReply({ content: "The queue is empty" });

		const tracks = player.queue.tracks
			.map((track, i) => `**${i + 1}.** ${track.info.title}`)
			.slice(0, 25);

		await ctx.editOrReply({ content: `**Queue**\n\n${tracks.join("\n")}` });
	}
}
