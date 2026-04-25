import nextPlugin   from "@next/eslint-plugin-next";
import reactPlugin  from "eslint-plugin-react";
import hooksPlugin  from "eslint-plugin-react-hooks";
import tsParser     from "@typescript-eslint/parser";
import tsPlugin     from "@typescript-eslint/eslint-plugin";

const files = ["**/*.{js,jsx,ts,tsx}"];

export default [
  // ── Parser TypeScript pour tous les fichiers TS/TSX ──────────────────
  {
    files,
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: false },  // pas de type-checking complet (plus rapide)
    },
  },

  // ── TypeScript ESLint règles de base ──────────────────────────────────
  {
    files,
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "@typescript-eslint/no-explicit-any":    "off",  // on utilise any dans les routes
      "@typescript-eslint/no-unused-vars":     "warn",
    },
  },

  // ── Règles React ─────────────────────────────────────────────────────
  {
    files,
    plugins:  { react: reactPlugin },
    rules:    {
      ...reactPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",   // Next.js n'a pas besoin de l'import React
      "react/prop-types":          "off",   // TypeScript remplace propTypes
    },
    settings: { react: { version: "detect" } },
  },

  // ── Règles React Hooks ───────────────────────────────────────────────
  {
    files,
    plugins: { "react-hooks": hooksPlugin },
    rules:   { ...hooksPlugin.configs.recommended.rules },
  },

  // ── Règles Next.js core-web-vitals ──────────────────────────────────
  {
    files,
    plugins: { "@next/next": nextPlugin },
    rules:   { ...nextPlugin.configs["core-web-vitals"].rules },
  },

  // ── Ignorer les répertoires générés ─────────────────────────────────
  {
    ignores: [".next/**", "node_modules/**"],
  },
];
