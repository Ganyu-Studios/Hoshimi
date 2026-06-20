import { vi } from "vitest";
import { SourceNames, State } from "../src/types/Node";

/**
 *
 * Creates a mock manager instance for testing purposes.
 * @returns {Object} A mock manager object with stubbed methods and properties for testing.
 */
export function createMockManager() {
    const emit = vi.fn();
    return {
        emit,
        options: {
            sendPayload: vi.fn().mockResolvedValue(undefined),
            defaultSearchSource: "ytsearch",
            queueOptions: {
                maxHistory: 5,
                storage: {
                    set: vi.fn(),
                    get: vi.fn(),
                    delete: vi.fn(),
                    has: vi.fn(),
                    clear: vi.fn(),
                },
            },
            playerOptions: {
                requesterFn: <T>(requester: unknown) => requester as T,
            },
            nodeOptions: {},
            restOptions: {
                resumeTimeout: 120,
            },
        },
        nodeManager: {
            nodes: new Map(),
            get: vi.fn(),
            delete: vi.fn(),
            getLeastUsed: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
            reconnect: vi.fn(),
            destroy: vi.fn(),
        },
        getPlayer: vi.fn(),
        deletePlayer: vi.fn(),
        search: vi.fn(),
        createPlayer: vi.fn(),
        players: new Map(),
        ready: true,
    };
}

/**
 *
 * Creates a mock node instance for testing purposes.
 * @param {Record<string, unknown>} [overrides] Optional overrides for the mock node properties and methods.
 * @returns {Object} A mock node object with stubbed methods and properties, merged with any provided overrides.
 */
export function createMockNode(overrides?: Record<string, unknown>) {
    const id = (overrides?.id as string) ?? "node-1";
    return {
        id,
        state: State.Connected,
        sessionId: "session-1",
        options: {
            host: "localhost",
            port: 2333,
            password: "pass",
            secure: false,
            retryAmount: 3,
            retryDelay: 1000,
        },
        stats: null,
        info: null,
        penalties: 0,
        rest: {
            request: vi.fn().mockResolvedValue(null),
            updatePlayer: vi.fn().mockResolvedValue(null),
            destroyPlayer: vi.fn().mockResolvedValue(undefined),
            stopPlayer: vi.fn().mockResolvedValue(null),
            getPlayers: vi.fn().mockResolvedValue([]),
            updateSession: vi.fn().mockResolvedValue(null),
        },
        decode: {
            single: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        reconnect: vi.fn(),
        destroy: vi.fn(),
        search: vi.fn(),
        isNodelink: () => false,
        nodeManager: {
            manager: {
                emit: vi.fn(),
                options: {
                    restOptions: { resumeTimeout: 120 },
                    nodeOptions: { userAgent: "hoshimi-test/v1 (https://example.com)" },
                },
                getPlayer: vi.fn().mockReturnValue(undefined),
            },
            delete: vi.fn(),
        },
        ...overrides,
    };
}

/**
 *
 * Creates a mock track data object for testing purposes.
 * @param {Record<string, unknown>} [overrides] Optional overrides for the mock track data properties.
 * @returns {Object} A mock track data object with default properties, merged with any provided overrides.
 */
export function createMockTrackData(overrides?: Record<string, unknown>) {
    const overrideInfo = (overrides?.info as Record<string, unknown>) ?? {};
    const { info: _unused, ...restOverrides } = overrides ?? {};

    return {
        encoded: "encoded-track",
        info: {
            identifier: "track-id",
            title: "Track Title",
            author: "Artist",
            length: 180000,
            artworkUrl: null,
            uri: "https://example.com/track",
            sourceName: SourceNames.Youtube,
            isSeekable: true,
            isStream: false,
            isrc: null,
            position: 0,
            ...overrideInfo,
        },
        pluginInfo: {},
        userData: {},
        ...restOverrides,
    };
}

/**
 *
 * Creates a mock player instance for testing purposes.
 * @param {Record<string, unknown>} [overrides] Optional overrides for the mock player properties and methods.
 * @returns {Object} A mock player object with default properties and stubbed methods, merged with any provided overrides.
 */
export function createMockPlayer(overrides?: Record<string, unknown>) {
    return {
        guildId: "guild-1",
        voiceId: "voice-1",
        selfDeaf: true,
        selfMute: false,
        connected: false,
        options: { voiceId: "voice-1" },
        manager: {
            options: {
                sendPayload: vi.fn().mockResolvedValue(undefined),
            },
            emit: vi.fn(),
        },
        ...overrides,
    };
}

/**
 *
 * Creates a mock Hoshimi instance for testing purposes, with optional overrides for properties and methods.
 * @param {Record<string, unknown>} [overrides] Optional overrides for the mock Hoshimi properties and methods.
 * @returns {Object} A mock Hoshimi object with default properties and stubbed methods, merged with any provided overrides.
 */
export function createMockHoshimi(overrides?: Record<string, unknown>) {
    const nodeOverrides = (overrides?.node as Record<string, unknown>) ?? {};
    const nodeMock = {
        id: "node-1",
        state: State.Connected,
        options: { host: "localhost", port: 2333, password: "pass" },
        destroyPlayer: vi.fn().mockResolvedValue(undefined),
        stopPlayer: vi.fn().mockResolvedValue(null),
        search: vi.fn(),
        decode: { single: vi.fn() },
        ...nodeOverrides,
    };

    return {
        options: {
            sendPayload: vi.fn().mockResolvedValue(undefined),
            defaultSearchSource: "ytsearch",
            queueOptions: {
                maxHistory: 5,
                storage: {
                    set: vi.fn(),
                    get: vi.fn(),
                    delete: vi.fn(),
                    has: vi.fn(),
                    clear: vi.fn(),
                },
            },
            playerOptions: {
                requesterFn: <T>(requester: unknown) => requester as T,
            },
            nodeOptions: {},
            restOptions: { resumeTimeout: 120 },
            ...((overrides?.options as Record<string, unknown>) ?? {}),
        },
        emit: vi.fn(),
        nodeManager: {
            nodes: new Map<string, unknown>([["node-1", nodeMock]]),
            get: vi.fn((id: string) => (id === "node-1" ? nodeMock : undefined)),
            getLeastUsed: vi.fn(() => nodeMock),
            delete: vi.fn(),
        },
        getPlayer: vi.fn(),
        deletePlayer: vi.fn(),
        search: vi.fn(),
        createPlayer: vi.fn(),
        players: new Map(),
        ready: true,
        ...overrides,
        node: undefined,
    };
}
