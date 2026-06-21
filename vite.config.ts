import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      insertTypesEntry: true,
      outDir: "dist",
      tsconfigPath: "tsconfig.build.json",
    }),
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "Wavegram",
      formats: ["es", "umd"],
      fileName: (format) => (format === "es" ? "index.es.js" : "index.umd.js"),
    },
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  test: {
    environment: "happy-dom",
    exclude: ["node_modules/**", "dist/**", "test/e2e/**"],
  },
});
