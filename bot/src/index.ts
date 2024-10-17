process.loadEnvFile();

import { Client, type User, type ParseClient } from "seyfert";
import { Yuna } from "yunaforseyfert";

import { HandleCommand } from "seyfert/lib/commands/handle.js";

const nodes: NodeOption[] = [
	{
		name: "AN #0",
		auth: "ganyuontopuwu",
		url: "localhost:2333",
	},
];
const prefixes: string[] = ["arle", "arlecchino"];

class TestClient extends Client<true> {
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

declare module "seyfert" {
	interface UsingClient extends ParseClient<TestClient> {}
}
