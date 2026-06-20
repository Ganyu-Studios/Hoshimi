import { describe, expect, it, vi } from "vitest";

import { ResolveError } from "../src/classes/Errors";
import { Track, UnresolvedTrack } from "../src/classes/Track";
import { SearchSources } from "../src/types/Manager";
import { SourceNames } from "../src/types/Node";
import { createMockTrackData } from "./helpers";

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
        const decodedTrack = createMockTrackData({ encoded: "decoded" });
        const decodeSingle = vi.fn().mockResolvedValue(decodedTrack);

        const player = {
            manager: {
                options: {
                    playerOptions: {
                        requesterFn: (requester: unknown) => requester,
                    },
                    defaultSearchSource: SearchSources.Youtube,
                },
                emit: vi.fn(),
            },
            node: {
                decode: {
                    single: decodeSingle,
                },
            },
            search: vi.fn(),
        };

        const requester = { id: "req-1" };
        const unresolved = new UnresolvedTrack({ encoded: "encoded-value", info: { title: "My Song" } } as never, requester as never);

        const result = await unresolved.resolve(player as never);

        expect(decodeSingle).toHaveBeenCalledWith("encoded-value", requester);
        expect(result).toBe(decodedTrack);
    });

    it("throws ResolveError when URI resolution returns no tracks", async () => {
        const player = {
            manager: {
                options: {
                    playerOptions: {
                        requesterFn: (requester: unknown) => requester,
                    },
                    defaultSearchSource: SearchSources.Youtube,
                },
                emit: vi.fn(),
            },
            node: {
                decode: {
                    single: vi.fn(),
                },
            },
            search: vi.fn().mockResolvedValue({ tracks: [] }),
        };

        const unresolved = new UnresolvedTrack(
            {
                info: { title: "My Song", uri: "https://example.com/source" },
            } as never,
            { id: "req-2" } as never,
        );

        await expect(unresolved.resolve(player as never)).rejects.toThrow(ResolveError);
    });

    it("resolves through search query using default source when sourceName is excluded", async () => {
        const foundTrack = createMockTrackData({ info: { identifier: "found-id", title: "Found", author: "Other" } });
        const search = vi.fn().mockResolvedValue({ tracks: [foundTrack] });

        const player = {
            manager: {
                options: {
                    playerOptions: {
                        requesterFn: (requester: unknown) => requester,
                    },
                    defaultSearchSource: SearchSources.Youtube,
                },
                emit: vi.fn(),
            },
            node: {
                decode: {
                    single: vi.fn(),
                },
            },
            search,
        };

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

        expect(search).toHaveBeenCalledWith({
            query: "Need Resolve by Artist Name",
            source: SearchSources.Youtube,
            requester,
        });
        expect(result).toBe(foundTrack);
    });

    it("throws ResolveError when unresolved track lacks resolvable properties", async () => {
        const player = {
            manager: {
                options: {
                    playerOptions: {
                        requesterFn: (requester: unknown) => requester,
                    },
                    defaultSearchSource: SearchSources.Youtube,
                },
                emit: vi.fn(),
            },
            node: {
                decode: {
                    single: vi.fn(),
                },
            },
            search: vi.fn(),
        };

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
        const player = {
            manager: {
                options: {
                    playerOptions: {
                        requesterFn: (requester: unknown) => requester,
                    },
                    defaultSearchSource: SearchSources.Youtube,
                },
                emit: vi.fn(),
            },
            node: {
                decode: {
                    single: vi.fn(),
                },
            },
            search: vi.fn(),
        };

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
