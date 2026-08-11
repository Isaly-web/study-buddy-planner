import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedExam } from "@/lib/exams.functions";
import { ExamView } from "@/components/ExamView";
import { BookOpenCheck } from "lucide-react";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/shared/$token")({
  head: () => ({
    meta: [
      { title: "Studieplan – delad vy" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedPage,
});

function SharedPage() {
  const { token } = Route.useParams();
  const fn = useServerFn(getSharedExam);
  useEffect(() => {
    track("share_link_opened", { token_prefix: token.slice(0, 8) });
  }, [token]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["shared", token],
    queryFn: () => fn({ data: { token } }),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3 font-semibold sm:px-6">
          <BookOpenCheck className="h-5 w-5 text-primary" />
          Studieplan – delad vy
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-4 rounded-lg bg-accent px-4 py-2 text-sm text-accent-foreground">
          Du tittar på en delad studieplan. Endast läs-läge.
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Laddar…</p>
        ) : error ? (
          <p className="text-destructive">Kunde inte ladda den delade studieplanen. Försök igen senare.</p>
        ) : data ? (
          <ExamView bundle={data} />
        ) : null}
      </main>
    </div>
  );
}