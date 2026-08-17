import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, defaultSettings } from "./db/db";
import type { AppSettings } from "./db/types";

export function useSettings(): AppSettings {
  // Read-only inside liveQuery; getSettings() (which may write defaults)
  // must never run here — writes are forbidden in a liveQuery context.
  const s = useLiveQuery(() => db.settings.get("app"), []);
  return s ?? defaultSettings();
}

/** Like useSettings but distinguishes "still loading" from "no settings row". */
export function useSettingsLoaded(): { settings: AppSettings; loaded: boolean } {
  const s = useLiveQuery(async () => (await db.settings.get("app")) ?? null, []);
  return { settings: s ?? defaultSettings(), loaded: s !== undefined };
}

/** Apply theme from settings to <html data-theme>. */
export function useTheme(settings: AppSettings) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme =
        settings.theme === "system" ? (prefersDark ? "dark" : "light") : settings.theme;
      root.setAttribute("data-theme", theme);
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);
}

/**
 * Debounced autosave. Call save(entity) on every edit; it persists after
 * `delay` ms of inactivity and flushes on unmount/pagehide so drafts are
 * never lost when the app is closed mid-edit.
 */
export function useAutosave<T>(persist: (value: T) => Promise<void>, delay = 600) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<T | null>(null);
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const flush = () => {
      if (pending.current !== null) {
        const v = pending.current;
        pending.current = null;
        void persistRef.current(v);
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  return {
    saving,
    save(value: T) {
      pending.current = value;
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (pending.current === null) return;
        const v = pending.current;
        pending.current = null;
        setSaving(true);
        try {
          await persistRef.current(v);
        } finally {
          setSaving(false);
        }
      }, delay);
    },
    async flushNow(value?: T) {
      clearTimeout(timer.current);
      const v = value ?? pending.current;
      pending.current = null;
      if (v !== null && v !== undefined) await persistRef.current(v);
    }
  };
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export { db, useLiveQuery };
