import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwind from "@tailwindcss/vite"

// Le serveur de développement sert l'interface ; l'API reste celle de l'atelier,
// sur son port. En production il n'y a plus qu'un serveur : `atelier/api/app.py`
// monte `interface/dist` à la racine.
export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8420" },
  },
  // Les essais d'écran — le seul endroit du dépôt où l'interface est montée et
  // pilotée. Ni serveur ni réseau : `fetch` et `EventSource` y sont doublés,
  // comme `tests/conftest.py` double le fournisseur côté Python.
  test: {
    environment: "jsdom",
    setupFiles: ["./src/montage-essais.ts"],
    include: ["src/**/*.test.tsx"],
  },
})
