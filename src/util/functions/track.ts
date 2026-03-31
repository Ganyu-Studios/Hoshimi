import type { UnresolvedTrack } from "../../classes/Track";
import type { LavalinkTrack, UnresolvedLavalinkTrack } from "../../types/Node";
import type { TrackStructure } from "../../types/Structures";

/**
 * Check whether a track payload is already resolved/playable.
 * @param {TrackStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track payload.
 * @returns {boolean} True when the payload is resolved.
 */
export function isResolved(track: TrackStructure | LavalinkTrack | UnresolvedLavalinkTrack): track is TrackStructure | LavalinkTrack {
    if (!track) return false;

    return (
        typeof track.encoded === "string" && typeof track.info === "object" && !("resolve" in track && typeof track.resolve === "function")
    );
}

/**
 * Check whether a track payload is unresolved and requires resolution.
 * @param {TrackStructure | LavalinkTrack | UnresolvedLavalinkTrack} track The track payload.
 * @returns {boolean} True when the payload is unresolved.
 */
export function isUnresolved(
    track: TrackStructure | LavalinkTrack | UnresolvedLavalinkTrack,
): track is UnresolvedTrack | UnresolvedLavalinkTrack {
    if (!track) return false;

    return (
        typeof track.encoded === "string" ||
        (typeof track.info === "object" &&
            typeof track.info.title === "string" &&
            "resolve" in track &&
            typeof track.resolve === "function")
    );
}
