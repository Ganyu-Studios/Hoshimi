import { describe, expect, it, vi } from "vitest";
import { NodeManagerError } from "../src/classes/Errors";
import { EventNames } from "../src/types/Manager";
import { NodeSortTypes, State } from "../src/types/Node";
import { createRealManager, createRealNode } from "./helpers";

describe("NodeManager", () => {
    it("create returns existing node when id already exists", () => {
        const manager = createRealManager();
        const nodeManager = manager.nodeManager;

        const existing = createRealNode(manager, { id: "node-1" });

        const result = nodeManager.create({
            id: "node-1",
            host: "localhost",
            port: 2333,
            password: "pass",
        });

        expect(result).toBe(existing);
    });

    it("create builds and stores a new node and emits NodeCreate", () => {
        const manager = createRealManager();
        const nodeManager = manager.nodeManager;
        const emitSpy = vi.spyOn(manager, "emit");

        const result = nodeManager.create({
            id: "node-2",
            host: "localhost",
            port: 2333,
            password: "pass",
        });

        expect(result).toBeDefined();
        expect(result.id).toBe("node-2");
        expect(nodeManager.get("node-2")).toBe(result);
        expect(emitSpy).toHaveBeenCalledWith(EventNames.NodeCreate, result);
    });

    it("delete and get work with id and node reference", () => {
        const manager = createRealManager();
        const nodeManager = manager.nodeManager;
        const node = createRealNode(manager, { id: "node-x" });

        expect(nodeManager.get("node-x")).toBe(node);
        expect(nodeManager.get(node as never)).toBe(node);

        expect(nodeManager.delete(node as never)).toBe(true);
        expect(nodeManager.get("node-x")).toBeUndefined();
    });

    it("connect/disconnect/reconnect/destroy delegate to target node", () => {
        const manager = createRealManager();
        const nodeManager = manager.nodeManager;
        const node = createRealNode(manager, { id: "node-op" });
        node.state = State.Idle;

        const connectSpy = vi.spyOn(node, "connect").mockImplementation(() => {
            node.state = State.Connected;
        });
        const disconnectSpy = vi.spyOn(node, "disconnect").mockImplementation(() => {
            node.state = State.Disconnected;
        });
        const reconnectSpy = vi.spyOn(node, "reconnect").mockImplementation(() => {});
        const destroySpy = vi.spyOn(node, "destroy").mockImplementation(() => {
            node.state = State.Destroyed;
        });

        nodeManager.connect(node.id);
        nodeManager.disconnect(node.id);
        nodeManager.reconnect(node.id);
        nodeManager.destroy(node.id);

        expect(connectSpy).toHaveBeenCalledTimes(1);
        expect(disconnectSpy).toHaveBeenCalledTimes(1);
        expect(reconnectSpy).toHaveBeenCalledTimes(1);
        expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it("getLeastUsed throws when there are no connected nodes", () => {
        const manager = createRealManager();
        const nodeManager = manager.nodeManager;

        expect(() => nodeManager.getLeastUsed()).toThrow(NodeManagerError);
    });

    it("getLeastUsed selects the lowest penalty connected node", () => {
        const manager = createRealManager();
        const nodeManager = manager.nodeManager;

        const n1 = createRealNode(manager, { id: "n1" });
        n1.state = State.Connected;
        n1.stats = {
            players: 8,
            playingPlayers: 0,
            uptime: 0,
            memory: { free: 0, used: 0, allocated: 1, reservable: 0 },
            cpu: { cores: 1, systemLoad: 0, lavalinkLoad: 0 },
            frameStats: null,
        } as never;

        const n2 = createRealNode(manager, { id: "n2" });
        n2.state = State.Connected;
        n2.stats = {
            players: 2,
            playingPlayers: 0,
            uptime: 0,
            memory: { free: 0, used: 0, allocated: 1, reservable: 0 },
            cpu: { cores: 1, systemLoad: 0, lavalinkLoad: 0 },
            frameStats: null,
        } as never;

        const n3 = createRealNode(manager, { id: "n3" });
        n3.state = State.Disconnected;

        expect(nodeManager.getLeastUsed(NodeSortTypes.Penalties)).toBe(n2);
    });

    it("getLeastUsed supports players sort", () => {
        const manager = createRealManager();
        const nodeManager = manager.nodeManager;

        const n1 = createRealNode(manager, { id: "n1" });
        n1.state = State.Connected;
        n1.stats = {
            players: 10,
            playingPlayers: 2,
            uptime: 0,
            cpu: { cores: 1, systemLoad: 0.2, lavalinkLoad: 0.2 },
            memory: { free: 1, used: 1, allocated: 2, reservable: 3 },
            frameStats: null,
        } as never;

        const n2 = createRealNode(manager, { id: "n2" });
        n2.state = State.Connected;
        n2.stats = {
            players: 2,
            playingPlayers: 1,
            uptime: 0,
            cpu: { cores: 1, systemLoad: 0.1, lavalinkLoad: 0.1 },
            memory: { free: 1, used: 1, allocated: 2, reservable: 3 },
            frameStats: null,
        } as never;

        nodeManager.nodes.set(n1.id, n1);
        nodeManager.nodes.set(n2.id, n2);

        expect(nodeManager.getLeastUsed(NodeSortTypes.Players)).toBe(n2);
    });

    it("connectAll/disconnectAll/reconnectAll/destroyAll operate over matching nodes", () => {
        const manager = createRealManager();
        const nodeManager = manager.nodeManager;

        const connected = createRealNode(manager, { id: "connected" });
        connected.state = State.Connected;

        const disconnected = createRealNode(manager, { id: "disconnected" });
        disconnected.state = State.Disconnected;

        const idle = createRealNode(manager, { id: "idle" });
        idle.state = State.Idle;

        nodeManager.nodes.set(connected.id, connected);
        nodeManager.nodes.set(disconnected.id, disconnected);
        nodeManager.nodes.set(idle.id, idle);

        const connectSpyDisconnected = vi.spyOn(disconnected, "connect").mockImplementation(() => {});
        const connectSpyIdle = vi.spyOn(idle, "connect").mockImplementation(() => {});
        const connectSpyConnected = vi.spyOn(connected, "connect").mockImplementation(() => {});

        nodeManager.connectAll();
        expect(connectSpyDisconnected).toHaveBeenCalledTimes(1);
        expect(connectSpyIdle).toHaveBeenCalledTimes(1);
        expect(connectSpyConnected).not.toHaveBeenCalled();

        const disconnectSpyConnected = vi.spyOn(connected, "disconnect").mockImplementation(() => {});
        const disconnectSpyIdle = vi.spyOn(idle, "disconnect").mockImplementation(() => {});
        const disconnectSpyDisconnected = vi.spyOn(disconnected, "disconnect").mockImplementation(() => {});

        nodeManager.disconnectAll();
        expect(disconnectSpyConnected).toHaveBeenCalledTimes(1);
        expect(disconnectSpyIdle).toHaveBeenCalledTimes(1);
        expect(disconnectSpyDisconnected).not.toHaveBeenCalled();

        const reconnectSpyConnected = vi.spyOn(connected, "reconnect").mockImplementation(() => {});
        const reconnectSpyDisconnected = vi.spyOn(disconnected, "reconnect").mockImplementation(() => {});
        const reconnectSpyIdle = vi.spyOn(idle, "reconnect").mockImplementation(() => {});

        nodeManager.reconnectAll();
        expect(reconnectSpyConnected).not.toHaveBeenCalled();
        expect(reconnectSpyDisconnected).toHaveBeenCalledTimes(1);
        expect(reconnectSpyIdle).toHaveBeenCalledTimes(1);

        const destroySpyConnected = vi.spyOn(connected, "destroy").mockImplementation(() => {});
        const destroySpyDisconnected = vi.spyOn(disconnected, "destroy").mockImplementation(() => {});
        const destroySpyIdle = vi.spyOn(idle, "destroy").mockImplementation(() => {});

        nodeManager.destroyAll();
        expect(destroySpyConnected).toHaveBeenCalledTimes(1);
        expect(destroySpyDisconnected).toHaveBeenCalledTimes(1);
        expect(destroySpyIdle).toHaveBeenCalledTimes(1);
    });
});
