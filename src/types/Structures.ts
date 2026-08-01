import { LyricsManager } from "../classes/node/Lyrics";
import { NodeManager } from "../classes/node/Manager";
import { Node } from "../classes/node/Node";
import { Rest } from "../classes/node/Rest";
import { FilterManager } from "../classes/player/filters/Manager";
import { Player } from "../classes/player/Player";
import { PlayerVoiceState } from "../classes/player/Voice";
import { Queue } from "../classes/queue/Queue";
import type { PlayerStorageAdapter } from "../classes/storage/adapters/PlayerAdapter";
import { PlayerMemoryStorage } from "../classes/storage/PlayerMemory";
import { Track, UnresolvedTrack } from "../classes/Track";
import type { CustomizableStructures } from "./Manager";

/**
 * The structure for the Player class.
 */
export type PlayerStructure = InferCustomStructure<Player, "Player">;

/**
 * The structure for the Rest class.
 */
export type RestStructure = InferCustomStructure<Rest, "Rest">;

/**
 * The structure for the Node class.
 */
export type NodeStructure = InferCustomStructure<Node, "Node">;

/**
 * The structure for the Queue class.
 */
export type QueueStructure = InferCustomStructure<Queue, "Queue">;

/**
 * The structure for the LyricsManager class.
 */
export type LyricsManagerStructure = InferCustomStructure<LyricsManager, "LyricsManager">;

/**
 * The structure for the NodeManager class.
 */
export type NodeManagerStructure = InferCustomStructure<NodeManager, "NodeManager">;

/**
 * The structure for the FilterManager class.
 */
export type FilterManagerStructure = InferCustomStructure<FilterManager, "FilterManager">;

/**
 * The structure for the Track class.
 */
export type TrackStructure = InferCustomStructure<Track, "Track">;

/**
 * The structure for the UnresolvedTrack class.
 */
export type UnresolvedTrackStructure = InferCustomStructure<UnresolvedTrack, "UnresolvedTrack">;

/**
 * The structure for the PlayerVoiceState class.
 */
export type PlayerVoiceStateStructure = InferCustomStructure<PlayerVoiceState, "PlayerVoiceState">;

/**
 * The structure for the PlayerStorageAdapter class.
 */
export type PlayerStorageAdapterStructure = InferCustomStructure<PlayerStorageAdapter, "PlayerStorageAdapter">;

/**
 * Factory signatures for all overridable structures.
 */
interface StructureFactories {
    Player(...args: ConstructorParameters<typeof Player>): PlayerStructure;
    Rest(...args: ConstructorParameters<typeof Rest>): RestStructure;
    Node(...args: ConstructorParameters<typeof Node>): NodeStructure;
    Queue(...args: ConstructorParameters<typeof Queue>): QueueStructure;
    LyricsManager(...args: ConstructorParameters<typeof LyricsManager>): LyricsManagerStructure;
    NodeManager(...args: ConstructorParameters<typeof NodeManager>): NodeManagerStructure;
    FilterManager(...args: ConstructorParameters<typeof FilterManager>): FilterManagerStructure;
    Track(...args: ConstructorParameters<typeof Track>): TrackStructure;
    UnresolvedTrack(...args: ConstructorParameters<typeof UnresolvedTrack>): UnresolvedTrackStructure;
    PlayerVoiceState(...args: ConstructorParameters<typeof PlayerVoiceState>): PlayerVoiceStateStructure;
    PlayerStorageAdapter(...args: ConstructorParameters<typeof PlayerStorageAdapter>): PlayerStorageAdapterStructure;
}

/**
 * The structures of the Hoshimi classes.
 */
export const Structures: StructureFactories = {
    Player(...args): PlayerStructure {
        return new Player(...args);
    },
    Rest(...args): RestStructure {
        return new Rest(...args);
    },
    Node(...args): NodeStructure {
        return new Node(...args);
    },
    Queue(...args): QueueStructure {
        return new Queue(...args);
    },
    LyricsManager(...args): LyricsManagerStructure {
        return new LyricsManager(...args);
    },
    NodeManager(...args): NodeManagerStructure {
        return new NodeManager(...args);
    },
    FilterManager(...args): FilterManagerStructure {
        return new FilterManager(...args);
    },
    Track(...args): TrackStructure {
        return new Track(...args);
    },
    UnresolvedTrack(...args): UnresolvedTrackStructure {
        return new UnresolvedTrack(...args);
    },
    PlayerVoiceState(...args): PlayerVoiceStateStructure {
        return new PlayerVoiceState(...args);
    },
    PlayerStorageAdapter(...args): PlayerStorageAdapterStructure {
        return new PlayerMemoryStorage(...args);
    },
};

/**
 * Infers the custom structure for a given class.
 */
export type InferCustomStructure<T, N extends string> = N extends keyof CustomizableStructures ? CustomizableStructures[N] : T;
