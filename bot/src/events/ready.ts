import { createEvent } from "seyfert";

export default createEvent({
	data: { name: "ready", once: true },
	run: async (user, client) => {
		await client.uploadCommands({ cachePath: "commands.json" });
		client.logger.info(`Logged in as: ${user.username}`);
	},
});
