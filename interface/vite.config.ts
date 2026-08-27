import { defineConfig } from "vite"
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
})
