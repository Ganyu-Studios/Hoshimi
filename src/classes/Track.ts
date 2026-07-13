import { DebugLevels, type Inferable, type SearchSource } from "../types/Manager";
import {
    type LavalinkTrack,
    type PluginInfo,
    type SourceName,
    SourceNames,
    type TrackInfo,
    type UnresolvedLavalinkTrack,
    type UnresolvedTrackInfo,
} from "../types/Node";
import type { TrackJSON } from "../types/Queue";
import type { PlayerStructure, TrackStructure, UnresolvedTrackStructure } from "../types/Structures";
import { TrackResolution, validateSource } from "../util/functions/utils";
import { ResolveError } from "./Errors";

/**
 *
 * Escapes special characters in a string for use in a regular expression.
 * @param {string} input The string to escape for use in a regular expression.
 * @returns {string} The escaped string.
 */
const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Class representing a Hoshimi track.
 * @class Track
 * @implements {LavalinkTrack}
 */
export class Track implements LavalinkTrack {
    /**
     * The base64 encoded track.
     * @type {string}
     */
    readonly encoded: string;

    /**
     * The track info.
     * @type {TrackInfo}
     */
    readonly info: TrackInfo;

    /**
     * The plugin info of the track.
     * @type {PluginInfo}
     */
    readonly pluginInfo: PluginInfo;

    /**
     * The track user data.
     * @type {TrackUserData}
     */
    public userData?: TrackUserData;

    /**
     * The requester of the track.
     * @type {TrackRequester}
     */
    public requester: TrackRequester;

    /**
     * The constructor for the track.
     * @param {LavalinkTrack} track The track to construct the track from.
     * @param {TrackRequester} requester The requester of the track.
     * @example
     * ```ts
     * const track = Structures.Track({
     * 	encoded: "base64",
     * 	info: {
     * 		title: "Track Title",
     * 		uri: "https://example.com",
     * 		duration: 300000,
     * 	},
     * 	// the rest of the track info
     * }, requester);
     *
     * console.log(track.encoded); // the track encoded in base64
     * ```
     */
    constructor(track: LavalinkTrack | null, requester: TrackRequester) {
        if (!track) throw new ResolveError("Track is not defined for construction.");

        this.info = track.info;
        this.encoded = track.encoded;
        this.requester = requester ?? {};
        this.pluginInfo = track.pluginInfo;
        this.userData = track.userData ?? {};
    }

    /**
     *
     * Get the hyperlink of the track.
     * @param {boolean} [embedable=true] Whether the hyperlink should be embedable or not.
     * @returns {string} The hyperlink of the track.
     * @example
     * ```ts
     * const track = queue.current;
     * console.log(track.toHyperlink()); // [Track Title](https://example.com)
     * console.log(track.toHyperlink(false)); // [Track Title](<https://example.com>)
     * ```
     */
    public toHyperlink(embedable: boolean = true): string {
        if (embedable) return `[${this.info.title}](${this.info.uri})`;
        return `[${this.info.title}](<${this.info.uri}>)`;
    }

    /**
     *
     * Converts the track to a JSON object for storage.
     * @returns {TrackJSON} The JSON representation of the track for storage.
     */
    public toJSON(): TrackJSON {
        return {
            requester: this.requester,
            encoded: this.encoded,
            info: this.info,
            pluginInfo: this.pluginInfo,
            userData: this.userData,
        };
    }
}

/**
 * Class representing an unresolved track.
 * @class UnresolvedTrack
 * @implements {UnresolvedLavalinkTrack}
 */
export class UnresolvedTrack implements UnresolvedLavalinkTrack {
    /**
     * The base64 encoded track.
     * @type {string | undefined}
     */
    readonly encoded?: string;

    /**
     * The track info.
     * @type {UnresolvedTrackInfo}
     */
    readonly info: UnresolvedTrackInfo;

    /**
     * The track user data.
     * @type {TrackUserData | undefined}
     */
    public userData?: TrackUserData;

    /**
     * The requester of the track.
     * @type {TrackRequester | undefined}
     */
    public requester: TrackRequester;

    /**
     * The plugin info of the track.
     * @type {Partial<PluginInfo>}
     */
    readonly pluginInfo?: Partial<PluginInfo>;

    /**
     * The constructor for the track.
     * @param {UnresolvedLavalinkTrack} track The track to construct the track from.
     * @param {TrackRequester} requester The requester of the track.
     * @example
     * ```ts
     * const track = new UnresolvedTrack({
     * 	encoded: "base64",
     * 	info: {
     * 		title: "Track Title",
     * 	},
     * 	// the rest of the track info
     * }, requester);
     *
     * console.log(track.encoded); // the track encoded in base64
     * ```
     */
    constructor(track: UnresolvedLavalinkTrack, requester: TrackRequester) {
        this.info = track.info;
        this.encoded = track.encoded;
        this.requester = requester ?? {};
        this.pluginInfo = track.pluginInfo ?? {};
        this.userData = track.userData ?? {};
    }

    /**
     *
     * Converts the track to a JSON object for storage.
     * @returns {TrackJSON} The JSON representation of the track for storage.
     */
    public toJSON(): TrackJSON {
        return {
            requester: this.requester,
            encoded: this.encoded!,
            info: this.info as TrackInfo,
            pluginInfo: this.pluginInfo!,
            userData: this.userData,
        };
    }

    /**
     * Resolves the track to a playable track.
     * @param {PlayerStructure} player The player to resolve the track for.
     * @returns {Promise<TrackStructure>} The resolved track.
     * @throws {ResolveError} If the track cannot be resolved.
     */
    public async resolve(player: PlayerStructure): Promise<TrackStructure> {
        if (!player) throw new ResolveError("Player is not defined for track resolution.");

        if (TrackResolution.isResolved(this)) return this;

        if (!TrackResolution.isUnresolved(this)) throw new ResolveError("Track is not an unresolved track.");
        if (!this.requester) throw new ResolveError("Requester is not defined for track resolution.");
        if (!this.info.title && !this.encoded && !this.info.uri)
            throw new ResolveError("Track is missing required properties for resolution.");

        player.manager.debug(DebugLevels.Player, `[Unresolved] -> [Track] Resolving the track: ${this.info.title}`);

        if (this.encoded) return player.node.decode.single(this.encoded, this.requester);

        if (this.info.uri) {
            const track: TrackStructure | undefined = await player
                .search({ query: this.info.uri, requester: this.requester })
                .then((result): TrackStructure | undefined => result.tracks.at(0));
            if (!track) throw new ResolveError("Track could not be resolved from URI.");

            player.manager.debug(DebugLevels.Player, `[Unresolved] -> [Track] Resolved the track from URI: ${this.info.uri}`);

            return track;
        }

        const query: string = [this.info.title, this.info.author].filter(Boolean).join(" by ");
        const excluded: SourceName[] = [SourceNames.Twitch, SourceNames.FloweryTTS, SourceNames.Mixer, SourceNames.Vimeo];

        const source: SearchSource =
            this.info.sourceName && !excluded.includes(this.info.sourceName)
                ? validateSource(this.info.sourceName)
                : player.manager.options.defaultSearchSource;

        player.manager.debug(
            DebugLevels.Player,
            `[Unresolved] -> [Track] Searching for track with query: ${query} using source: ${source}`,
        );

        return player.search({ query, source, requester: this.requester }).then((result): TrackStructure => {
            let track: TrackStructure | null = result.tracks.at(0) ?? null;

            if (this.info.author && !track)
                track =
                    result.tracks.find(
                        (t): boolean =>
                            [this.info.author ?? "", `${this.info.author} - Topic`].some((name): boolean =>
                                new RegExp(`^${escapeRegExp(name)}$`, "i").test(t.info.author),
                            ) || new RegExp(`^${escapeRegExp(this.info.title)}$`, "i").test(t.info.title),
                    ) ?? null;

            if (this.info.length && !track)
                track =
                    result.tracks.find((t): boolean => {
                        const length: number | undefined = this.info.length;
                        if (!length) return false;

                        return t.info.length >= length - 1500 && t.info.length <= length + 1500;
                    }) ?? null;

            if (this.info.isrc && !track) track = result.tracks.find((t): boolean => t.info.isrc === this.info.isrc) ?? null;

            if (!track) throw new ResolveError("Track could not be resolved from search query.");

            player.manager.debug(
                DebugLevels.Player,
                `[Unresolved] -> [Track] Resolved the track ${track.info.title} from search query: ${query}`,
            );

            return track;
        });
    }
}

/**
 * Interface representing an extendable track.
 */
export interface CustomizableTrack {}

/**
 * Type representing a Hoshimi track, which can be either a resolved or unresolved track.
 */
export type TrackResolvableStructure = TrackStructure | UnresolvedTrackStructure;

/**
 * The requester of the track.
 */
export type TrackRequester = Inferable<CustomizableTrack, "requester">;

/**
 * The user data of the track.
 */
export type TrackUserData = Inferable<CustomizableTrack, "userData", Record<string, unknown>>;
