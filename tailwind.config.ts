import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg:           "var(--bg)",
        surface:      "var(--surface)",
        sunken:       "var(--sunken)",
        line:         "var(--line)",
        ink:          "var(--ink)",
        "ink-2":      "var(--ink-2)",
        "ink-3":      "var(--ink-3)",
        accent:       "var(--accent)",
        "accent-press":"var(--accent-press)",
        "accent-soft":"var(--accent-soft)",
        "on-soft":    "var(--on-soft)",
        "data-blue":  "var(--data-blue)",
        "data-violet":"var(--data-violet)",
        "data-teal":  "var(--data-teal)",
        "data-coral": "var(--data-coral)",
        "data-blue-soft":"var(--data-blue-soft)",
        "on-data-blue":"var(--on-data-blue)",
        "data-violet-soft":"var(--data-violet-soft)",
        "on-data-violet":"var(--on-data-violet)",
        "data-teal-soft":"var(--data-teal-soft)",
        "on-data-teal":"var(--on-data-teal)",
        "data-coral-soft":"var(--data-coral-soft)",
        "on-data-coral":"var(--on-data-coral)",
        success:      "var(--success)",
        warning:      "var(--warning)",
        error:        "var(--error)",
        "error-soft": "var(--error-soft)",
        "on-error":   "var(--on-error)",
        "success-soft":"var(--success-soft)",
        "on-success": "var(--on-success)",
        "warning-soft":"var(--warning-soft)",
        "on-warning": "var(--on-warning)",
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        sans:    ["Schibsted Grotesk", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
      },
      boxShadow: {
        card:         "var(--shadow-card)",
        btn:          "var(--shadow-btn)",
        "inset-input":"var(--inset-input)",
      },
      keyframes: {
        fadeInUp: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        ringFill: {
          "0%": { strokeDashoffset: "251.2" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "shimmer":    "shimmer 1.5s ease-in-out infinite",
        "ring-fill":  "ringFill 0.8s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
