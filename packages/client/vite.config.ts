import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  server: { port: 5173 },
  build: { rollupOptions: { input: { main: resolve(__dirname, "index.html"), game: resolve(__dirname, "game.html"), play: resolve(__dirname, "play.html"), design: resolve(__dirname, "design.html"), damage: resolve(__dirname, "damage.html"), avatar: resolve(__dirname, "avatar.html"), effects: resolve(__dirname, "effects.html") } } },
});
