import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/hooks/purge-feedback-screenshots — deletes feedback screenshots older than
// 12 months (backlog B3, src/lib/feedback-screenshot-retention.server.ts). Auth: Bearer
// <SUPABASE_SERVICE_ROLE_KEY>. Not scheduled until a lawyer has confirmed the period; run
// {"dryRun": true} first.
export const Route = createFileRoute("/api/public/hooks/purge-feedback-screenshots")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handlePurgeRequest } = await import("@/lib/feedback-screenshot-retention.server");
        return handlePurgeRequest(request);
      },
    },
  },
});
