/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f1412",
        rail: "#121815",
        panel: "#151b18",
        hover: "#1a211e",
        active: "#1f2824",
        line: "#25302b",
        line2: "#1d2521",
        faint: "#3a4640",
        fg: "#e4ebe7",
        muted: "#8b9a92",
        dim: "#5f6d66",
        ok: { DEFAULT: "#60d68c", hover: "#7fe0a4" },
        bad: "#f0776b",
        warn: "#e8b85a",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
