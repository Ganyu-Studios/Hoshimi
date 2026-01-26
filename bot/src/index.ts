import "dotenv/config";

import { createHoshimi, type Hoshimi, type LyricsResult, Player, SearchEngines, Structures } from "hoshimi";
import { Client, type ParseClient, type UsingClient } from "seyfert";
import { HandleCommand } from "seyfert/lib/commands/handle.js";
import { Yuna } from "yunaforseyfert";
import { autoplayFn } from "./autoplay.js";
import { LavalinkHandler } from "./manager/handler.js";
import { Sessions } from "./manager/sessions.js";
import { RedisStorage } from "./manager/storage.js";
import type { HoshimiUser } from "./manager/types.js";
import { RedisClient } from "./redis.js";

/**
 * The main client of the bot.
 * @type {Client<true> & UsingClient}
 */
const client: Client<true> & UsingClient = new Client({
    allowedMentions: {
        parse: ["roles", "users"],
        replied_user: false,
    },
    commands: {
        prefix: () => ["hoshimi", "h."],
        reply: () => true,
        deferReplyResponse: ({ client }) => ({
            content: `**${client.me.username}** is thinking...`,
        }),
    },
}) as Client<true> & UsingClient;

/**
 * The Redis client instance.
 * @type {RedisClient}
 */
const redis: RedisClient = new RedisClient(client);

// Initialize the manager with a helper function.
client.manager = createHoshimi({
    sendPayload: (guildId, payload) => client.gateway.send(client.gateway.calculateShardId(guildId), payload),
    defaultSearchEngine: SearchEngines.Spotify,
    nodeOptions: {
        resumable: true,
        resumeByLibrary: true,
    },
    queueOptions: {
        autoplayFn,
        storage: new RedisStorage(redis),
    },
    playerOptions: {
        onDisconnect: {
            autoDestroy: true,
        },
    },
    nodes: Sessions.resolve({
        host: "localhost",
        port: 2333,
        password: "ganyuontopuwu",
    }),
});

// Set the client services.
client.setServices({
    handleCommand: class extends HandleCommand {
        override argsParser = Yuna.parser({
            syntax: {
                namedOptions: ["-", "--"],
            },
        });
    },
});

// Extend the player with whatever you want.
class HoshimiPlayer extends Player {}

// Override the player structure.
Structures.Player = (...args) => new HoshimiPlayer(...args);

/**
 * The lavalink handler of the bot.
 * @type {LavalinkHandler}
 */
const handler: LavalinkHandler = new LavalinkHandler(client);

// The main process of the bot.
(async (): Promise<void> => {
    // Start the lavalink handler, redis and the client.
    await redis.start();
    await handler.start();
    await client.start();
})();

declare module "seyfert" {
    interface UsingClient extends ParseClient<Client<true>> {}

    interface InternalOptions {
        withPrefix: true;
    }

    interface Client {
        manager: Hoshimi;
    }

    interface ExtendedRCLocations {
        lavalink: string;
    }
}

declare module "hoshimi" {
    interface CustomizableTrack {
        requester: HoshimiUser;
    }

    interface CustomizablePlayerStorage {
        enabledAutoplay: boolean;
        enabledLyrics: boolean;
        lyricsId: string;
        lyrics: LyricsResult;
    }

    interface CustomizableStructures {
        Player: HoshimiPlayer;
    }

    interface CustomizableOptions {
        supportNodelink: true;
    }
}
