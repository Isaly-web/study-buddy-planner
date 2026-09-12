import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, MessageSquare } from "lucide-react";
import { getMyFeedback, type FeedbackDetail } from "@/lib/feedback.functions";
import {
  statusMeta,
  statusLabel,
  categoryMeta,
  categoryLabel,
  formatDateTime,
} from "@/lib/feedback";

export const Route = createFileRoute("/_authenticated/feedback/$id")({
  head: () => ({
    meta: [
      { title: "Feedback – Studieplan" },
      { name: "description", content: "Detaljer och konversation för din feedback." },
    ],
  }),
  component: FeedbackDetailPage,
});

function FeedbackDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getMyFeedback);
  const query = useQuery<FeedbackDetail>({
    queryKey: ["feedback", "detail", id],
    queryFn: () => getFn({ data: { id } }),
    retry: 1,
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to="/feedback"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Link>

        {query.isLoading ? (
          <Card className="h-40 animate-pulse bg-muted/40" />
        ) : query.isError || !query.data ? (
          <Card className="p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold">Kunde inte ladda feedback</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vi kunde inte nå Feedback-tjänsten just nu. Försök igen om en stund.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => query.refetch()}>
              Försök igen
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusMeta(query.data.status).className}`}
                >
                  {statusLabel(query.data.status)}
                </span>
                {query.data.category && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${categoryMeta(query.data.category).className}`}
                  >
                    {categoryLabel(query.data.category)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  Skickad {formatDateTime(query.data.created_at)}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                {query.data.message}
              </p>
              {query.data.page_url ? (
                <p className="mt-3 truncate text-xs text-muted-foreground">
                  Sida: {query.data.page_url}
                </p>
              ) : null}
            </Card>

            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Konversation</h2>
              {query.data.replies.length === 0 ? (
                <Card className="p-5 text-center text-sm text-muted-foreground">
                  <MessageSquare className="mx-auto mb-2 h-6 w-6" />
                  Inget svar ännu. Vi hör av oss här när vi läst din feedback.
                </Card>
              ) : (
                <ul className="space-y-3">
                  {query.data.replies.map((r) => (
                    <li key={r.id}>
                      <Card className="p-4">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{r.author ?? "Team"}</span>
                          <span>{formatDateTime(r.created_at)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                          {r.message}
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
