import { OpCodes } from "../../types/Node";
import { NodelinkEventNames, NodelinkEventType, type NodelinkPayload } from "../../types/Nodelink";
import type { NodeStructure } from "../../types/Structures";

/**
 *
 * Emitted when a Nodelink event is received from the socket.
 * @param {NodeStructure} this The node that emitted the event.
 * @param {NodelinkPayload} payload The payload received from the socket.
 * @returns {void} Nothing.
 */
export function onNodelink(this: NodeStructure, payload: NodelinkPayload): void {
    if (payload.op === OpCodes.Event) {
        switch (payload.type) {
            case NodelinkEventType.WorkerFailed:
                this.nodeManager.manager.emit(NodelinkEventNames.WorkerFailed, payload);
                break;
            case NodelinkEventType.PlayerCreated:
                this.nodeManager.manager.emit(NodelinkEventNames.PlayerCreated, payload);
                break;
            case NodelinkEventType.PlayerDestroyed:
                this.nodeManager.manager.emit(NodelinkEventNames.PlayerDestroyed, payload);
                break;
            case NodelinkEventType.PlayerConnected:
                this.nodeManager.manager.emit(NodelinkEventNames.PlayerConnected, payload);
                break;
            case NodelinkEventType.PlayerReconnecting:
                this.nodeManager.manager.emit(NodelinkEventNames.PlayerReconnecting, payload);
                break;
            case NodelinkEventType.VolumeChanged:
                this.nodeManager.manager.emit(NodelinkEventNames.VolumeChanged, payload);
                break;
            case NodelinkEventType.FiltersChanged:
                this.nodeManager.manager.emit(NodelinkEventNames.FiltersChanged, payload);
                break;
            case NodelinkEventType.Seek:
                this.nodeManager.manager.emit(NodelinkEventNames.Seek, payload);
                break;
            case NodelinkEventType.Pause:
                this.nodeManager.manager.emit(NodelinkEventNames.Pause, payload);
                break;
            case NodelinkEventType.ConnectionStatus:
                this.nodeManager.manager.emit(NodelinkEventNames.ConnectionStatus, payload);
                break;
            case NodelinkEventType.MixStarted:
                this.nodeManager.manager.emit(NodelinkEventNames.MixStarted, payload);
                break;
            case NodelinkEventType.MixEnded:
                this.nodeManager.manager.emit(NodelinkEventNames.MixEnded, payload);
                break;
        }
    }
}
