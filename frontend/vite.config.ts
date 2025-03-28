import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "https://glorious-space-goldfish-9qw9xv459qj3qqv-8000.app.github.dev",
        changeOrigin: true,
        secure: false,
      },
    },
    host: "0.0.0.0",
    port: 5173,
  },
});