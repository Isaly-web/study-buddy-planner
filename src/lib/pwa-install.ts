// Pure helpers for the "install the app" prompt. No React, no backend.

export type InstallPlatform = "ios" | "android" | "desktop";

const DISMISSED_KEY = "pwa-install-dismissed";
const INSTALLED_KEY = "pwa-install-installed";

/** iPadOS 13+ reports itself as a Mac, so touch support is the tell. */
export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

/** True when the page already runs as an installed app. */
export function isRunningInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: window-controls-overlay)").matches === true
  );
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export const isInstallPromptDismissed = () => readFlag(DISMISSED_KEY);
export const dismissInstallPrompt = () => writeFlag(DISMISSED_KEY);
export const isMarkedInstalled = () => readFlag(INSTALLED_KEY);
export const markInstalled = () => writeFlag(INSTALLED_KEY);

/** Chrome/Edge's non-standard install event. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
