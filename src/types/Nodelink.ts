import type { FilterSettings } from "./Filters";
import type { CustomizableOptions, Omit } from "./Manager";
import type { LavalinkTrack } from "./Node";
import type { LavalinkPlayerVoice, PlayerEvent } from "./Player";

export type NodelinkSupport = CustomizableOptions extends { supportNodelink: infer P } ? P : false;

interface NodelinkPlayer {
    guildId: string;
    track: null;
    paused: boolean;
    volume: number;
}

interface NodelinkVoice extends LavalinkPlayerVoice {
    channelId: string;
}

interface NodelinkConnectionSpeed {
    mbps: number;
    kbps: number;
    bps: number;
}

export interface NodelinkConnectionMetics {
    timestamp: number;
    downloadedBytes: number;
    durationSeconds: number;
    speed: NodelinkConnectionSpeed;
    status: NodelinkConnectionStatus;
}

export enum NodelinkConnectionStatus {
    Good = "good",
}

export enum NodelinkMixEndReasons {
    Finished = "FINISHED",
    Removed = "REMOVED",
    Error = "ERROR",
    MainError = "MAIN_ERROR",
}

export enum NodelinkEventType {
    WorkerFailed = "WorkerFailedEvent",
    PlayerCreated = "PlayerCreatedEvent",
    PlayerDestroyed = "PlayerDestroyedEvent",
    PlayerConnected = "PlayerConnectedEvent",
    PlayerReconnecting = "PlayerReconnectingEvent",
    VolumeChanged = "VolumeChangedEvent",
    FiltersChanged = "FiltersChangedEvent",
    Seek = "SeekEvent",
    Pause = "PauseEvent",
    ConnectionStatus = "ConnectionStatusEvent",
    MixStarted = "MixStartedEvent",
    MixEnded = "MixEndedEvent",
}

export enum NodelinkEventNames {
    WorkerFailed = "nodelinkWorkerFailed",
    PlayerCreated = "nodelinkPlayerCreated",
    PlayerDestroyed = "nodelinkPlayerDestroyed",
    PlayerConnected = "nodelinkPlayerConnected",
    PlayerReconnecting = "nodelinkPlayerReconnecting",
    VolumeChanged = "nodelinkVolumeChanged",
    FiltersChanged = "nodelinkFiltersChanged",
    Seek = "nodelinkSeek",
    Pause = "nodelinkPause",
    ConnectionStatus = "nodelinkConnectionStatus",
    MixStarted = "nodelinkMixStarted",
    MixEnded = "nodelinkMixEnded",
}

export interface NodelinkEvents {
    nodelinkWorkerFailed: [payload: WorkerFailedEvent];
    nodelinkPlayerCreated: [payload: PlayerCreatedEvent];
    nodelinkPlayerDestroyed: [payload: PlayerDestroyedEvent];
    nodelinkPlayerConnected: [payload: PlayerConnectedEvent];
    nodelinkPlayerReconnecting: [payload: PlayerReconnectingEvent];
    nodelinkVolumeChanged: [payload: VolumeChangedEvent];
    nodelinkFiltersChanged: [payload: FiltersChangedEvent];
    nodelinkSeek: [payload: SeekEvent];
    nodelinkPause: [payload: PauseEvent];
    nodelinkConnectionStatus: [payload: ConnectionStatusEvent];
    nodelinkMixStarted: [payload: MixStartedEvent];
    nodelinkMixEnded: [payload: MixEndedEvent];
}

export interface WorkerFailedEvent extends Omit<PlayerEvent<NodelinkEventType.WorkerFailed>, "guildId"> {
    affectedGuilds: string[];
    message: string;
}

export interface PlayerCreatedEvent extends PlayerEvent<NodelinkEventType.PlayerCreated> {
    player: NodelinkPlayer;
}

export interface PlayerDestroyedEvent extends PlayerEvent<NodelinkEventType.PlayerDestroyed> {}

export interface PlayerConnectedEvent extends PlayerEvent<NodelinkEventType.PlayerConnected> {
    voice: NodelinkVoice;
}

export interface PlayerReconnectingEvent extends PlayerEvent<NodelinkEventType.PlayerReconnecting> {
    voice: NodelinkVoice;
}

export interface VolumeChangedEvent extends PlayerEvent<NodelinkEventType.VolumeChanged> {
    volume: number;
}

export interface FiltersChangedEvent extends PlayerEvent<NodelinkEventType.FiltersChanged> {
    filters: FilterSettings;
}

export interface SeekEvent extends PlayerEvent<NodelinkEventType.Seek> {
    position: number;
}

export interface PauseEvent extends PlayerEvent<NodelinkEventType.Pause> {
    paused: boolean;
}

export interface ConnectionStatusEvent extends PlayerEvent<NodelinkEventType.ConnectionStatus> {
    metrics: NodelinkConnectionMetics;
}

export interface MixStartedEvent extends PlayerEvent<NodelinkEventType.MixStarted> {
    mixId: string;
    track: LavalinkTrack;
    volume: number;
}

export interface MixEndedEvent extends PlayerEvent<NodelinkEventType.MixEnded> {
    mixId: string;
    reason: NodelinkMixEndReasons;
}

export interface NodelinkLyricsLine {
    text: string;
    time: number | null;
    duration: number | null;
}

export interface NodelinkLyricsResult {
    synced: boolean;
    lang: string;
    source: string;
    provider: string;
    lines: NodelinkLyricsLine[];
}

export interface NodelinkLyrics {
    loadType: "lyrics";
    data: NodelinkLyricsResult;
}

export type NodelinkPayload =
    | WorkerFailedEvent
    | PlayerCreatedEvent
    | PlayerDestroyedEvent
    | PlayerConnectedEvent
    | PlayerReconnectingEvent
    | VolumeChangedEvent
    | FiltersChangedEvent
    | SeekEvent
    | PauseEvent
    | ConnectionStatusEvent
    | MixStartedEvent
    | MixEndedEvent;
