import { describe, expect, it, vi } from "vitest";

import { ResolveError } from "../src/classes/Errors";
import { Track, UnresolvedTrack } from "../src/classes/Track";
import { SearchSources } from "../src/types/Manager";
import { LoadType, SourceNames } from "../src/types/Node";
import { State } from "../src/types/Node";
import { createMockTrackData, createRealManager, createRealNode, createRealPlayer } from "./helpers";

describe("Track", () => {
    it("throws ResolveError when constructing Track with null", () => {
        expect(() => new Track(null, {})).toThrow(ResolveError);
    });

    it("builds hyperlink in embeddable and non-embeddable formats", () => {
        const track = new Track(createMockTrackData() as never, {});

        expect(track.toHyperlink()).toBe("[Track Title](https://example.com/track)");
        expect(track.toHyperlink(false)).toBe("[Track Title](<https://example.com/track>)");
    });
});

describe("UnresolvedTrack", () => {
    it("throws ResolveError when resolving without player", async () => {
        const unresolved = new UnresolvedTrack({ info: { title: "My Song" } } as never, { id: "u1" } as never);

        await expect(unresolved.resolve(undefined as never)).rejects.toThrow(ResolveError);
    });

    it("resolves using node.decode.single when encoded is present", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager, { id: "node-1" });
        node.state = State.Connected;

        const decodedTrack = createMockTrackData({ encoded: "decoded" });

        const requestSpy = vi.mocked(node.rest.request);
        requestSpy.mockResolvedValue(decodedTrack);

        const player = createRealPlayer(manager);

        const requester = { id: "req-1" };
        const unresolved = new UnresolvedTrack({ encoded: "encoded-value", info: { title: "My Song" } } as never, requester as never);

        const result = await unresolved.resolve(player as never);

        expect(requestSpy).toHaveBeenCalled();
        expect(result).toBeDefined();
    });

    it("throws ResolveError when URI resolution returns no tracks", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager, { id: "node-1" });
        node.state = State.Connected;

        vi.mocked(node.rest.request).mockResolvedValue({ data: [], loadType: LoadType.Empty } as never);

        const player = createRealPlayer(manager);

        const unresolved = new UnresolvedTrack(
            {
                info: { title: "My Song", uri: "https://example.com/source" },
            } as never,
            { id: "req-2" } as never,
        );

        await expect(unresolved.resolve(player as never)).rejects.toThrow(ResolveError);
    });

    it("resolves through search query using default source when sourceName is excluded", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager, { id: "node-1" });
        node.state = State.Connected;

        const foundTrack = createMockTrackData({ info: { identifier: "found-id", title: "Found", author: "Other" } });

        vi.mocked(node.rest.request).mockResolvedValue({ data: [foundTrack], loadType: LoadType.Search } as never);

        const player = createRealPlayer(manager);

        const requester = { id: "req-3" };
        const unresolved = new UnresolvedTrack(
            {
                info: {
                    title: "Need Resolve",
                    author: "Artist Name",
                    sourceName: SourceNames.Twitch,
                },
            } as never,
            requester as never,
        );

        const result = await unresolved.resolve(player as never);

        expect(result).toBeDefined();
    });

    it("throws ResolveError when unresolved track lacks resolvable properties", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager, { id: "node-1" });
        node.state = State.Connected;

        vi.mocked(node.rest.request).mockResolvedValue(null);

        const player = createRealPlayer(manager);

        const unresolved = new UnresolvedTrack(
            {
                info: {
                    title: "",
                },
            } as never,
            { id: "req-4" } as never,
        );

        await expect(unresolved.resolve(player as never)).rejects.toThrow(ResolveError);
    });

    it("throws ResolveError when requester is missing", async () => {
        const manager = createRealManager();
        const node = createRealNode(manager, { id: "node-1" });
        node.state = State.Connected;

        const player = createRealPlayer(manager);

        const unresolved = new UnresolvedTrack(
            {
                info: {
                    title: "Need requester",
                },
            } as never,
            { id: "req-5" } as never,
        );

        unresolved.requester = null as never;

        await expect(unresolved.resolve(player as never)).rejects.toThrow(ResolveError);
    });
});
