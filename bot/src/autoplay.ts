import { type Player, type Track, SourceNames, SearchEngines } from "hoshimi";
import type { CommandContext } from "seyfert";

const maxTracks = 10;

/**
 * Based on:
 * https://github.com/Tomato6966/lavalink-client/blob/main/testBot/Utils/OptionalFunctions.ts#L18
 *
 * Modified by: https://github.com/NoBody-UU/
 */

/**
 *
 * An autoplay function, that's all.
 * @param player
 * @param lastTrack
 * @returns
 */
export async function autoplayFn(player: Player, lastTrack: Track | null): Promise<void> {
	if (!lastTrack) return;
	if (!player.get("enabledAutoplay")) return;

	const ctx = player.get<CommandContext>("commandContext");
	if (!ctx) return;

	const bot = ctx.me();
	if (!bot) return;

	const filterTracks = (tracks: Track[]) =>
		tracks.filter(
			(track) =>
				!(
					player.queue.previous.some(
						(t) => t.info.identifier === track.info.identifier,
					) || lastTrack.info.identifier === track.info.identifier
				),
		);

	const requester = bot.user;

	if (lastTrack.info.sourceName === SourceNames.Spotify) {
		const filtered = player.queue.previous
			.filter(({ info }) => info.sourceName === SourceNames.Spotify)
			.slice(0, 1);
		if (!filtered.length) filtered.push(lastTrack);

		const ids = filtered.map(
			({ info }) =>
				info.identifier ??
				info.uri?.split("/").reverse()?.[0] ??
				info.uri?.split("/").reverse()?.[1],
		);
		const res = await player.search(`seed_tracks=${ids.join(",")}`, {
			requester,
			engine: SearchEngines.SpotifyRecommendations,
		});

		if (res.tracks.length) {
			const track = filterTracks(res.tracks)[
				Math.floor(Math.random() * res.tracks.length)
			] as Track;
			player.queue.add(track);
		}
	} else if (
		[SourceNames.Youtube, SourceNames.YoutubeMusic].includes(lastTrack.info.sourceName)
	) {
		const search = `https://www.youtube.com/watch?v=${lastTrack.info.identifier}&list=RD${lastTrack.info.identifier}`;
		const res = await player.search(search, { requester });

		if (res.tracks.length) {
			const random = Math.floor(Math.random() * res.tracks.length);
			const tracks = filterTracks(res.tracks).slice(random, random + maxTracks) as Track[];
			player.queue.add(tracks);
		}
	}
}
