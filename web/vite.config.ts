import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Built with --base=/eyelab/ when synced into mateolarreaferro.com (see the
// MLF-Web repo's scripts/sync-demos.mjs); "/" for local development.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
