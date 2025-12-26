import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/core.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["@daydreamlive/sdk", "daydream-sdk"],
});
