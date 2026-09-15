import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { CalendarDays } from "lucide-react";
import { daysUntil, formatSwedishDate, readinessLabel } from "@/lib/study-helpers";

export type AssignmentBundle = {
  exam: {
    id: string;
    subject: string;
    description: string | null;
    exam_date: string;
  };
  tasks: {
    id: string;
    title: string;
    estimated_minutes: number;
    completed_at: string | null;
    day_date: string;
    order: number;
  }[];
  readonly: boolean;
};

// Lightweight goal-detail view for goal_type = "assignment": subject,
// description, due date, progress and study sessions only. No topics,
// no vocabulary, no AI tutor -- those are exam-only.
export function AssignmentView({
  bundle,
  onToggleTask,
}: {
  bundle: AssignmentBundle;
  onToggleTask?: (taskId: string, done: boolean) => void;
}) {
  const { exam, tasks, readonly } = bundle;
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed_at).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const dleft = daysUntil(exam.exam_date);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    tasks.forEach((t) => {
      const arr = map.get(t.day_date) ?? [];
      arr.push(t);
      map.set(t.day_date, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{exam.subject}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {formatSwedishDate(exam.exam_date)} ·{" "}
          {dleft > 0 ? `${dleft} dagar kvar` : dleft === 0 ? "Idag!" : "Klart"}
        </p>
        {exam.description ? (
          <p className="mt-2 max-w-2xl text-sm text-foreground/80">{exam.description}</p>
        ) : null}
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Framsteg</p>
            <p className="text-2xl font-semibold">{pct}%</p>
          </div>
          <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            {readinessLabel(pct)}
          </span>
        </div>
        <Progress value={pct} className="mt-3 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {done} av {total} pass klara
        </p>
      </Card>

      <div className="mt-6 space-y-4">
        {tasksByDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga studiepass.</p>
        ) : (
          tasksByDay.map(([day, items]) => {
            const isToday = day === today;
            return (
              <Card key={day} className={`p-5 ${isToday ? "ring-2 ring-primary" : ""}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold capitalize">
                    {formatSwedishDate(day)}
                    {isToday && (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                        Idag
                      </span>
                    )}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {items.reduce((a, b) => a + b.estimated_minutes, 0)} min
                  </span>
                </div>
                <ul className="space-y-2">
                  {items.map((t) => (
                    <li key={t.id} className="flex items-start gap-3">
                      <Checkbox
                        className="mt-0.5 h-5 w-5"
                        checked={!!t.completed_at}
                        disabled={readonly}
                        onCheckedChange={(v) => onToggleTask?.(t.id, v === true)}
                      />
                      <div className="flex-1">
                        <p className={t.completed_at ? "text-muted-foreground line-through" : ""}>
                          {t.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{t.estimated_minutes} min</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
