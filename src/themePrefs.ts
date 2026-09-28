export type StoredColorScheme = "light" | "dark" | "system";
export type StoredThemeSkin = "default" | "tailwind" | "bootstrap";

const COLOR_KEY = "ff-demo-color-scheme";
const SKIN_KEY = "ff-demo-theme-skin";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readStoredColorScheme(
  fallback: StoredColorScheme = "system",
): StoredColorScheme {
  if (!canUseStorage()) return fallback;
  try {
    const value = localStorage.getItem(COLOR_KEY);
    if (value === "light" || value === "dark" || value === "system") {
      return value;
    }
  } catch {
    /* ignore quota / private mode */
  }
  return fallback;
}

export function writeStoredColorScheme(scheme: StoredColorScheme): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(COLOR_KEY, scheme);
  } catch {
    /* ignore */
  }
}

export function readStoredThemeSkin(
  fallback: StoredThemeSkin = "default",
): StoredThemeSkin {
  if (!canUseStorage()) return fallback;
  try {
    const value = localStorage.getItem(SKIN_KEY);
    if (value === "default" || value === "tailwind" || value === "bootstrap") {
      return value;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeStoredThemeSkin(skin: StoredThemeSkin): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(SKIN_KEY, skin);
  } catch {
    /* ignore */
  }
}
