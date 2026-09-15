import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listExams,
  getTodayTasks,
  toggleTask,
  deleteExam,
  supportsExerciseTutor,
} from "@/lib/exams.functions";
import { listVocabularyPracticeItems } from "@/lib/vocabulary.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { AppHeader } from "@/components/AppHeader";
import { AlertCircle, CalendarDays, BookOpenText, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { readinessLabel, daysUntil } from "@/lib/study-helpers";
import { useState } from "react";
import { ExercisesDialog } from "@/components/ExercisesDialog";
import { VocabularyPracticeDialog } from "@/components/VocabularyPracticeDialog";
import { analytics } from "@/lib/analytics-sdk";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Mina prov – Studieplan" }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listExams);
  const todayFn = useServerFn(getTodayTasks);
  const toggleFn = useServerFn(toggleTask);
  const deleteFn = useServerFn(deleteExam);
  const vocabPracticeFn = useServerFn(listVocabularyPracticeItems);
  const [exercise, setExercise] = useState<{ id: string; title: string } | null>(null);
  const [vocabPractice, setVocabPractice] = useState<{ id: string; title: string } | null>(null);

  const exams = useQuery({ queryKey: ["exams"], queryFn: () => listFn() });
  const today = useQuery({ queryKey: ["today"], queryFn: () => todayFn() });
  const vocab = useQuery({
    queryKey: ["vocabulary-overview", "all"],
    queryFn: () => vocabPracticeFn(),
  });

  const toggle = useMutation({
    mutationFn: (v: { task_id: string; done: boolean }) => toggleFn({ data: v }),
    onSuccess: (_res, variables) => {
      if (variables.done) {
        analytics.track("task_completed", { task_id: variables.task_id, source: "dashboard" });
      }
      qc.invalidateQueries({ queryKey: ["today"] });
      qc.invalidateQueries({ queryKey: ["exams"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Provet togs bort");
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["today"] });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hej!</h1>
          <p className="mt-1 text-muted-foreground">Här är din studieöversikt för idag.</p>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Dagens uppgifter</h2>
          <Card className="p-5">
            {today.isLoading ? (
              <p className="text-sm text-muted-foreground">Laddar…</p>
            ) : today.isError ? (
              <div className="text-center">
                <AlertCircle className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Kunde inte ladda dagens uppgifter.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => today.refetch()}>
                  Försök igen
                </Button>
              </div>
            ) : (today.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Inget att göra idag. {exams.data?.length ? "Bra jobbat – ta en paus 🌿" : "Lägg till något att plugga för att komma igång."}
              </p>
            ) : (
              <ul className="space-y-2">
                {today.data!.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50">
                    <Checkbox
                      className="mt-0.5 h-5 w-5"
                      checked={!!t.completed_at}
                      onCheckedChange={(v) => toggle.mutate({ task_id: t.id, done: v === true })}
                    />
                    <div className="flex-1">
                      <p className={`font-medium ${t.completed_at ? "text-muted-foreground line-through" : ""}`}>
                        {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{t.subject} · {t.estimated_minutes} min</p>
                    </div>
                    {supportsExerciseTutor(t.goal_type) ? (
                      <Button
                        variant={t.completed_at ? "outline" : "default"}
                        size="sm"
                        onClick={() => setExercise({ id: t.id, title: t.title })}
                      >
                        <Sparkles className="h-4 w-4" />
                        {t.completed_at ? "Öva igen" : "Gör uppgift"}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Öva ordförråd</h2>
          {vocab.isLoading ? (
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Laddar…</p>
            </Card>
          ) : vocab.isError ? (
            <Card className="p-5 text-center">
              <AlertCircle className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Kunde inte ladda ordförrådet.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => vocab.refetch()}>
                Försök igen
              </Button>
            </Card>
          ) : !vocab.data?.length ? (
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">
                Inget ordförråd att öva ännu. Lägg till ord under ett prov för att börja öva här.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {vocab.data.map((v) => (
                <Card key={v.topic_id} className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{v.topic_title}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{v.exam_subject}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {v.term_count} ord ·{" "}
                    {v.accuracy !== null ? `${v.accuracy}% rätt` : "Inte övat än"}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => setVocabPractice({ id: v.topic_id, title: v.topic_title })}
                  >
                    <BookOpenText className="h-4 w-4" />
                    Öva
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Kommande</h2>
            {exams.data?.length ? (
              <Link to="/add">
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                  Lägg till
                </Button>
              </Link>
            ) : null}
          </div>
          {exams.isLoading ? (
            <p className="text-sm text-muted-foreground">Laddar…</p>
          ) : exams.isError ? (
            <Card className="p-8 text-center">
              <AlertCircle className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Kunde inte ladda dina mål.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => exams.refetch()}>
                Försök igen
              </Button>
            </Card>
          ) : !exams.data?.length ? (
            <Card className="flex flex-col items-center p-10 text-center">
              <Sparkles className="h-8 w-8 text-primary" />
              <h3 className="mt-3 text-lg font-semibold">Inget att plugga på än</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Lägg till ett prov eller en läxa så bygger vi en plan dag-för-dag.
              </p>
              <Link to="/add" className="mt-4">
                <Button>+ Lägg till</Button>
              </Link>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {exams.data.map((e) => {
                const pct = e.total_tasks > 0 ? Math.round((e.done_tasks / e.total_tasks) * 100) : 0;
                const dleft = daysUntil(e.exam_date);
                const isAssignment = e.goal_type === "assignment";
                return (
                  <Card key={e.id} className="group relative p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{e.subject}</h3>
                          <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {isAssignment ? "Läxa" : "Prov"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <CalendarDays className="mr-1 inline h-3 w-3" />
                          {dleft > 0 ? `${dleft} dagar kvar` : dleft === 0 ? "Idag!" : "Klart"}
                        </p>
                      </div>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                        {readinessLabel(pct)}
                      </span>
                    </div>
                    <div className="mt-4">
                      <Progress value={pct} className="h-2" />
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {e.done_tasks} av {e.total_tasks} uppgifter klara
                      </p>
                    </div>
                    <div className="mt-4">
                      <Link to="/exam/$examId" params={{ examId: e.id }}>
                        <Button size="sm" className="w-full sm:w-auto">
                          {isAssignment ? "Öppna läxa" : "Öppna prov"}
                        </Button>
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        if (confirm(`Ta bort "${e.subject}"?`)) del.mutate(e.id);
                      }}
                      className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-destructive group-hover:opacity-100"
                      aria-label={isAssignment ? "Ta bort läxa" : "Ta bort prov"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <ExercisesDialog
        taskId={exercise?.id ?? null}
        taskTitle={exercise?.title ?? ""}
        open={!!exercise}
        onOpenChange={(v) => !v && setExercise(null)}
      />
      <VocabularyPracticeDialog
        topicId={vocabPractice?.id ?? null}
        topicTitle={vocabPractice?.title ?? ""}
        open={!!vocabPractice}
        onOpenChange={(v) => !v && setVocabPractice(null)}
      />
    </div>
  );
}