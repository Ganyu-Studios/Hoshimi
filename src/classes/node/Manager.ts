import { EventNames, type NodeIdentifier } from "../../types/Manager";
import { type NodeOptions, NodeSortTypes, State } from "../../types/Node";
import { type NodeStructure, Structures } from "../../types/Structures";
import { Collection } from "../../util/collection";
import { NodeManagerError } from "../Errors";
import type { Hoshimi } from "../Hoshimi";

/**
 * The type for the sort function used in the getLeastUsed method.
 * @param {NodeStructure} node The node to get the value from.
 * @returns {number} The value to sort by.
 */
type SortFunction = (node: NodeStructure) => number;

/**
 * Class representing a node manager.
 * @class NodeManager
 */
export class NodeManager {
    /**
     * The manager for the node.
     * @type {Hoshimi}
     * @readonly
     */
    readonly manager: Hoshimi;

    /**
     * The nodes for the manager.
     * @type {Collection<string, Node>}
     * @readonly
     */
    readonly nodes: Collection<string, NodeStructure> = new Collection<string, NodeStructure>();

    /**
     *
     * The constructor for the node manager.
     * @param {Hoshimi} manager The manager for the node.
     * @example
     * ```ts
     * const manager = new Hoshimi();
     * const nodeManager = new NodeManager(manager);
     *
     * console.log(nodeManager.nodes.size); // 0
     * ```
     */
    constructor(manager: Hoshimi) {
        this.manager = manager;
    }

    /**
     *
     * Delete the node.
     * @param {NodeIdentifier} node The node or node id to delete.
     * @returns {boolean} If the node was deleted.
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) manager.nodeManager.delete(node.id); // true if the node was deleted
     * ```
     */
    public delete(node: NodeIdentifier): boolean {
        const id: string = typeof node === "string" ? node : node.id;
        return this.nodes.delete(id);
    }

    /**
     *
     * Get the node by id.
     * @param {NodeIdentifier} node The node or node id to get.
     * @returns {NodeStructure | undefined} The node or undefined if not found.
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) {
     * 	console.log(node.id); // node1
     * } else {
     * 	console.log("Node not found");
     * }
     * ```
     */
    public get(node: NodeIdentifier): NodeStructure | undefined {
        const id: string = typeof node === "string" ? node : node.id;
        return this.nodes.get(id);
    }

    /**
     *
     * Create a new node.
     * @param {NodeOptions} options The options for the node.
     * @returns {NodeStructure} The created node.
     * @example
     * ```ts
     * const node = manager.nodeManager.create({
     * 	host: "localhost",
     * 	port: 2333,
     * 	password: "password",
     * 	secure: false,
     * });
     *
     * console.log(node.id); // localhost:2333
     */
    public create(options: NodeOptions): NodeStructure {
        options.id ??= `${options.host}:${options.port}`;

        const oldNode: NodeStructure | undefined = this.nodes.get(options.id);
        if (oldNode) return oldNode;

        const node: NodeStructure = Structures.Node(this, options);

        this.nodes.set(node.id, node);
        this.manager.emit(EventNames.NodeCreate, node);

        return node;
    }

    /**
     *
     * Destroy a node.
     * @param {NodeIdentifier} node The node or node id to destroy.
     * @returns {void}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.destroy();
     * ```
     */
    public destroy(node: NodeIdentifier): void {
        const target: NodeStructure | undefined = this.get(node);
        if (!target) return;

        target.destroy();
    }

    /**
     *
     * Reconnect a node.
     * @param {NodeIdentifier} node The node or node id to reconnect.
     * @returns {void}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.reconnect();
     * ```
     */
    public reconnect(node: NodeIdentifier): void {
        const target: NodeStructure | undefined = this.get(node);
        if (!target) return;

        target.reconnect();
    }

    /**
     *
     * Disconnect a node.
     * @param {NodeIdentifier} node The node or node id to disconnect.
     * @returns {void}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.disconnect();
     * ```
     */
    public disconnect(node: NodeIdentifier): void {
        const target: NodeStructure | undefined = this.get(node);
        if (!target) return;

        target.disconnect();
    }

    /**
     *
     * Connect a node.
     * @param {NodeIdentifier} node The node or node id to connect.
     * @returns {void}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.connect();
     * ```
     */
    public connect(node: NodeIdentifier): void {
        const target: NodeStructure | undefined = this.get(node);
        if (!target) return;

        target.connect();
    }

    /**
     *
     * Get the least used node.
     * @returns {NodeStructure} The least used node.
     * @example
     * ```ts
     * const node = manager.nodeManager.getLeastUsed();
     * if (node) {
     * 	console.log(node.id); // node1
     * 	console.log(node.penalties); // the penalties of the node
     * 	console.log(node.state); // the state of the node
     * }
     * ```
     */
    public getLeastUsed(sortType: NodeSortTypes = NodeSortTypes.Penalties): NodeStructure {
        const nodes: NodeStructure[] = this.nodes.filter((node) => node.state === State.Connected);
        if (!nodes.length) throw new NodeManagerError("No connected nodes available.");

        const sortFilters: Record<NodeSortTypes, SortFunction> = {
            [NodeSortTypes.Players]: (node): number => node.stats?.players ?? 0,
            [NodeSortTypes.PlayingPlayers]: (node): number => node.stats?.playingPlayers ?? 0,
            [NodeSortTypes.SystemLoad]: (node): number => node.stats?.cpu.systemLoad ?? 0,
            [NodeSortTypes.LavalinkLoad]: (node): number => node.stats?.cpu.lavalinkLoad ?? 0,
            [NodeSortTypes.Penalties]: (node): number => node.penalties,
            [NodeSortTypes.Cpu]: (node): number => ((node.stats?.cpu.systemLoad ?? 0) + (node.stats?.cpu.lavalinkLoad ?? 0)) / 2,
            [NodeSortTypes.Memory]: (node): number => ((node.stats?.memory.used ?? 0) / (node.stats?.memory.allocated ?? 1)) * 100,
        };

        const filter: SortFunction = sortFilters[sortType];

        return nodes.reduce((a, b): NodeStructure => (filter(a) < filter(b) ? a : b));
    }

    /**
     *
     * Reconnect the nodes.
     * @returns {void}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.reconnectAll();
     * ```
     */
    public reconnectAll(): void {
        if (!this.nodes.size) return;

        for (const node of this.nodes.filter((node) => node.state !== State.Connected)) {
            node.reconnect();
        }
    }

    /**
     * Disconnect the nodes.
     * @returns {void}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.disconnectAll();
     * ```
     */
    public disconnectAll(): void {
        if (!this.nodes.size) return;

        for (const node of this.nodes.filter((node) => node.state !== State.Disconnected)) {
            node.disconnect();
        }
    }

    /**
     * Connect the nodes.
     * @returns {void}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.connect();
     * ```
     */
    public connectAll(): void {
        if (!this.nodes.size) return;

        for (const node of this.nodes.filter((node) => node.state !== State.Connected)) {
            node.connect();
        }
    }

    /**
     * Destroy the nodes.
     * @returns {void}
     * @example
     * ```ts
     * const node = manager.nodeManager.get("node1");
     * if (node) node.destroy();
     * ```
     */
    public destroyAll(): void {
        if (!this.nodes.size) return;

        for (const node of this.nodes.values()) {
            node.destroy();
        }
    }
}
