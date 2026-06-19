import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        panel: "#11182e",
        edge: "#1e2842",
        muted: "#8a95b5",
        brand: "#6d8bff",
        good: "#3ecf8e",
        warn: "#f5a623",
        bad: "#ff5d6c",
      },
    },
  },
  plugins: [],
} satisfies Config;
