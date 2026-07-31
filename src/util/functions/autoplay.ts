import type { TrackResolvableStructure } from "../../classes/Track";
import { type QueryResult, SearchSources } from "../../types/Manager";
import { SourceNames } from "../../types/Node";
import type { PlayerStructure, TrackStructure } from "../../types/Structures";

/**
 * The maximum number of tracks to be added to the queue.
 * @type {number}
 * @default 10
 */
const limit: number = 10;

/**
 *
 * The autoplay function for the player.
 * @param {PlayerStructure} player The player for the autoplay function.
 * @param {TrackResolvableStructure | null} lastTrack The last track that was played.
 * @returns {Promise<void>} The promise for the autoplay function.
 */
export async function autoplayFn(player: PlayerStructure, lastTrack: TrackResolvableStructure | null): Promise<void> {
    if (!lastTrack) return;

    const isEnabled: boolean = !!(await player.data.get("enabledAutoplay")) || player.manager.options.queueOptions.autoPlay;
    if (!isEnabled) return;

    /**
     *
     * Filter the tracks to remove the last track and the previous tracks.
     * @param {TrackStructure[]} tracks The tracks to filter.
     * @returns {TrackStructure[]} The filtered tracks.
     */
    const filter = (tracks: TrackStructure[]): TrackStructure[] =>
        tracks.filter(
            (track): boolean =>
                !(
                    player.queue.history.some((t) => t.info.identifier === track.info.identifier) ||
                    lastTrack.info.identifier === track.info.identifier
                ),
        );

    switch (lastTrack.info.sourceName) {
        case SourceNames.Spotify: {
            const filtered: TrackStructure[] = player.queue.history
                .filter(({ info }): boolean => info.sourceName === SourceNames.Spotify)
                .slice(0, 1);
            if (!filtered.length) filtered.push(lastTrack as TrackStructure);

            const ids: string[] = filtered.map(
                ({ info }): string => info.identifier ?? info.uri?.split("/").reverse()?.[0] ?? info.uri?.split("/").reverse()?.[1],
            );
            const { tracks }: QueryResult = await player.search({
                query: `seed_tracks=${ids.join(",")}`,
                source: SearchSources.SpotifyRecommendations,
                requester: lastTrack.requester,
            });

            const candidates: TrackStructure[] = filter(tracks);

            if (candidates.length) {
                const index: number = Math.floor(Math.random() * candidates.length);

                const track: TrackStructure | undefined = candidates[index];
                if (!track) return;

                await player.queue.add(track);
            }
            break;
        }

        case SourceNames.Youtube:
        case SourceNames.YoutubeMusic: {
            const query = `https://www.youtube.com/watch?v=${lastTrack.info.identifier}&list=RD${lastTrack.info.identifier}`;
            const search: QueryResult = await player.search({ query, requester: lastTrack.requester });

            const candidates: TrackStructure[] = filter(search.tracks);

            if (candidates.length) {
                // Start from a random offset, pulled back so a start near the end still yields up to `limit`.
                const start: number = Math.max(0, Math.min(Math.floor(Math.random() * candidates.length), candidates.length - limit));
                const tracks: TrackStructure[] = candidates.slice(start, start + limit);

                await player.queue.add(tracks);
            }
        }
    }
}
