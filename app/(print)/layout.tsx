// app/(print)/layout.tsx
import React from "react";
import type { Metadata } from "next";
import { Syne, DM_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import "../globals.css";
import "./print.css";

const syne   = Syne  ({ subsets: ["latin"], variable: "--font-syne" });
const dmMono = DM_Mono({ subsets: ["latin"], variable: "--font-dm-mono", weight: ["300","400","500"] });

export const metadata: Metadata = { title: "GestoPro — Impression" };

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${syne.variable} ${dmMono.variable}`}>
      <body className="print-body">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
