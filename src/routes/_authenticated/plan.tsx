import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlanTasks, toggleTask, goalTypeLabel, type PlanTask } from "@/lib/exams.functions";
import { bucketPlanTasks, groupTasksByDate } from "@/lib/plan-helpers";
import { formatSwedishDate } from "@/lib/study-helpers";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";
import { analytics } from "@/lib/analytics-sdk";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({ meta: [{ title: "Plan – Studieplan" }] }),
  component: Plan,
});

function Plan() {
  const qc = useQueryClient();
  const planFn = useServerFn(getPlanTasks);
  const toggleFn = useServerFn(toggleTask);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["plan"],
    queryFn: () => planFn(),
  });

  const toggle = useMutation({
    mutationFn: (v: { task_id: string; done: boolean }) => toggleFn({ data: v }),
    onSuccess: (_res, variables) => {
      if (variables.done) {
        analytics.track("task_completed", { task_id: variables.task_id, source: "plan" });
      }
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      qc.invalidateQueries({ queryKey: ["exams"] });
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const buckets = data ? bucketPlanTasks(data, today) : null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plan</h1>
          <p className="mt-1 text-muted-foreground">Vad ska jag plugga och när?</p>
        </div>

        {isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Laddar…</p>
        ) : error ? (
          <Card className="mt-8 p-8 text-center">
            <AlertCircle className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Kunde inte ladda planen.</p>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-primary underline underline-offset-4"
              onClick={() => refetch()}
            >
              Försök igen
            </button>
          </Card>
        ) : buckets ? (
          <Tabs defaultValue="today" className="mt-6">
            <TabsList>
              <TabsTrigger value="today">Idag</TabsTrigger>
              <TabsTrigger value="week">Denna vecka</TabsTrigger>
              <TabsTrigger value="upcoming">Kommande</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-4">
              {buckets.today.length === 0 ? (
                <EmptyState text="Inget att plugga idag." />
              ) : (
                <SessionList
                  tasks={buckets.today}
                  onToggle={(id, done) => toggle.mutate({ task_id: id, done })}
                />
              )}
            </TabsContent>

            <TabsContent value="week" className="mt-4 space-y-4">
              {buckets.thisWeek.length === 0 ? (
                <EmptyState text="Inget mer inplanerat denna vecka." />
              ) : (
                groupTasksByDate(buckets.thisWeek).map(([day, items]) => (
                  <DayGroup
                    key={day}
                    day={day}
                    items={items}
                    onToggle={(id, done) => toggle.mutate({ task_id: id, done })}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="mt-4 space-y-4">
              {buckets.upcoming.length === 0 ? (
                <EmptyState text="Inget kommande inplanerat än." />
              ) : (
                groupTasksByDate(buckets.upcoming).map(([day, items]) => (
                  <DayGroup
                    key={day}
                    day={day}
                    items={items}
                    onToggle={(id, done) => toggle.mutate({ task_id: id, done })}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </main>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  );
}

function DayGroup({
  day,
  items,
  onToggle,
}: {
  day: string;
  items: PlanTask[];
  onToggle: (taskId: string, done: boolean) => void;
}) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-base font-semibold capitalize">{formatSwedishDate(day)}</h3>
      <SessionList tasks={items} onToggle={onToggle} />
    </Card>
  );
}

function SessionList({
  tasks,
  onToggle,
}: {
  tasks: PlanTask[];
  onToggle: (taskId: string, done: boolean) => void;
}) {
  return (
    <ul className="space-y-2">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50">
          <Checkbox
            className="mt-0.5 h-5 w-5"
            checked={!!t.completed_at}
            onCheckedChange={(v) => onToggle(t.id, v === true)}
          />
          <div className="flex-1">
            <p
              className={`font-medium ${t.completed_at ? "text-muted-foreground line-through" : ""}`}
            >
              {t.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.subject} ·{" "}
              <span className="rounded-full border px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide">
                {goalTypeLabel(t.goal_type)}
              </span>{" "}
              · {t.estimated_minutes} min
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
