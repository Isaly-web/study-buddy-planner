import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getExam, toggleTask } from "@/lib/exams.functions";
import { AppHeader } from "@/components/AppHeader";
import { ExamView } from "@/components/ExamView";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exam/$examId")({
  head: () => ({ meta: [{ title: "Studieplan" }] }),
  component: ExamDetail,
});

function ExamDetail() {
  const { examId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getExam);
  const toggleFn = useServerFn(toggleTask);

  const { data, isLoading, error } = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => getFn({ data: { id: examId } }),
  });

  const toggle = useMutation({
    mutationFn: (v: { task_id: string; done: boolean }) => toggleFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam", examId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      qc.invalidateQueries({ queryKey: ["exams"] });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Tillbaka
          </Button>
        </Link>
        {isLoading ? (
          <p className="text-muted-foreground">Laddar…</p>
        ) : error ? (
          <p className="text-destructive">Kunde inte ladda provet. Försök igen.</p>
        ) : data ? (
          <ExamView
            bundle={data}
            onToggleTask={(task_id, done) => toggle.mutate({ task_id, done })}
          />
        ) : null}
      </main>
    </div>
  );
}