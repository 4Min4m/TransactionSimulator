import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://glorious-space-goldfish-9qw9xv459qj3qqv-8000.app.github.dev",
        changeOrigin: true,
        secure: false, // برای Codespaces که از HTTPS استفاده می‌کنه
      },
    },
  },
});