import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/core.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "@daydreamlive/browser", "@daydreamlive/browser/core", "@daydreamlive/sdk", "daydream-sdk"],
});
