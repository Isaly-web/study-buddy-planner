import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listMyFeedback, type FeedbackListItem } from "@/lib/feedback.functions";
import { statusMeta, statusLabel, categoryMeta, categoryLabel, formatDate } from "@/lib/feedback";
import { ChevronRight, MessageSquare, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/feedback/")({
  head: () => ({
    meta: [
      { title: "Min feedback – Studieplan" },
      { name: "description", content: "Se status och svar på feedback du skickat in." },
    ],
  }),
  component: FeedbackListPage,
});

function truncate(t: string, n = 140) {
  if (t.length <= n) return t;
  return t.slice(0, n).trimEnd() + "…";
}

function FeedbackListPage() {
  const listFn = useServerFn(listMyFeedback);
  const query = useQuery<FeedbackListItem[]>({
    queryKey: ["feedback", "mine"],
    queryFn: () => listFn(),
    retry: 1,
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Min feedback</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Här ser du feedback du skickat in och svaren du fått.
          </p>
        </div>

        {query.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="h-24 animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : query.isError ? (
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
        ) : !query.data || query.data.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold">Ingen feedback ännu</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Använd Feedback-knappen längst ner till höger för att skicka något till oss.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {query.data.map((item) => (
              <li key={item.id}>
                <Link to="/feedback/$id" params={{ id: item.id }} className="block">
                  <Card className="p-4 transition-colors hover:bg-accent/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusMeta(item.status).className}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                          {item.category && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${categoryMeta(item.category).className}`}
                            >
                              {categoryLabel(item.category)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-foreground">{truncate(item.message)}</p>
                      </div>
                      <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
