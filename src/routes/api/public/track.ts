// POST /api/public/track
// Passthrough to Isaly Platform's Analytics Service (isaly-platform-prod),
// same role as feedback.functions.ts has for Feedback Hub — this app
// forwards to the central Hub using its own project API key, never exposed
// to the client. Unlike feedback (submitted by an authenticated user via a
// server-fn), analytics events fire for anonymous visitors too and must
// survive page unload (sendBeacon), so this stays a plain public route
// instead of a requireSupabaseAuth server-fn.
import { createFileRoute } from "@tanstack/react-router";

const HUB_URL = "https://feedback.isaly.se/api/public/v1/analytics/events";

type IncomingEvent = {
  external_user_id?: string | null;
  event_name?: string;
  properties?: Record<string, unknown>;
  session_id?: string;
  timestamp?: string;
};

const MAX_EVENTS_PER_REQUEST = 200;

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const hubApiKey = process.env.ANALYTICS_HUB_API_KEY;
        if (!hubApiKey) {
          return new Response("Analytics Hub är inte konfigurerad.", { status: 500 });
        }

        let body: { events?: IncomingEvent[] };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const events = Array.isArray(body.events) ? body.events : [];
        if (events.length === 0) {
          return Response.json({ ok: true, forwarded: 0 });
        }

        const events_ = events
          .slice(0, MAX_EVENTS_PER_REQUEST)
          .filter(
            (e): e is IncomingEvent & { event_name: string; session_id: string } =>
              typeof e.event_name === "string" &&
              e.event_name.length > 0 &&
              typeof e.session_id === "string" &&
              e.session_id.length > 0,
          )
          .map((e) => ({
            eventName: e.event_name,
            externalUserId: e.external_user_id ?? null,
            sessionId: e.session_id,
            occurredAt: e.timestamp,
            properties: e.properties ?? {},
          }));

        if (events_.length === 0) {
          return Response.json({ ok: true, forwarded: 0 });
        }

        try {
          const res = await fetch(HUB_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${hubApiKey}`,
              "Content-Type": "application/json",
              "User-Agent": "StudyBuddyPlanner-Analytics/1.0",
            },
            body: JSON.stringify({ events: events_ }),
          });
          if (!res.ok) {
            console.error(
              "[analytics track] hub responded",
              res.status,
              await res.text().catch(() => ""),
            );
            return new Response("Hub error", { status: 502 });
          }
        } catch (err) {
          console.error("[analytics track] hub network error", err);
          return new Response("Hub unreachable", { status: 502 });
        }

        return Response.json({ ok: true, forwarded: events_.length });
      },
    },
  },
});
