import type { Hint, RestOrArray } from "../types/Manager";
import { SearchSources } from "../types/Manager";
import { SourceNames } from "../types/Node";
import { normalize, toArray } from "../util/functions/utils";

/**
 * Interface representing a parsed query with an explicit source prefix.
 */
export interface ParsedQuery {
    /**
     * The canonical source identifier parsed from the query prefix.
     * @type {string}
     */
    source: string;
    /**
     * The remaining query value after removing the source prefix.
     * @type {string}
     */
    value: string;
}

/**
 * The protocol strategy used to build lavalink identifiers.
 */
export type SourceProtocol = "colon" | "double-slash" | "raw";

/**
 * Registration options for a source.
 */
export interface SourceRegistration {
    /**
     * Search source prefix used by Lavalink.
     */
    source: RegistrySearchSource;
    /**
     * Optional track source name that resolves to the search source.
     */
    name?: RegistrySourceName;
    /**
     * Protocol used when creating lavalink identifiers.
     * @default "colon"
     */
    protocol?: SourceProtocol;
}

/**
 * Custom sources for Hoshimi.
 *
 * Extend this interface via module augmentation to provide custom sources/search sources.
 * @example
 * ```ts
 * declare module "hoshimi" {
 *   interface CustomizableSources {
 *     mysearch: "my-source";
 *   }
 * }
 * ```
 */
export interface CustomizableSources {}

/**
 * The custom search source keys provided by users via module augmentation.
 */
export type SearchSourceKey = keyof CustomizableSources;

/**
 * The full source identifier accepted by the source registry.
 */
export type RegistrySearchSource = SearchSources | Hint<SearchSourceKey>;

/**
 * The source name accepted by the source registry alias mapping.
 */
export type RegistrySourceName = SourceNames | Hint<CustomizableSources[keyof CustomizableSources]>;

/**
 * Internal mapping of source aliases to their canonical source identifiers.
 * @type {Map<string, string>}
 */
const aliasToSourceMap: Map<string, string> = new Map();

/**
 * Internal mapping of canonical source identifiers to their protocol strategies.
 * @type {Map<string, SourceProtocol>}
 */
const sourceToProtocolMap: Map<string, SourceProtocol> = new Map();

/**
 * List of canonical source identifiers in the order they were registered.
 * @type {string[]}
 */
const canonicalSources: string[] = [];

/**
 * Object representing the source registry for sources.
 */
export const SourceRegistry = {
    /**
     * Register one or multiple source definitions.
     * @param {RestOrArray<SourceRegistration>} registrations The source registration payloads.
     * @returns {string[]} The canonical source identifiers.
     * @example
     * ```ts
     * SourceRegistry.register({
     *   source: "mysearch",
     *   name: "my-provider",
     * });
     *
     * SourceRegistry.register(
     *   { source: "mysearch" },
     *   { source: "mytts", protocol: "double-slash" },
     * );
     * ```
     */
    register(...registrations: RestOrArray<SourceRegistration>): string[] {
        const results: string[] = [];

        for (const registration of toArray(registrations)) {
            const canonical: string = String(registration.source).trim();
            if (!canonical.length) continue;

            const name: string | undefined = typeof registration.name !== "undefined" ? String(registration.name).trim() : undefined;
            const canonicalKey: string = normalize(canonical);
            const protocol: SourceProtocol = registration.protocol ?? sourceToProtocolMap.get(canonicalKey) ?? "colon";

            if (!canonicalSources.includes(canonical)) canonicalSources.push(canonical);

            sourceToProtocolMap.set(canonicalKey, protocol);
            aliasToSourceMap.set(canonicalKey, canonical);

            if (name?.length) aliasToSourceMap.set(normalize(name), canonical);

            results.push(canonical);
        }

        return results;
    },
    /**
     * Get the canonical source from an alias or source name.
     * @param {Hint<RegistrySearchSource>} value The value to resolve.
     * @returns {string | undefined} The canonical source identifier.
     */
    resolve(value: RegistrySearchSource): string | undefined {
        const raw: string = String(value).trim();
        if (!raw) return undefined;

        return aliasToSourceMap.get(normalize(raw));
    },
    /**
     * Checks whether a source is registered.
     * @param {Hint<RegistrySearchSource>} value The value to check.
     * @returns {boolean} Whether the source is registered.
     */
    isRegistered(value: RegistrySearchSource): boolean {
        return typeof this.resolve(value) === "string";
    },
    /**
     * Returns all canonical registered sources.
     * @returns {string[]} All canonical source identifiers.
     */
    getRegistered(): string[] {
        return canonicalSources;
    },
    /**
     * Build a lavalink identifier from a source and query.
     * @param {RegistrySearchSource} source The source to use.
     * @param {string} query The query to format.
     * @returns {string} The formatted lavalink identifier.
     */
    createIdentifier(source: RegistrySearchSource, query: string): string {
        const canonical: string | undefined = this.resolve(source);
        if (!canonical) throw new TypeError(`The source '${source}' is not a valid source.`);

        const protocol: SourceProtocol = sourceToProtocolMap.get(normalize(canonical)) ?? "colon";
        const value: string = query.trim();

        if (protocol === "raw") return value;
        if (protocol === "double-slash") return `${canonical}://${value}`;

        return `${canonical}:${value}`;
    },
    /**
     * Tries to parse an explicit source prefix from a query.
     * @param {string} query The query to inspect.
     * @returns {ParsedQuery | null} The parsed source information.
     */
    parseQuery(query: string): ParsedQuery | null {
        const raw: string = query.trim();
        if (!raw.length) return null;

        for (const source of canonicalSources) {
            if (raw.startsWith(`${source}://`)) {
                return {
                    source,
                    value: raw.slice(source.length + 3).trim(),
                };
            }

            if (raw.startsWith(`${source}:`)) {
                return {
                    source,
                    value: raw.slice(source.length + 1).trim(),
                };
            }
        }

        return null;
    },
} as const;

// Pre-register built-in sources with their respective names and protocols.
SourceRegistry.register([
    { source: SearchSources.Youtube, name: SourceNames.Youtube },
    { source: SearchSources.YoutubeMusic, name: SourceNames.YoutubeMusic },
    { source: SearchSources.SoundCloud, name: SourceNames.Soundcloud },
    { source: SearchSources.BandCamp, name: SourceNames.Bandcamp },
    { source: SearchSources.Twitch, name: SourceNames.Twitch },
    { source: SearchSources.Vimeo, name: SourceNames.Vimeo },
    { source: SearchSources.Mixer, name: SourceNames.Mixer },
    { source: SearchSources.Spotify, name: SourceNames.Spotify },
    { source: SearchSources.Deezer, name: SourceNames.Deezer },
    { source: SearchSources.AppleMusic, name: SourceNames.AppleMusic },
    { source: SearchSources.YandexMusic, name: SourceNames.YandexMusic },
    { source: SearchSources.FloweryTTS, name: SourceNames.FloweryTTS, protocol: "double-slash" },
    { source: SearchSources.JioSaavn, name: SourceNames.JioSaavn },
    { source: SearchSources.VKMusic, name: SourceNames.VKMusic },
    { source: SearchSources.Tidal, name: SourceNames.Tidal },
    { source: SearchSources.TextToSpeech, name: SourceNames.TextToSpeech },
    { source: SearchSources.PornHub, name: SourceNames.PornHub },
    { source: SearchSources.Local, protocol: "raw" },
    { source: SearchSources.HTTP, name: SourceNames.HTTP, protocol: "raw" },
    { source: SearchSources.SpotifyAlbumMix },
    { source: SearchSources.SpotifyArtistMix },
    { source: SearchSources.SpotifyISRCMix },
    { source: SearchSources.SpotifyTrackMix },
    { source: SearchSources.SpotifyRecommendations },
    { source: SearchSources.DeezerISRC },
    { source: SearchSources.DeezerRecommendations },
    { source: SearchSources.YandexMusicRecommendations },
    { source: SearchSources.VKMusicRecommendations },
    { source: SearchSources.TidalRecommendations },
    { source: SearchSources.Qobuz },
    { source: SearchSources.QobuzISRC },
    { source: SearchSources.QobuzRecommendations },
    { source: SearchSources.JioSaavnRecommendations },
]);
