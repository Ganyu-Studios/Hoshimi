import { Command, type CommandContext, Declare, Embed } from "seyfert";

@Declare({
	name: "move",
	description: "Move a track in the queue.",
})
export default class MoveCommand extends Command {
	public override async run(ctx: CommandContext) {
		const { client } = ctx;

		const player = client.manager.getPlayer(ctx.guildId!);
		if (!player)
			return ctx.write({
				content: "There is no player in this guild",
			});

		if (!player.queue.size) return ctx.editOrReply({ content: "The queue is empty" });

		const track = player.queue.tracks[0];
		if (!track) return ctx.editOrReply({ content: "There is no track in the queue" });

		player.queue.moveTrack(track, 5);

		await ctx.editOrReply({ content: "Moved the track to the 5th position in the queue" });
	}
}
