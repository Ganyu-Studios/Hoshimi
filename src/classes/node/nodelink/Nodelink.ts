import type { NodelinkConnectionStatus } from "../../../types/Nodelink";
import { Node } from "../Node";

/**
 * Class representing a Nodelink node.
 * @class NodelinkNode
 * @extends {Node}
 */
export class NodelinkNode extends Node {
    /**
     *
     * Get the connection status of the Nodelink node.
     * @returns {Promise<NodelinkConnectionStatus | null>} The connection status of the Nodelink node.
     * @example
     * ```ts
     * const status = await node.connection();
     * console.log(status); // { status: "good", ... }
     * ```
     */
    public connection(): Promise<NodelinkConnectionStatus | null> {
        return this.rest.request<NodelinkConnectionStatus>({ endpoint: "/connection" });
    }
}
