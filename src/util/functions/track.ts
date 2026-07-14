import { Track, type TrackResolvableStructure, UnresolvedTrack } from "../../classes/Track";
import type { LavalinkTrack, UnresolvedLavalinkTrack } from "../../types/Node";
import type { AnyLavalinkTrack } from "../../types/Player";
import type { TrackJSON } from "../../types/Queue";
import type { TrackStructure } from "../../types/Structures";

/**
 * Check whether a track is a local Track instance (resolved).
 * Only returns true for Track class instances (not generic LavalinkTrack objects).
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a local resolved Track instance.
 */
function isResolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is TrackStructure {
    if (!track) return false;
    // Use instanceof to ensure it's a Track class instance, not just a LavalinkTrack object
    // A resolved track has encoded and info, and no resolve function
    return (
        track instanceof Track &&
        typeof track.encoded === "string" &&
        typeof track.info === "object" &&
        !("resolve" in track && typeof track.resolve === "function") &&
        "requester" in track &&
        typeof track.requester !== "undefined" &&
        typeof track.info.title === "string"
    );
}

/**
 * Check whether a track is a local UnresolvedTrack instance (unresolved).
 * Only returns true for UnresolvedTrack class instances.
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a local unresolved UnresolvedTrack instance.
 */
function isUnresolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is UnresolvedTrack {
    if (!track) return false;
    // Use instanceof to ensure it's an UnresolvedTrack class instance
    return (
        track instanceof UnresolvedTrack &&
        "resolve" in track &&
        typeof track.resolve === "function" &&
        typeof track.requester !== "undefined" &&
        typeof track.info === "object" &&
        typeof track.info.title === "string"
    );
}

/**
 * Check whether a track is a Lavalink-compatible resolved track (not a local Track instance).
 * Returns true for LavalinkTrack objects that have encoded and info but are not Track class instances.
 * This is for raw Lavalink track objects from the API or other sources.
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a Lavalink resolved track (not a local Track).
 */
function isLavalinkResolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is LavalinkTrack {
    if (!track || typeof track !== "object") return false;
    // Must have encoded and info, and NOT be a Track instance, and NOT have resolve
    return (
        !(track instanceof Track) &&
        typeof track.encoded === "string" &&
        typeof track.info === "object" &&
        !("resolve" in track && typeof track.resolve === "function") &&
        "requester" in track
    );
}

/**
 * Check whether a track is a Lavalink-compatible unresolved track (not a local UnresolvedTrack instance).
 * Returns true for UnresolvedLavalinkTrack objects that have a resolve-like structure but are not UnresolvedTrack instances.
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a Lavalink unresolved track (not a local UnresolvedTrack).
 */
function isLavalinkUnresolved(track: TrackResolvableStructure | AnyLavalinkTrack): track is UnresolvedLavalinkTrack {
    if (!track || typeof track !== "object") return false;
    // Must have info and NOT be an UnresolvedTrack instance, and should not have the resolve function
    return (
        !(track instanceof UnresolvedTrack) &&
        "info" in track &&
        typeof track.info === "object" &&
        typeof track.info?.title === "string" &&
        !("resolve" in track && typeof track.resolve === "function")
    );
}

/**
 * Check whether a track is a stored track (has the structure of a TrackJSON object).
 * This is used to identify tracks that come from storage and need to be transformed back into Track instances.
 * @param {TrackResolvableStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track to check.
 * @returns {boolean} True when the track is a stored track (TrackJSON structure).
 */
function isStoredTrack(track: TrackResolvableStructure | AnyLavalinkTrack): track is TrackJSON {
    if (!track || typeof track !== "object") return false;
    return (
        typeof track.encoded === "string" &&
        typeof track.info === "object" &&
        typeof track.info.title === "string" &&
        "requester" in track &&
        typeof track.requester !== "undefined"
    );
}

/**
 *
 * A collection of utility functions for track resolution and type checking.
 * @constant
 */
export const TrackResolution = {
    isResolved,
    isUnresolved,
    isLavalinkResolved,
    isLavalinkUnresolved,
    isStoredTrack,
} as const;
