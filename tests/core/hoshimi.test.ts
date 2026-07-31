import { describe, expect, it } from "vitest";
import { HoshimiDefaultOptions, type HoshimiOptions } from "../../src";
import { ManagerError, OptionError } from "../../src/classes/Errors";
import { Hoshimi } from "../../src/classes/Hoshimi";
import { State } from "../../src/types/Node";

function createOptions() {
    return {
        sendPayload: HoshimiDefaultOptions.sendPayload,
        nodes: HoshimiDefaultOptions.nodes,
    } as HoshimiOptions;
}

describe("Hoshimi", () => {
    it("throws ManagerError when options are missing", () => {
        expect(() => new Hoshimi(undefined as never)).toThrow(ManagerError);
    });

    it("throws OptionError when maxHistory is not a non-negative integer", () => {
        for (const maxHistory of [Number.NaN, -1, 2.5, Number.POSITIVE_INFINITY, "25"]) {
            expect(() => new Hoshimi({ ...createOptions(), queueOptions: { maxHistory } } as never)).toThrow(OptionError);
        }

        expect(() => new Hoshimi({ ...createOptions(), queueOptions: { maxHistory: 0 } } as never)).not.toThrow();
        expect(new Hoshimi({ ...createOptions(), queueOptions: { maxHistory: 10 } } as never).options.queueOptions.maxHistory).toBe(10);
    });

    it("init rejects a missing client id and the placeholder default", () => {
        const manager = new Hoshimi(createOptions());

        expect(manager.options.client.id).toBe(HoshimiDefaultOptions.client.id);

        expect(() => manager.init({} as never)).toThrow(ManagerError);
        expect(() => manager.init({ id: HoshimiDefaultOptions.client.id })).toThrow(ManagerError);
        expect(() => manager.init({ id: "" })).toThrow(ManagerError);

        expect(manager.ready).toBe(false);
        expect(manager.nodeManager.nodes.size).toBe(0);
    });

    it("sets default options when constructed", () => {
        const manager = new Hoshimi(createOptions());

        expect(manager.options.defaultSearchSource).toBeDefined();
        expect(manager.options.queueOptions.storage).toBeDefined();
    });

    it("isUsable returns false when manager is not ready", () => {
        const manager = new Hoshimi(createOptions());
        manager.ready = false;

        expect(manager.isUsable()).toBe(false);
    });

    it("isUsable returns true when ready and a connected node exists", () => {
        const manager = new Hoshimi(createOptions());

        manager.ready = true;
        manager.nodeManager.nodes.set("node-1", { id: "node-1", state: State.Connected } as never);

        expect(manager.isUsable()).toBe(true);
    });

    it("isUseable is a deprecated alias of isUsable", () => {
        const manager = new Hoshimi(createOptions());

        manager.ready = true;
        manager.nodeManager.nodes.set("node-1", { id: "node-1", state: State.Connected } as never);

        expect(manager.isUseable()).toBe(manager.isUsable());
        expect(manager.isUseable()).toBe(true);
    });
});
