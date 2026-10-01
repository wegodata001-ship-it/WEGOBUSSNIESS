export const A11Y_STORAGE_KEY = "wego.accessibility";

export const FONT_SCALES = [0.9, 1, 1.15, 1.3] as const;

export type AccessibilityPrefs = {
  fontScale: number;
  highContrast: boolean;
  grayscale: boolean;
  highlightLinks: boolean;
  largeCursor: boolean;
  reduceMotion: boolean;
  readableFont: boolean;
};

export const DEFAULT_A11Y_PREFS: AccessibilityPrefs = {
  fontScale: 1,
  highContrast: false,
  grayscale: false,
  highlightLinks: false,
  largeCursor: false,
  reduceMotion: false,
  readableFont: false,
};

export function normalizeA11yPrefs(raw: unknown): AccessibilityPrefs {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const scale = typeof data.fontScale === "number" ? data.fontScale : DEFAULT_A11Y_PREFS.fontScale;
  const nearest = FONT_SCALES.reduce((best, item) => Math.abs(item - scale) < Math.abs(best - scale) ? item : best, 1);
  return {
    fontScale: nearest,
    highContrast: data.highContrast === true,
    grayscale: data.grayscale === true,
    highlightLinks: data.highlightLinks === true,
    largeCursor: data.largeCursor === true,
    reduceMotion: data.reduceMotion === true,
    readableFont: data.readableFont === true,
  };
}

export function applyA11yPrefs(prefs: AccessibilityPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--accessibility-font-scale", String(prefs.fontScale));
  const flags: Array<[string, boolean]> = [
    ["data-a11y-contrast", prefs.highContrast],
    ["data-a11y-gray", prefs.grayscale],
    ["data-a11y-links", prefs.highlightLinks],
    ["data-a11y-cursor", prefs.largeCursor],
    ["data-a11y-motion", prefs.reduceMotion],
    ["data-a11y-readable", prefs.readableFont],
  ];
  for (const [name, on] of flags) {
    if (on) root.setAttribute(name, "on");
    else root.removeAttribute(name);
  }
}

export function readStoredA11yPrefs(): AccessibilityPrefs {
  if (typeof window === "undefined") return DEFAULT_A11Y_PREFS;
  try {
    return normalizeA11yPrefs(JSON.parse(window.localStorage.getItem(A11Y_STORAGE_KEY) || "{}"));
  } catch {
    return DEFAULT_A11Y_PREFS;
  }
}

export function writeStoredA11yPrefs(prefs: AccessibilityPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs));
}
