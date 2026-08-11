import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createExam } from "@/lib/exams.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { analytics } from "@/lib/analytics-sdk";

export const Route = createFileRoute("/_authenticated/exam/new")({
  head: () => ({ meta: [{ title: "Nytt prov – Studieplan" }] }),
  component: NewExam,
});

function NewExam() {
  const navigate = useNavigate();
  const createFn = useServerFn(createExam);
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [examDate, setExamDate] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: (v: { subject: string; grade?: string | null; exam_date: string; description: string }) =>
      createFn({ data: v }),
    onSuccess: (res) => {
      analytics.track("plan_created", { exam_id: res.id, subject: subject.trim(), grade: grade.trim() || null });
      toast.success("Studieplan skapad!");
      navigate({ to: "/exam/$examId", params: { examId: res.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunde inte skapa plan"),
  });

  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      subject: subject.trim(),
      grade: grade.trim() || null,
      exam_date: examDate,
      description: description.trim(),
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Nytt prov</h1>
        <p className="mt-1 text-muted-foreground">
          Berätta lite om provet så bygger vi en plan dag-för-dag.
        </p>

        <Card className="mt-6 p-6">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Ämne</Label>
              <Input id="subject" required placeholder="t.ex. Historia"
                value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={100} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="grade">Årskurs (valfritt)</Label>
                <Input id="grade" placeholder="t.ex. åk 8"
                  value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Provdatum</Label>
                <Input id="date" type="date" required min={minDate}
                  value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc">Vad handlar provet om?</Label>
              <Textarea id="desc" required rows={5}
                placeholder="Skriv kapitel, områden eller vad läraren sagt. Ju mer du skriver, desto bättre plan."
                value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={create.isPending}>
              {create.isPending ? "Skapar plan…" : (<><Sparkles className="h-4 w-4" />Skapa studieplan</>)}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}