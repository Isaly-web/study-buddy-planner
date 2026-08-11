import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Share2, Copy, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { daysUntil, formatSwedishDate, readinessLabel } from "@/lib/study-helpers";
import { ExercisesDialog } from "@/components/ExercisesDialog";
import { analytics } from "@/lib/analytics-sdk";

export type ExamBundle = {
  exam: {
    id: string;
    subject: string;
    grade: string | null;
    description: string | null;
    exam_date: string;
    share_token: string | null;
  };
  topics: { id: string; title: string; order: number }[];
  tasks: {
    id: string;
    title: string;
    estimated_minutes: number;
    completed_at: string | null;
    day_date: string;
    topic_id: string | null;
    order: number;
  }[];
  readonly: boolean;
};

export function ExamView({
  bundle,
  onToggleTask,
}: {
  bundle: ExamBundle;
  onToggleTask?: (taskId: string, done: boolean) => void;
}) {
  const { exam, topics, tasks, readonly } = bundle;
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

  const tasksByTopic = useMemo(() => {
    return topics.map((tp) => ({
      topic: tp,
      items: tasks.filter((t) => t.topic_id === tp.id),
    }));
  }, [topics, tasks]);

  const today = new Date().toISOString().slice(0, 10);

  const [shareOpen, setShareOpen] = useState(false);
  const [exercise, setExercise] = useState<{ id: string; title: string } | null>(null);
  const shareUrl = exam.share_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${exam.share_token}`
    : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Länk kopierad");
    } catch {
      toast.error("Kunde inte kopiera – markera och kopiera manuellt");
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as any).share({
          title: `Studieplan – ${exam.subject}`,
          text: `Följ min studieplan inför ${exam.subject}`,
          url: shareUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copyLink();
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{exam.subject}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            {formatSwedishDate(exam.exam_date)} ·{" "}
            {dleft > 0 ? `${dleft} dagar kvar` : dleft === 0 ? "Idag!" : "Klart"}
            {exam.grade ? ` · ${exam.grade}` : ""}
          </p>
          {exam.description ? (
            <p className="mt-2 max-w-2xl text-sm text-foreground/80">{exam.description}</p>
          ) : null}
        </div>
        {!readonly && exam.share_token ? (
          <Button variant="outline" onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4" />
            Dela med vårdnadshavare
          </Button>
        ) : null}
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dela med vårdnadshavare</DialogTitle>
            <DialogDescription>
              Kopiera länken nedan och skicka den själv via sms, mejl eller chatt.
              Alla med länken kan se planen – ingen inloggning behövs.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" onClick={copyLink}>
              <Copy className="h-4 w-4" />
              Kopiera
            </Button>
          </div>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <Button type="button" variant="secondary" onClick={nativeShare} className="w-full">
              <Send className="h-4 w-4" />
              Öppna delningsmenyn
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

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
          {done} av {total} uppgifter klara
        </p>
      </Card>

      <Tabs defaultValue="days" className="mt-6">
        <TabsList>
          <TabsTrigger value="days">Dag-för-dag</TabsTrigger>
          <TabsTrigger value="topics">Områden</TabsTrigger>
        </TabsList>

        <TabsContent value="days" className="mt-4 space-y-4">
          {tasksByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga uppgifter.</p>
          ) : (
            tasksByDay.map(([day, items]) => {
              const isToday = day === today;
              const isPast = day < today;
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
                          onCheckedChange={(v) => {
                            if (v === true) {
                              analytics.track("task_completed", {
                                task_id: t.id,
                                exam_id: exam.id,
                                subject: exam.subject,
                                source: "exam_view",
                              });
                            }
                            onToggleTask?.(t.id, v === true);
                          }}
                        />
                        <div className="flex-1">
                          <p className={`${t.completed_at ? "text-muted-foreground line-through" : ""}`}>
                            {t.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{t.estimated_minutes} min</p>
                        </div>
                        {isPast && !t.completed_at && (
                          <span className="text-xs font-medium text-destructive">Missad</span>
                        )}
                        {!readonly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              analytics.track("study_session_started", {
                                task_id: t.id,
                                exam_id: exam.id,
                                subject: exam.subject,
                              });
                              setExercise({ id: t.id, title: t.title });
                            }}
                          >
                            <Sparkles className="h-4 w-4" />
                            Öva
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="topics" className="mt-4 space-y-4">
          {tasksByTopic.map(({ topic, items }) => {
            const tdone = items.filter((i) => i.completed_at).length;
            const tpct = items.length > 0 ? Math.round((tdone / items.length) * 100) : 0;
            return (
              <Card key={topic.id} className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{topic.title}</h3>
                  <span className="text-xs text-muted-foreground">{tdone}/{items.length}</span>
                </div>
                <Progress value={tpct} className="mt-3 h-1.5" />
                <ul className="mt-3 space-y-1.5 text-sm">
                  {items.map((t) => (
                    <li key={t.id} className={t.completed_at ? "text-muted-foreground line-through" : ""}>
                      • {t.title}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
      {!readonly && (
        <ExercisesDialog
          taskId={exercise?.id ?? null}
          taskTitle={exercise?.title ?? ""}
          open={!!exercise}
          onOpenChange={(v) => !v && setExercise(null)}
        />
      )}
    </div>
  );
}