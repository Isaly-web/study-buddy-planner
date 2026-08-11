import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { generateLesson } from "@/lib/exams.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Headphones, Lightbulb, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { PodcastPlayer } from "./PodcastPlayer";
import { track } from "@/lib/analytics";

type Mode = "read" | "listen" | "examples";

export function LessonPanel({
  taskId,
  focusPrompt,
  onDone,
}: {
  taskId: string;
  focusPrompt?: string;
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [level, setLevel] = useState(1);
  const genFn = useServerFn(generateLesson);
  const mutation = useMutation({
    mutationFn: (v: { mode: Mode; level: number }) =>
      genFn({ data: { task_id: taskId, mode: v.mode, level: v.level, focus_prompt: focusPrompt } }),
  });

  useEffect(() => {
    track("lesson_opened", { task_id: taskId, focus_prompt: focusPrompt });
  }, [taskId, focusPrompt]);

  const start = (m: Mode, lvl = 1) => {
    setMode(m);
    setLevel(lvl);
    mutation.mutate({ mode: m, level: lvl });
  };

  const harder = () => {
    const next = Math.min(4, level + 1);
    setLevel(next);
    mutation.mutate({ mode: mode!, level: next });
  };

  const data = mutation.data as any;

  return (
    <Card className="mt-3 p-3 bg-primary/5 border-primary/20">
      {!mode ? (
        <>
          <p className="text-sm font-medium">Lär dig detta först</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Välj hur du vill gå igenom området innan du provar igen.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Button variant="outline" size="sm" onClick={() => start("read")}>
              <BookOpen className="h-4 w-4" /> Läs
            </Button>
            <Button variant="outline" size="sm" onClick={() => start("listen")}>
              <Headphones className="h-4 w-4" /> Lyssna
            </Button>
            <Button variant="outline" size="sm" onClick={() => start("examples")}>
              <Lightbulb className="h-4 w-4" /> Se exempel
            </Button>
          </div>
        </>
      ) : mutation.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Förbereder genomgången…
        </p>
      ) : mutation.error ? (
        <p className="text-sm text-destructive">Kunde inte skapa genomgången. Försök igen.</p>
      ) : data ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{data.title ?? (mode === "examples" ? "Exempel" : "Genomgång")}</p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
                Byt läge
              </Button>
              {level < 4 ? (
                <Button variant="ghost" size="sm" onClick={harder}>
                  <RefreshCcw className="h-3.5 w-3.5" /> Förklara enklare
                </Button>
              ) : null}
            </div>
          </div>

          {mode === "listen" ? (
            <PodcastPlayer text={data.markdown} intro={data.spoken_intro} />
          ) : null}

          {mode === "examples" && Array.isArray(data.examples) ? (
            <div className="space-y-2">
              {data.intro ? <p className="text-sm">{data.intro}</p> : null}
              {data.examples.map((ex: any, i: number) => (
                <div key={i} className="rounded-md border bg-background p-2 text-sm">
                  <p className="font-medium">{ex.title}</p>
                  <p className="mt-1 text-muted-foreground">{ex.body}</p>
                </div>
              ))}
            </div>
          ) : mode !== "listen" && data.markdown ? (
            <div className="prose prose-sm max-w-none text-sm">
              <ReactMarkdown>{data.markdown}</ReactMarkdown>
            </div>
          ) : mode === "listen" && data.markdown ? (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground">Läs manus</summary>
              <div className="prose prose-sm mt-1 max-w-none">
                <ReactMarkdown>{data.markdown}</ReactMarkdown>
              </div>
            </details>
          ) : null}

          <div className="mt-3">
            <Button size="sm" onClick={onDone}>
              <Sparkles className="h-3.5 w-3.5" /> Nu provar vi igen
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}