import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://rcwydfzkuhfcnnbqjmpp.supabase.co"),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd3lkZnprdWhmY25uYnFqbXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDY2ODcsImV4cCI6MjA5MDg4MjY4N30.FX1VAUv-tbKtgj1sW5m-rqOLNn5McUZ_uIZDWEvQTSs"),
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
