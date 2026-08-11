type AnalyticsConfig = { apiKey: string; endpoint?: string };
type QueuedEvent = {
  external_user_id: string | null;
  event_name: string;
  properties?: Record<string, unknown>;
  session_id: string;
  timestamp: string;
};

const DEFAULTS = {
  endpoint: "https://id-preview--a67f56e8-f4d8-4733-bc41-85e5d4e0413b.lovable.app/api/public/track",
  flushIntervalMs: 5000,
  batchSize: 10,
  sessionTimeoutMs: 30 * 60 * 1000,
};

const SESSION_STORAGE_KEY = "__ah_session";

class AnalyticsClient {
  private config: (AnalyticsConfig & typeof DEFAULTS) | null = null;
  private queue: QueuedEvent[] = [];
  private externalUserId: string | null = null;
  private sessionId: string | null = null;
  private lastActivity = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private inited = false;

  init(config: AnalyticsConfig) {
    if (this.inited) return;
    this.config = { ...DEFAULTS, ...config };
    this.inited = true;

    if (typeof window !== "undefined") {
      try {
        const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { sessionId: string; lastActivity: number };
          if (Date.now() - saved.lastActivity < this.config.sessionTimeoutMs) {
            this.sessionId = saved.sessionId;
            this.lastActivity = saved.lastActivity;
          }
        }
      } catch { /* ignore */ }

      this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
      window.addEventListener("beforeunload", () => this.flush(true));
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flush(true);
      });
    }
  }

  identify(externalUserId: string, traits?: Record<string, unknown>) {
    this.externalUserId = externalUserId;
    if (traits) this.track("$identify", { traits });
  }

  startSession() {
    this.sessionId = this.genId();
    this.lastActivity = Date.now();
    this.persistSession();
  }

  private persistSession() {
    if (typeof window === "undefined" || !this.sessionId) return;
    try {
      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ sessionId: this.sessionId, lastActivity: this.lastActivity }),
      );
    } catch { /* ignore */ }
  }

  track(eventName: string, properties?: Record<string, unknown>) {
    if (!this.config) return;
    const now = Date.now();
    if (!this.sessionId || now - this.lastActivity > this.config.sessionTimeoutMs) {
      this.startSession();
    }
    this.lastActivity = now;
    this.persistSession();
    this.queue.push({
      external_user_id: this.externalUserId,
      event_name: eventName,
      properties,
      session_id: this.sessionId!,
      timestamp: new Date(now).toISOString(),
    });
    if (this.queue.length >= this.config.batchSize) this.flush();
  }

  flush(useBeacon = false) {
    if (!this.config || this.queue.length === 0) return;
    const events = this.queue.splice(0, this.queue.length);
    const payload = JSON.stringify({ api_key: this.config.apiKey, events });

    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(this.config.endpoint, new Blob([payload], { type: "application/json" }));
      return;
    }

    fetch(this.config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      this.queue.unshift(...events);
    });
  }

  reset() {
    this.externalUserId = null;
    this.sessionId = null;
    this.lastActivity = 0;
    if (typeof window !== "undefined") {
      try { window.sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* ignore */ }
    }
  }

  private genId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  }
}

export const analytics = new AnalyticsClient();