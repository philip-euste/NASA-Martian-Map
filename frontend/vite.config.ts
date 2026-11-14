import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: "./index.html",
        jezero:
          "./src/simulator/jezero_crater/scripts/jezero-simulator.html",
      },
    },
  },
});
