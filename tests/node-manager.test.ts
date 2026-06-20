import { describe, expect, it, vi } from "vitest";
import { NodeManagerError } from "../src/classes/Errors";
import { NodeManager } from "../src/classes/node/Manager";
import { EventNames } from "../src/types/Manager";
import { NodeSortTypes, State } from "../src/types/Node";
import { Structures } from "../src/types/Structures";
import { createMockManager, createMockNode } from "./helpers";

describe("NodeManager", () => {
    it("create returns existing node when id already exists", () => {
        const manager = createMockManager();
        const nodeManager = new NodeManager(manager as never);

        const existing = createMockNode({ id: "node-1", state: State.Connected });
        nodeManager.nodes.set("node-1", existing as never);

        const result = nodeManager.create({
            id: "node-1",
            host: "localhost",
            port: 2333,
            password: "pass",
        });

        expect(result).toBe(existing);
    });

    it("create builds and stores a new node and emits NodeCreate", () => {
        const manager = createMockManager();
        const nodeManager = new NodeManager(manager as never);
        const mockedNode = createMockNode({ id: "node-2", state: State.Idle });

        const nodeFactorySpy = vi.spyOn(Structures, "Node").mockReturnValue(mockedNode as never);

        const result = nodeManager.create({
            id: "node-2",
            host: "localhost",
            port: 2333,
            password: "pass",
        });

        expect(nodeFactorySpy).toHaveBeenCalled();
        expect(result).toBe(mockedNode);
        expect(nodeManager.get("node-2")).toBe(mockedNode);
        expect(manager.emit).toHaveBeenCalledWith(EventNames.NodeCreate, mockedNode);
    });

    it("delete and get work with id and node reference", () => {
        const manager = createMockManager();
        const nodeManager = new NodeManager(manager as never);
        const node = createMockNode({ id: "node-x", state: State.Connected });

        nodeManager.nodes.set(node.id, node as never);

        expect(nodeManager.get("node-x")).toBe(node);
        expect(nodeManager.get(node as never)).toBe(node);

        expect(nodeManager.delete(node as never)).toBe(true);
        expect(nodeManager.get("node-x")).toBeUndefined();
    });

    it("connect/disconnect/reconnect/destroy delegate to target node", () => {
        const manager = createMockManager();
        const nodeManager = new NodeManager(manager as never);
        const node = createMockNode({ id: "node-op", state: State.Connected });

        nodeManager.nodes.set(node.id, node as never);

        nodeManager.connect(node.id);
        nodeManager.disconnect(node.id);
        nodeManager.reconnect(node.id);
        nodeManager.destroy(node.id);

        expect(node.connect).toHaveBeenCalledTimes(1);
        expect(node.disconnect).toHaveBeenCalledTimes(1);
        expect(node.reconnect).toHaveBeenCalledTimes(1);
        expect(node.destroy).toHaveBeenCalledTimes(1);
    });

    it("getLeastUsed throws when there are no connected nodes", () => {
        const manager = createMockManager();
        const nodeManager = new NodeManager(manager as never);

        expect(() => nodeManager.getLeastUsed()).toThrow(NodeManagerError);
    });

    it("getLeastUsed selects the lowest penalty connected node", () => {
        const manager = createMockManager();
        const nodeManager = new NodeManager(manager as never);

        const n1 = createMockNode({ id: "n1", state: State.Connected, penalties: 8 });
        const n2 = createMockNode({ id: "n2", state: State.Connected, penalties: 2 });
        const n3 = createMockNode({ id: "n3", state: State.Disconnected, penalties: 0 });

        nodeManager.nodes.set(n1.id, n1 as never);
        nodeManager.nodes.set(n2.id, n2 as never);
        nodeManager.nodes.set(n3.id, n3 as never);

        expect(nodeManager.getLeastUsed(NodeSortTypes.Penalties)).toBe(n2);
    });

    it("getLeastUsed supports players sort", () => {
        const manager = createMockManager();
        const nodeManager = new NodeManager(manager as never);

        const n1 = createMockNode({
            id: "n1",
            state: State.Connected,
            penalties: 0,
            stats: { players: 10, playingPlayers: 2, cpu: { systemLoad: 0.2, lavalinkLoad: 0.2 }, memory: { used: 1, allocated: 2 } },
        });
        const n2 = createMockNode({
            id: "n2",
            state: State.Connected,
            penalties: 0,
            stats: { players: 2, playingPlayers: 1, cpu: { systemLoad: 0.1, lavalinkLoad: 0.1 }, memory: { used: 1, allocated: 2 } },
        });

        nodeManager.nodes.set(n1.id, n1 as never);
        nodeManager.nodes.set(n2.id, n2 as never);

        expect(nodeManager.getLeastUsed(NodeSortTypes.Players)).toBe(n2);
    });

    it("connectAll/disconnectAll/reconnectAll/destroyAll operate over matching nodes", () => {
        const manager = createMockManager();
        const nodeManager = new NodeManager(manager as never);

        const connected = createMockNode({ id: "connected", state: State.Connected });
        const disconnected = createMockNode({ id: "disconnected", state: State.Disconnected });
        const idle = createMockNode({ id: "idle", state: State.Idle });

        nodeManager.nodes.set(connected.id, connected as never);
        nodeManager.nodes.set(disconnected.id, disconnected as never);
        nodeManager.nodes.set(idle.id, idle as never);

        nodeManager.connectAll();
        expect(disconnected.connect).toHaveBeenCalledTimes(1);
        expect(idle.connect).toHaveBeenCalledTimes(1);
        expect(connected.connect).not.toHaveBeenCalled();

        nodeManager.disconnectAll();
        expect(connected.disconnect).toHaveBeenCalledTimes(1);
        expect(idle.disconnect).toHaveBeenCalledTimes(1);
        expect(disconnected.disconnect).not.toHaveBeenCalled();

        nodeManager.reconnectAll();
        expect(disconnected.reconnect).toHaveBeenCalledTimes(1);
        expect(idle.reconnect).toHaveBeenCalledTimes(1);
        expect(connected.reconnect).not.toHaveBeenCalled();

        nodeManager.destroyAll();
        expect(connected.destroy).toHaveBeenCalledTimes(1);
        expect(disconnected.destroy).toHaveBeenCalledTimes(1);
        expect(idle.destroy).toHaveBeenCalledTimes(1);
    });
});
