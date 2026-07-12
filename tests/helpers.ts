import { vi } from "vitest";
import { Hoshimi } from "../src/classes/Hoshimi";
import type { HoshimiOptions } from "../src/types/Manager";
import type { NodeOptions } from "../src/types/Node";
import { SourceNames, State } from "../src/types/Node";
import type { PlayerOptions } from "../src/types/Player";

export function createRealManager(overrides?: Partial<HoshimiOptions>) {
    const sendPayload = vi.fn().mockResolvedValue(undefined);
    const manager = new Hoshimi({
        sendPayload,
        nodes: [{ host: "localhost", port: 2333, password: "pass", id: "node-1", retryAmount: 0 }],
        ...overrides,
    } as HoshimiOptions);
    return manager;
}

export function createRealNode(manager: Hoshimi, options?: Partial<NodeOptions>) {
    const node = manager.nodeManager.create({
        host: "localhost",
        port: 2333,
        password: "pass",
        id: "node-1",
        retryAmount: 0,
        ...options,
    });

    node.state = State.Connected;
    node.sessionId = "session-1";

    vi.spyOn(node.rest, "request").mockResolvedValue(null);
    vi.spyOn(node.rest, "updatePlayer").mockResolvedValue(null);
    vi.spyOn(node.rest, "destroyPlayer").mockImplementation(async () => {});
    vi.spyOn(node.rest, "stopPlayer").mockResolvedValue(null);

    return node;
}

export function createRealPlayer(manager: Hoshimi, overrides?: Partial<PlayerOptions>) {
    if (!manager.nodeManager.nodes.some((n) => n.state === State.Connected)) {
        createRealNode(manager);
    }

    const player = manager.createPlayer({
        guildId: "guild-1",
        voiceId: "voice-1",
        ...overrides,
    });

    return player;
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
