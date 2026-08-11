import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  generateExercises,
  gradeAnswer,
  coachAnswer,
  generateVariantQuestion,
} from "@/lib/exams.functions";
import { saveAttempt } from "@/lib/stats.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Lightbulb, CheckCircle2, Heart, Loader2 } from "lucide-react";
import { LessonPanel } from "./LessonPanel";
import { track } from "@/lib/analytics";

const levelStyles: Record<"E" | "C" | "A", string> = {
  E: "bg-emerald-100 text-emerald-800",
  C: "bg-sky-100 text-sky-800",
  A: "bg-violet-100 text-violet-800",
};

const levelLabels: Record<"E" | "C" | "A", string> = {
  E: "Nivå E – Grundläggande",
  C: "Nivå C – Utvecklad",
  A: "Nivå A – Välutvecklad",
};

export function ExercisesDialog({
  taskId,
  taskTitle,
  open,
  onOpenChange,
}: {
  taskId: string | null;
  taskTitle: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const genFn = useServerFn(generateExercises);
  const { data, isLoading, error } = useQuery({
    queryKey: ["exercises", taskId],
    queryFn: () => genFn({ data: { task_id: taskId! } }),
    enabled: open && !!taskId,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (open && taskId && data) {
      track("exercise_started", { task_id: taskId, task_title: taskTitle });
    }
  }, [open, taskId, taskTitle, data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Instuderingsuppgifter
          </DialogTitle>
          <DialogDescription>{taskTitle}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Skapar övningar på olika betygsnivåer…
          </p>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">
            Kunde inte skapa övningar. Försök igen.
          </p>
        ) : data ? (
          <div className="space-y-4">
            {(["E", "C", "A"] as const).map((lvl) => {
              const block = (data as any)[lvl];
              if (!block) return null;
              return (
                <Card key={lvl} className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${levelStyles[lvl]}`}
                    >
                      {levelLabels[lvl]}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80">{block.criteria}</p>
                  <ul className="mt-3 space-y-2">
                    {block.exercises.map((ex: any, i: number) => (
                      <li key={i} className="rounded-md border bg-muted/40 p-3 text-sm">
                        <ExerciseItem
                          taskId={taskId}
                          level={lvl}
                          criteria={block.criteria}
                          index={i}
                          prompt={ex.prompt}
                          hint={ex.hint}
                        />
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ExerciseItem({
  taskId,
  level,
  criteria,
  index,
  prompt,
  hint,
}: {
  taskId: string | null;
  level: "E" | "C" | "A";
  criteria: string;
  index: number;
  prompt: string;
  hint?: string;
}) {
  const [currentPrompt, setCurrentPrompt] = useState(prompt);
  const [currentHint, setCurrentHint] = useState<string | undefined>(hint);
  const [answer, setAnswer] = useState("");
  const [attempt, setAttempt] = useState(1);
  const [hintsGiven, setHintsGiven] = useState<{ text: string; explanation?: string | null }[]>([]);
  const [solved, setSolved] = useState(false);
  const [showLearnFirst, setShowLearnFirst] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);

  const coachFn = useServerFn(coachAnswer);
  const gradeFn = useServerFn(gradeAnswer);
  const variantFn = useServerFn(generateVariantQuestion);
  const saveFn = useServerFn(saveAttempt);

  const coach = useMutation({
    mutationFn: (a: string) =>
      coachFn({
        data: {
          task_id: taskId!,
          level,
          criteria,
          prompt: currentPrompt,
          answer: a,
          attempt,
          previous_hints: hintsGiven.map((h) => h.text),
        },
      }),
    onSuccess: (res: any) => {
      track("answer_graded", {
        task_id: taskId,
        level,
        is_correct: Boolean(res.is_correct),
        attempt,
      });
      if (res.is_correct) {
        setSolved(true);
        // Slutförd — spara ett rättningsförsök (grade) i bakgrunden så statistiken blir korrekt.
        gradeFn({
          data: { task_id: taskId!, level, criteria, prompt: currentPrompt, answer },
        })
          .then((g: any) => {
            saveFn({
              data: {
                task_id: taskId!,
                level,
                score: g.score,
                answer,
                feedback: {
                  verdict: g.verdict,
                  encouragement: g.encouragement,
                  feedback: g.feedback,
                  improvements: g.improvements ?? [],
                  reached_level: g.reached_level,
                },
                attempts_used: attempt,
                used_help: {
                  hints: hintsGiven.length,
                  lesson_used: lessonOpen || showLearnFirst,
                },
              },
            }).catch(() => {});
          })
          .catch(() => {
            // Om rättningen missar sparar vi ändå ett minimalt attempt.
            saveFn({
              data: {
                task_id: taskId!,
                level,
                score: 100,
                answer,
                feedback: { verdict: "correct", encouragement: res.encouragement },
                attempts_used: attempt,
                used_help: { hints: hintsGiven.length },
              },
            }).catch(() => {});
          });
      } else {
        setHintsGiven((prev) => [
          ...prev,
          { text: res.hint, explanation: res.explanation ?? null },
        ]);
        if (res.offer_learn_first || attempt >= 2) setShowLearnFirst(true);
        setAttempt((a) => a + 1);
        // Spara även felaktiga försök så att statistik och repetitionsförslag blir korrekta.
        saveFn({
          data: {
            task_id: taskId!,
            level,
            score: 0,
            answer,
            feedback: {
              verdict: "incorrect",
              hint: res.hint,
              explanation: res.explanation ?? null,
            },
            attempts_used: attempt,
            used_help: {
              hints: hintsGiven.length + 1,
              lesson_used: lessonOpen || showLearnFirst,
            },
          },
        }).catch(() => {});
      }
    },
  });

  const variant = useMutation({
    mutationFn: (easier: boolean) =>
      variantFn({
        data: { task_id: taskId!, level, criteria, previous_prompt: currentPrompt, easier },
      }),
    onSuccess: (res: any) => {
      setCurrentPrompt(res.prompt);
      setCurrentHint(res.hint);
      setAnswer("");
      setAttempt(1);
      setHintsGiven([]);
      setShowLearnFirst(false);
      setLessonOpen(false);
      setSolved(false);
    },
  });

  return (
    <div>
      <p className="font-medium">
        {index + 1}. {currentPrompt}
      </p>
      {currentHint ? (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5" />
          {currentHint}
        </p>
      ) : null}

      {solved ? (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" /> Rätt!
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-sm">
            <Heart className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{(coach.data as any)?.encouragement}</span>
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => variant.mutate(false)} disabled={variant.isPending}>
              {variant.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Ny liknande fråga
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Textarea
            className="mt-2 min-h-[70px] bg-background"
            placeholder="Skriv ditt svar här…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={coach.isPending}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => coach.mutate(answer)}
              disabled={!answer.trim() || coach.isPending || !taskId}
            >
              {coach.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Kollar…
                </>
              ) : attempt === 1 ? (
                "Rätta mitt svar"
              ) : (
                "Prova igen"
              )}
            </Button>
            {hintsGiven.length ? (
              <span className="text-xs text-muted-foreground">Försök {attempt}</span>
            ) : null}
            {hintsGiven.length && !showLearnFirst ? (
              <Button variant="ghost" size="sm" onClick={() => setShowLearnFirst(true)}>
                Jag behöver hjälp
              </Button>
            ) : null}
          </div>
          {coach.error ? (
            <p className="mt-2 text-xs text-destructive">Kunde inte hjälpa till just nu. Försök igen.</p>
          ) : null}

          {hintsGiven.map((h, i) => (
            <div
              key={i}
              className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900"
            >
              <p className="flex items-start gap-1.5">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong>Ledtråd {i + 1}:</strong> {h.text}
                </span>
              </p>
              {h.explanation ? <p className="mt-1 text-xs">{h.explanation}</p> : null}
            </div>
          ))}

          {showLearnFirst && !lessonOpen ? (
            <div className="mt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setLessonOpen(true);
                }}
              >
                <Sparkles className="h-3.5 w-3.5" /> Lär dig detta först
              </Button>
            </div>
          ) : null}

          {lessonOpen && taskId ? (
            <LessonPanel
              taskId={taskId}
              focusPrompt={currentPrompt}
              onDone={() => variant.mutate(true)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}