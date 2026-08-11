import { analytics } from "@/lib/analytics-sdk";

const LAST_VISIT_KEY = "isaly_analytics_last_visit";
const ONCE_KEY_PREFIX = "isaly_analytics_once:";
const DAY_MS = 24 * 60 * 60 * 1000;

type AnalyticsProperties = Record<string, unknown>;

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function track(event: string, properties: AnalyticsProperties = {}) {
  if (typeof window === "undefined") return;
  const props = { path: window.location.pathname, ...properties };
  analytics.track(event, props);
}

/**
 * Skickar `event` högst en gång per browser (dedupas i localStorage per event-namn).
 * Använd för milstolpar som `signup_completed`, `first_*` etc.
 * Om localStorage inte finns/kastar faller vi tillbaka på vanlig `track()`.
 */
export function trackOnce(event: string, properties: AnalyticsProperties = {}) {
  if (!isBrowser()) return;
  const key = `${ONCE_KEY_PREFIX}${event}`;
  try {
    if (window.localStorage.getItem(key)) return;
    // Sätt flaggan FÖRST så en race/dubbelklick inte skickar två events.
    window.localStorage.setItem(key, new Date().toISOString());
  } catch {
    // localStorage otillgängligt – fall tillbaka på vanlig track().
    track(event, properties);
    return;
  }
  track(event, properties);
}

/** Test/debug: rensar en specifik once-flagga, eller alla om inget event ges. */
export function resetTrackOnce(event?: string) {
  if (!isBrowser()) return;
  try {
    if (event) {
      window.localStorage.removeItem(`${ONCE_KEY_PREFIX}${event}`);
      return;
    }
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(ONCE_KEY_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Ignore.
  }
}

let lastTrackedPath: string | null = null;

export function trackPageView(path: string) {
  if (!isBrowser()) return;
  // Dedupa: replace-navigation eller effekter som återkör med samma path
  // ska inte räknas som en ny page_view.
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;

  track("page_view", {
    path,
    title: document.title,
    referrer: document.referrer || undefined,
  });

  try {
    const now = Date.now();
    const last = Number(window.localStorage.getItem(LAST_VISIT_KEY) ?? "0");
    if (last > 0 && now - last > DAY_MS) {
      track("return_visit", {
        hours_since_last_visit: Math.round((now - last) / (60 * 60 * 1000)),
      });
    }
    window.localStorage.setItem(LAST_VISIT_KEY, String(now));
  } catch {
    // Ignore storage failures.
  }
}