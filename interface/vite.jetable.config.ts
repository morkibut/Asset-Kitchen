import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwind from "@tailwindcss/vite"

// L'écran de développement branché sur un atelier jetable (`essais/atelier_jetable_*.py`,
// port 8426) plutôt que sur celui de l'auteur (8420) : on y clique tout sans rien toucher.
export default defineConfig({
  plugins: [react(), tailwind()],
  server: { port: 5174, strictPort: true, proxy: { "/api": "http://127.0.0.1:8426" } },
})
