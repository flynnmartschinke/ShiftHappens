import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths so the build works from the GitHub Pages subfolder
  base: "./",
  plugins: [react()],
  // Three.js is most of the bundle; one ~850 kB file (about 235 kB gzipped) is fine for a game
  build: { chunkSizeWarningLimit: 1000 },
});
