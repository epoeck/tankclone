import { defineConfig } from "vite";
import { resolve } from "node:path";
const page = (file: string) => resolve(__dirname, file);
export default defineConfig({
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        // jogo
        game: page("game.html"), play: page("play.html"),
        // páginas de desenvolvimento (não fazem parte do jogo): dev/*.html
        design: page("dev/design.html"), damage: page("dev/damage.html"), avatar: page("dev/avatar.html"),
        effects: page("dev/effects.html"), fisica: page("dev/fisica.html"),
      },
    },
  },
});
