import { defineConfig } from "tsdown";

/**
 * The configuration for the tsup build tool.
 */
export default defineConfig({
    dts: true,
    format: ["esm", "cjs"],
    entry: ["./src/index.ts"],
    sourcemap: false,
    clean: true,
    ignoreWatch: ["**/node_modules/**", "**/.git/**"],
    tsconfig: "./tsconfig.json",
    target: false,
    deps: {
        skipNodeModulesBundle: true,
    },
    checks: {
        pluginTimings: false,
    },
});
