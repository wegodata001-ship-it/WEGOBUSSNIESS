import type { CatalogSetting } from "@/types/catalog-setting";

export const FALLBACK_CATEGORY_COLOR = "#64748b";

function parseHex(value: string) {
  const hex = value.trim().replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function categoryColorOrFallback(color: string | null | undefined) {
  return parseHex(color ?? "") ? (color!.startsWith("#") ? color! : `#${color}`) : FALLBACK_CATEGORY_COLOR;
}

export function rgbaFromHex(color: string, alpha: number) {
  const rgb = parseHex(categoryColorOrFallback(color)) ?? { r: 100, g: 116, b: 139 };
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function darkenHex(color: string, amount = 0.35) {
  const rgb = parseHex(categoryColorOrFallback(color)) ?? { r: 100, g: 116, b: 139 };
  const mix = (channel: number) => Math.round(channel * (1 - amount));
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
}

export function categoryStyles(color: string | null | undefined) {
  const hex = categoryColorOrFallback(color);
  return {
    hex,
    border: rgbaFromHex(hex, 0.22),
    background: rgbaFromHex(hex, 0.07),
    badge: rgbaFromHex(hex, 0.16),
    badgeText: darkenHex(hex, 0.42),
    progress: hex,
  };
}

export function buildCategoryMap(settings: CatalogSetting[], projectCategories: Array<string | null | undefined>) {
  const map = new Map<string, CatalogSetting>();
  for (const item of settings) {
    if (item.type !== "PROJ_CATEGORY" || !item.value) continue;
    map.set(item.value, item);
  }
  for (const name of projectCategories) {
    if (!name || map.has(name)) continue;
    map.set(name, {
      id: name,
      businessId: "",
      legacyId: name,
      type: "PROJ_CATEGORY",
      value: name,
      color: FALLBACK_CATEGORY_COLOR,
      createdAt: null,
      updatedAt: null,
    });
  }
  return map;
}
