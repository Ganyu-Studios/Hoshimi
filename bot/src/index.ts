process.loadEnvFile();

import { Client, type User, type ParseClient } from "seyfert";
import { Connectors, type NodeOption } from "shoukaku";
import { Yuna } from "yunaforseyfert";

import { autoplayFn } from "./autoplay";

import { HandleCommand } from "seyfert/lib/commands/handle.js";
import { Manager, SearchEngines } from "hoshimi";

const nodes: NodeOption[] = [
	{
		name: "AN #0",
		auth: "ganyuontopuwu",
		url: "localhost:2333",
	},
];
const prefixes: string[] = ["arle", "arlecchino"];

class TestClient extends Client<true> {
	readonly manager: Manager;

	constructor() {
		super({
			allowedMentions: {
				replied_user: false,
			},
			commands: {
				prefix: () => prefixes,
				reply: () => true,
				deferReplyResponse: (ctx) => ({
					content: `**${ctx.client.me.username}** is thinking...`,
				}),
			},
		});

		this.manager = new Manager(
			new Connectors.Seyfert(this),
			{
				nodes,
				sendPayload: (guildId, payload) =>
					this.gateway.send(this.gateway.calculateShardId(guildId), payload),
				maxPreviousTracks: 10,
				defaultSearchEngine: SearchEngines.Youtube,
				autoplayFn,
			},
			{
				reconnectTries: 5,
				resume: true,
				resumeByLibrary: true,
				resumeTimeout: 60000,
			},
		);

		this.run();
	}

	private async run() {
		this.setServices({
			handleCommand: class extends HandleCommand {
				override argsParser = Yuna.parser();
			},
		});

		await this.start();
	}
}

const client = new TestClient();

//
// Node Events
//
client.manager.shoukaku.on("ready", (name) =>
	client.logger.info(`Lavalink node: ${name} connected.`),
);
client.manager.shoukaku.on("error", (name, error) =>
	client.logger.info(`Lavalink node: ${name} has an error: ${error}.`),
);
client.manager.shoukaku.on("disconnect", (name, retries) =>
	client.logger.info(`Lavalink node: ${name} is disconnected: Retries: ${retries}.`),
);
client.manager.shoukaku.on("reconnecting", (name, left) =>
	client.logger.info(`Lavalink node: ${name} is reconnecting: Left: ${left}.`),
);

//
// Manager Events
//
client.manager.on("trackStart", (player, track) => {
	if (!track) return;

	const requester = track.requester as User;

	client.messages.write(player.textId!, {
		content: `Now playing: ${track.toHyperlink()}\nRequested by: ${requester.tag}`,
	});
});
client.manager.on("trackEnd", (player, track) => {
	if (!track) return;

	client.messages.write(player.textId!, {
		content: `Song ended: ${track.info.title}`,
	});
});
client.manager.on("queueEnd", (player) => {
	client.messages.write(player.textId!, {
		content: "Queue ended",
	});
});

client.manager.on("debug", (message) => client.logger.info(message));

declare module "seyfert" {
	interface UsingClient extends ParseClient<TestClient> {}
}
