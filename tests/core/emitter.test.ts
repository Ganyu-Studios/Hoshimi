import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { TypedEmitter } from "../../src/util/emitter";

const internal = Symbol("internal");

interface ProbeEvents {
    ping: [count: number];
    named: [who: string, times: number];
    empty: [];
    [internal]: [flag: boolean];
}

class Probe extends TypedEmitter<ProbeEvents> {}

/**
 * The type assertions live in the same file as the runtime ones on purpose: `@ts-expect-error` fails
 * the build when the line below it *stops* erroring, so these are what keep the surface from
 * quietly loosening back to what `node:events` gives by default — where an unknown event name is
 * accepted and its listener receives `any`.
 */
describe("TypedEmitter", () => {
    it("keeps node's emitter behaviour", () => {
        const probe = new Probe();
        const seen: number[] = [];

        probe.on("ping", (count) => seen.push(count));
        probe.once("ping", (count) => seen.push(count * 100));

        probe.emit("ping", 1);
        probe.emit("ping", 2);

        expect(probe).toBeInstanceOf(EventEmitter);
        // The `once` listener ran for the first emit only.
        expect(seen).toEqual([1, 100, 2]);
        expect(probe.eventNames()).toEqual(["ping"]);
    });

    it("removes listeners through off and removeAllListeners", () => {
        const probe = new Probe();
        const seen: string[] = [];
        const listener = (who: string): number => seen.push(who);

        probe.on("named", listener);
        probe.emit("named", "first", 1);

        probe.off("named", listener);
        probe.emit("named", "second", 2);

        expect(seen).toEqual(["first"]);

        probe.on("ping", () => seen.push("ping"));
        expect(probe.listenerCount("ping")).toBe(1);

        probe.removeAllListeners("ping");
        expect(probe.listenerCount("ping")).toBe(0);
    });

    it("infers listener parameters from the event map", () => {
        const probe = new Probe();

        probe.on("named", (who, times) => {
            // Assigning to concrete types is the assertion: `any` would compile either way, but
            // these would then be `any` and the emit below could not be checked at all.
            const name: string = who;
            const count: number = times;

            expect(typeof name).toBe("string");
            expect(typeof count).toBe("number");
        });

        probe.emit("named", "hoshimi", 3);
    });

    it("supports symbol-keyed events the map declares", () => {
        const probe = new Probe();
        const seen: boolean[] = [];

        probe.on(internal, (flag) => {
            // Inferred from the tuple, same as for a string key.
            const value: boolean = flag;
            seen.push(value);
        });

        probe.emit(internal, true);

        expect(seen).toEqual([true]);
        expect(probe.eventNames()).toEqual([internal]);
    });

    it("rejects unknown names and mismatched payloads", () => {
        // Never called: `@ts-expect-error` suppresses the diagnostic, it does not remove the call,
        // so running these would register real listeners and emit real events. Keeping them inside
        // an uninvoked function leaves the assertions where they belong — at compile time, where
        // `tsc` fails the build if any of these lines stops erroring.
        function typeAssertions(probe: Probe): void {
            // @ts-expect-error - unknown event name on `on`
            probe.on("thisEventDoesNotExist", () => {});
            // @ts-expect-error - unknown event name on `once`
            probe.once("neitherDoesThis", () => {});
            // @ts-expect-error - unknown event name on `off`
            probe.off("norThis", () => {});
            // @ts-expect-error - unknown event name on `emit`
            probe.emit("orThisOne", 1, 2, 3);
            // @ts-expect-error - unknown event name on `removeAllListeners`
            probe.removeAllListeners("madeUp");
            // @ts-expect-error - listener signature does not match the map
            probe.on("ping", (count: string) => count);
            // @ts-expect-error - missing arguments
            probe.emit("named", "hoshimi");
            // @ts-expect-error - wrong argument type
            probe.emit("ping", "not a number");
            // @ts-expect-error - an event with no payload takes none
            probe.emit("empty", 1);
            // @ts-expect-error - a symbol the map never declared, so widening to `string | symbol`
            // did not reopen the hole Node's own `string | symbol` union leaves
            probe.on(Symbol("undeclared"), () => {});
        }

        expect(typeAssertions).toBeTypeOf("function");
    });
});
