import { type LyricsResult, PluginNames } from "../../types/Node";
import { HttpMethods, RestRoutes } from "../../types/Rest";
import type { NodeStructure, TrackStructure } from "../../types/Structures";
import { validateNodePlugins } from "../../util/functions/utils";

/**
 * Class representing a LyricsManager.
 * @class LyricsManager
 */
export class LyricsManager {
    /**
     * The node instance.
     * @type {NodeStructure}
     * @readonly
     */
    readonly node: NodeStructure;

    /**
     * Create a new LyricsManager instance.
     * @param {NodeStructure} node The node instance.
     * @example
     * ```ts
     * const node = manager.nodeManager.get("nodeId");
     * const lyricsManager = new LyricsManager(node);
     * ```
     */
    constructor(node: NodeStructure) {
        this.node = node;
    }

    /**
     *
     * Get the current lyrics for the current track.
     * @param {boolean} skipSource Whether to skip the track source or not.
     * @returns {Promise<LyricsResult | null>} The lyrics result or null if not found.
     * @example
     * ```ts
     * const player = manager.getPlayer("guildId");
     * const lyrics = await player.lyricsManager.current();
     * ```
     */
    public async current(guildId: string, skipSource: boolean = false): Promise<LyricsResult | null> {
        if (!this.node.sessionId) return null;

        validateNodePlugins({
            node: this.node,
            plugins: [PluginNames.LavaLyrics, PluginNames.JavaLyrics, PluginNames.LavaSrc],
            atleastOne: true,
        });

        return this.node.rest.request<LyricsResult>({
            endpoint: RestRoutes.CurrentLyrics(this.node.sessionId, guildId),
            params: {
                skipTrackSource: `${skipSource}`,
            },
        });
    }

    /**
     *
     * Get the lyrics for a specific track.
     * @param {TrackStructure} track The track to get the lyrics for.
     * @param {boolean} skipSource Whether to skip the track source or not.
     * @returns {Promise<LyricsResult | null>} The lyrics result or null if not found.
     * @example
     * ```ts
     * const node = manager.nodeManager.get("nodeId");
     * const lyrics = await node.lyricsManager.get(track);
     * ```
     */
    public async get(track: TrackStructure, skipSource: boolean = false): Promise<LyricsResult | null> {
        if (!this.node.sessionId) return null;

        validateNodePlugins({
            node: this.node,
            plugins: [PluginNames.LavaLyrics, PluginNames.JavaLyrics, PluginNames.LavaSrc],
            atleastOne: true,
        });

        return this.node.rest.request<LyricsResult>({
            endpoint: RestRoutes.GetLyrics,
            params: {
                track: track.encoded,
                skipTrackSource: `${skipSource}`,
            },
        });
    }

    /**
     *
     * Subscribe to the lyrics for a specific guild.
     * @param {string} guildId The guild id to subscribe to.
     * @param {boolean} skipSource Whether to skip the track source or not.
     * @returns {Promise<void>} Let's start the sing session!
     * @example
     * ```ts
     * const node = manager.nodeManager.get("nodeId");
     * await node.lyricsManager.subscribe("guildId");
     * ```
     */
    public async subscribe(guildId: string, skipSource: boolean = false): Promise<void> {
        if (!this.node.sessionId) return;

        validateNodePlugins({
            node: this.node,
            plugins: [PluginNames.LavaLyrics, PluginNames.JavaLyrics, PluginNames.LavaSrc],
            atleastOne: true,
        });

        await this.node.rest.request({
            endpoint: RestRoutes.SubscribeLyrics(this.node.sessionId, guildId),
            method: HttpMethods.Post,
            params: {
                skipTrackSource: `${skipSource}`,
            },
        });
    }

    /**
     *
     * Unsubscribe from the lyrics for a specific guild.
     * @param {string} guildId The guild id to unsubscribe from.
     * @returns {Promise<void>} Let's stop the sing session!
     * @example
     * ```ts
     * const node = manager.nodeManager.get("nodeId");
     * await node.lyricsManager.unsubscribe("guildId");
     * ```
     */
    public async unsubscribe(guildId: string): Promise<void> {
        if (!this.node.sessionId) return;

        validateNodePlugins({
            node: this.node,
            plugins: [PluginNames.LavaLyrics, PluginNames.JavaLyrics, PluginNames.LavaSrc],
            atleastOne: true,
        });

        await this.node.rest.request({
            endpoint: RestRoutes.SubscribeLyrics(this.node.sessionId, guildId),
            method: HttpMethods.Delete,
        });
    }
}
