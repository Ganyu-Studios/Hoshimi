import type { Track as ShoukakuTrack } from "shoukaku";
import { SourceNames, type YoutubeResolutions } from "../../types";
import { TimeFormat } from "../../utils";

/**
 * Track with source name.
 */
interface TrackWithSource extends Omit<ShoukakuTrack, "info"> {
	info: Omit<ShoukakuTrack["info"], "sourceName"> & { sourceName: SourceNames };
}

/**
 * Main Track class.
 */
export class Track implements TrackWithSource {
	/**
	 * Encoded track.
	 */
	readonly encoded: string;
	/**
	 * Plugin info.
	 */
	readonly pluginInfo: unknown;
	/**
	 * Track info.
	 */
	readonly info: TrackWithSource["info"];

	/**
	 * Requester of the track.
	 */
	public requester: unknown;

	/**
	 *
	 * Constructor of the track.
	 * @param track The shoukaku track.
	 * @param requester The requester of the track.
	 */
	constructor(track: ShoukakuTrack, requester: unknown) {
		this.encoded = track.encoded;
		this.pluginInfo = track.pluginInfo;
		this.requester = requester;
		this.info = track.info as TrackWithSource["info"];
	}

	/**
	 *
	 * Get the hyperlink of the track.
	 * @returns {string} The hyperlink of the track.
	 */
	public toHyperlink(): string {
		return `[${this.info.title}](${this.info.uri})`;
	}

	/**
	 *
	 * Get the formatted duration of the track.
	 * @returns {string} The formatted duration of the track.
	 */
	public formatDuration(): string {
		return TimeFormat.toDotted(this.info.length);
	}

	/**
	 *
	 * Get the artwork of the track.
	 * @param resolution The resolution of the artwork.
	 * @returns {string} The artwork.
	 */
	public getArtwork(resolution?: YoutubeResolutions): string | undefined {
		if (
			([SourceNames.Youtube, SourceNames.YoutubeMusic] as SourceNames[]).includes(
				this.info.sourceName,
			)
		)
			return `https://i.ytimg.com/vi/${this.info.identifier}/${resolution ?? "hqdefault"}.jpg`;
		return this.info.artworkUrl;
	}

	/**
	 *
	 * Get the duration of the track in milliseconds.
	 * @returns The duration of the track in milliseconds.
	 */
	public durationMS(): number {
		return this.info.length;
	}
}
