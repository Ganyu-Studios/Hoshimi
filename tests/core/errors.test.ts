import { describe, expect, it } from "vitest";

import {
    ManagerError,
    NodeError,
    NodeManagerError,
    OptionError,
    PlayerError,
    ResolveError,
    RestError,
    StorageError,
} from "../../src/classes/Errors";

describe("Errors", () => {
    it("ManagerError sets name and message", () => {
        const error = new ManagerError("manager failed");

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe("Hoshimi [ManagerError]");
        expect(error.message).toBe("manager failed");
    });

    it("OptionError sets name and message", () => {
        const error = new OptionError("invalid option");

        expect(error.name).toBe("Hoshimi [OptionError]");
        expect(error.message).toBe("invalid option");
    });

    it("PlayerError sets name and message", () => {
        const error = new PlayerError("player failed");

        expect(error.name).toBe("Hoshimi [PlayerError]");
        expect(error.message).toBe("player failed");
    });

    it("NodeError includes id in the name", () => {
        const error = new NodeError({ id: "node-1", message: "node failed" });

        expect(error.name).toBe("Hoshimi [NodeError | node-1]");
        expect(error.message).toBe("node failed");
    });

    it("StorageError sets name and message", () => {
        const error = new StorageError("storage failed");

        expect(error.name).toBe("Hoshimi [StorageError]");
        expect(error.message).toBe("storage failed");
    });

    it("NodeManagerError sets name and message", () => {
        const error = new NodeManagerError("node manager failed");

        expect(error.name).toBe("Hoshimi [NodeManagerError]");
        expect(error.message).toBe("node manager failed");
    });

    it("ResolveError sets name and message", () => {
        const error = new ResolveError("resolve failed");

        expect(error.name).toBe("Hoshimi [ResolveError]");
        expect(error.message).toBe("resolve failed");
    });

    it("RestError sets response data", () => {
        const error = new RestError({
            timestamp: 1700000000,
            status: 404,
            error: "Not Found",
            message: "Track not found",
            path: "/v4/loadtracks",
            trace: "trace-value",
        });

        expect(error.name).toBe("Hoshimi [RestError]");
        expect(error.timestamp).toBe(1700000000);
        expect(error.status).toBe(404);
        expect(error.error).toBe("Not Found");
        expect(error.path).toBe("/v4/loadtracks");
        expect(error.trace).toBe("trace-value");
        expect(error.message).toBe("Track not found");
    });

    it("RestError supports an empty message", () => {
        const error = new RestError({
            timestamp: 1700000000,
            status: 500,
            error: "Server Error",
            message: "",
            path: "/v4/route",
            trace: undefined,
        });

        expect(error.message).toBe("");
        expect(error.status).toBe(500);
    });
});
