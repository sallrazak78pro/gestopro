// components/ui/ThemeToggle.tsx
"use client";
import { useTheme } from "@/components/providers/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      className="relative w-14 h-7 rounded-full border transition-all duration-300 flex items-center px-1 shrink-0"
      style={{
        background:   isDark ? "rgba(0,212,255,0.15)" : "rgba(0,0,0,0.08)",
        borderColor:  isDark ? "rgba(0,212,255,0.3)"  : "rgba(0,0,0,0.15)",
      }}
    >
      {/* Track icons */}
      <span className="absolute left-1.5 text-[11px] select-none">🌙</span>
      <span className="absolute right-1.5 text-[11px] select-none">☀️</span>

      {/* Thumb */}
      <span
        className="relative z-10 w-5 h-5 rounded-full shadow-md transition-all duration-300 flex items-center justify-center text-[11px]"
        style={{
          transform:       isDark ? "translateX(0)"    : "translateX(28px)",
          background:      isDark ? "#00d4ff"          : "#f59e0b",
          boxShadow:       isDark ? "0 0 8px rgba(0,212,255,0.5)" : "0 0 8px rgba(245,158,11,0.5)",
        }}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
