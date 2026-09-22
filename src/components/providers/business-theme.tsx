"use client";

import { useEffect } from "react";
import type { Business } from "@/types/business";

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function BusinessTheme({ business }: { business: Business | null }) {
  useEffect(() => {
    const root = document.documentElement;
    const primary = business?.primaryColor || "#2563eb";
    const secondary = business?.secondaryColor || "#0f766e";
    root.style.setProperty("--brand-primary", primary);
    root.style.setProperty("--brand-secondary", secondary);

    const rgb = hexToRgb(primary);
    if (rgb) {
      root.style.setProperty("--brand-primary-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
    }
  }, [business]);

  return null;
}
