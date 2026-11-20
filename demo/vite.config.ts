import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../out/shift-happens", import.meta.url)),
    emptyOutDir: true,
  },
});
