import { config } from "seyfert";

export default config.bot({
	token: process.env.TOKEN ?? "The knave",
	intents: ["Guilds", "MessageContent", "GuildMessages", "GuildVoiceStates", "GuildMembers"],
	locations: {
		base: "src",
		output: "src",
		events: "events",
		commands: "commands",
	},
});
