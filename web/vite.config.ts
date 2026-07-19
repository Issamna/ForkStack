import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the app under /ForkStack/; local dev serves at root.
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/ForkStack/" : "/",
  plugins: [react()],
  server: { port: 5173 },
}));
