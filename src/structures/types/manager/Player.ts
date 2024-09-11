import type { Node } from "shoukaku";
import type { Track } from "../../classes";

/**
 * Player loop mode types enum.
 */
export enum LoopMode {
	Off = 0,
	Track = 1,
	Queue = 2,
}

/**
 * Youtube thumbnail resolutions enum.
 */
export enum YoutubeResolutions {
	Default = "default",
	HQ = "hqdefault",
	MQ = "mqdefault",
	SD = "sddefault",
	HD = "maxresdefault",
}

/**
 * Player options without node.
 */
//TODO: Find a better name for this. 🐐
export type NonNodePlayerOptions = Omit<PlayerOptions, "node">;

/**
 * Player create options.
 */
export type PlayerOptions = {
	/**
	 * Guild id of the player.
	 */
	guildId: string;
	/**
	 * Voice channel id of the player.
	 */
	voiceId: string;

	/**
	 * Volume of the player.
	 */
	volume?: number;
	/**
	 * Set if the player should be deafened.
	 */
	selfDeaf?: boolean;
	/**
	 * Set if the player should be muted.
	 */
	selfMute?: boolean;
	/**
	 * Text channel id of the player.
	 */
	textId?: string;
	/**
	 * Shard id of the player.
	 */
	shardId?: number;
	/**
	 * Lavalink node of the player.
	 */
	node?: string | Node;
};

/**
 * Player play options.
 */
export type PlayOptions = {
	/**
	 * Volume of the player.
	 * @default false
	 */
	volume?: number;
	/**
	 * Pause the player.
	 * @default false
	 */
	pause?: boolean;
	/**
	 * Whether to replace the current track.
	 * @default false
	 */
	noReplace?: boolean;
	/**
	 * Track to play.
	 */
	track?: Track;
};
