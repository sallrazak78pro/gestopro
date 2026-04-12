// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-syne)", "sans-serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
      },
      colors: {
        // ── Couleurs thématiques (CSS vars) ──────────────
        bg:       "var(--color-bg)",
        surface:  "var(--color-surface)",
        surface2: "var(--color-surface2)",
        border:   "var(--color-border)",
        border2:  "var(--color-border2)",
        muted:    "var(--color-muted)",
        muted2:   "var(--color-muted2)",
        fg:       "var(--color-fg)",
        fg2:      "var(--color-fg2)",
        // ── Couleurs fixes (identiques dark/light) ────────
        accent:   "#00d4ff",
        accent2:  "#7c3aed",
        success:  "#10b981",
        danger:   "#ef4444",
        warning:  "#f59e0b",
      },
      backgroundImage: {
        "gradient-accent":  "linear-gradient(135deg, #00d4ff, #7c3aed)",
        "gradient-surface": "linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.1))",
      },
      borderRadius: { DEFAULT: "0.625rem" },
      boxShadow: {
        accent: "0 0 20px rgba(0, 212, 255, 0.15)",
        card:   "var(--shadow-card)",
      },
      animation: {
        "fade-in":  "fadeIn 0.3s ease forwards",
        "slide-up": "slideUp 0.3s ease forwards",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
