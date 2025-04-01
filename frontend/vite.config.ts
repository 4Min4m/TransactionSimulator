import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "https://l52qftihwf.execute-api.us-east-1.amazonaws.com/prod/proxy",
        changeOrigin: true,
        secure: false,
      },
    },
    host: "0.0.0.0",
    port: 5173,
  },
});