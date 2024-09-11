import { defineConfig } from "tsup";

export default defineConfig({
	dts: true,
	format: ["esm", "cjs"],
	entry: ["./src/index.ts"],
	splitting: false,
	sourcemap: true,
	clean: true,
	skipNodeModulesBundle: true,
	ignoreWatch: ["**/node_modules/**", "**/.git/**"],
});

//defineConfig({
//	entry: ["./src/**/*.ts"],
//	format: ["esm", "cjs"],
//	clean: true,
//	dts: true,
//	minify: true,
//	target: "es2022",
//	bundle: true,
//	splitting: false,
//	sourcemap: true,
//	keepNames: true,
//	skipNodeModulesBundle: true,
//	ignoreWatch: ["**/node_modules/**", "**/.git/**"],
//});
