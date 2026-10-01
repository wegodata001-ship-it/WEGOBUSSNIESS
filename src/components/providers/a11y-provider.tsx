"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyA11yPrefs,
  DEFAULT_A11Y_PREFS,
  normalizeA11yPrefs,
  readStoredA11yPrefs,
  writeStoredA11yPrefs,
  type AccessibilityPrefs,
} from "@/lib/a11y/prefs";
import { useAuth } from "@/components/providers/auth-provider";

type A11yContextValue = {
  prefs: AccessibilityPrefs;
  setPrefs: (next: AccessibilityPrefs | ((current: AccessibilityPrefs) => AccessibilityPrefs)) => void;
  reset: () => void;
};

const A11yContext = createContext<A11yContextValue>({
  prefs: DEFAULT_A11Y_PREFS,
  setPrefs: () => undefined,
  reset: () => undefined,
});

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [prefs, setPrefsState] = useState<AccessibilityPrefs>(DEFAULT_A11Y_PREFS);

  useEffect(() => {
    const stored = readStoredA11yPrefs();
    setPrefsState(stored);
    applyA11yPrefs(stored);
  }, []);

  const persist = useCallback((next: AccessibilityPrefs) => {
    writeStoredA11yPrefs(next);
    applyA11yPrefs(next);
    if (auth.status === "ready") {
      void fetch("/api/me/accessibility", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => undefined);
    }
  }, [auth.status]);

  const setPrefs = useCallback((next: AccessibilityPrefs | ((current: AccessibilityPrefs) => AccessibilityPrefs)) => {
    setPrefsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      persist(normalizeA11yPrefs(value));
      return normalizeA11yPrefs(value);
    });
  }, [persist]);

  const reset = useCallback(() => {
    setPrefsState(DEFAULT_A11Y_PREFS);
    persist(DEFAULT_A11Y_PREFS);
  }, [persist]);

  const value = useMemo(() => ({ prefs, setPrefs, reset }), [prefs, reset, setPrefs]);
  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useAccessibility() {
  return useContext(A11yContext);
}
