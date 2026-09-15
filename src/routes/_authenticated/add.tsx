import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createAssignment } from "@/lib/exams.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, ListChecks, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/add")({
  head: () => ({ meta: [{ title: "Lägg till – Studieplan" }] }),
  component: AddGoal,
});

type Step = "choose" | "assignment";

function AddGoal() {
  const [step, setStep] = useState<Step>("choose");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {step === "choose" ? (
          <ChooseGoalType onChooseAssignment={() => setStep("assignment")} />
        ) : (
          <AssignmentForm onBack={() => setStep("choose")} />
        )}
      </main>
    </div>
  );
}

function ChooseGoalType({ onChooseAssignment }: { onChooseAssignment: () => void }) {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Vad vill du lägga till?</h1>
      <p className="mt-1 text-muted-foreground">Välj vad du vill planera för.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link to="/exam/new">
          <Card className="flex h-full flex-col items-start gap-2 p-6 transition-colors hover:border-primary">
            <GraduationCap className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">Prov</h2>
            <p className="text-sm text-muted-foreground">
              Vi bygger en plan dag-för-dag med AI utifrån vad provet handlar om.
            </p>
          </Card>
        </Link>

        <button type="button" onClick={onChooseAssignment} className="text-left">
          <Card className="flex h-full flex-col items-start gap-2 p-6 transition-colors hover:border-primary">
            <ListChecks className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">Läxa</h2>
            <p className="text-sm text-muted-foreground">
              En enkel uppgift med ett förfallodatum. Vi lägger in några studiepass innan den ska
              vara klar.
            </p>
          </Card>
        </button>
      </div>
    </>
  );
}

function AssignmentForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const createFn = useServerFn(createAssignment);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const create = useMutation({
    mutationFn: (v: { subject: string; description: string; due_date: string }) =>
      createFn({ data: v }),
    onSuccess: (res) => {
      toast.success("Läxan är tillagd!");
      navigate({ to: "/exam/$examId", params: { examId: res.id } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Kunde inte spara läxan"),
  });

  const minDate = new Date().toISOString().slice(0, 10);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      subject: subject.trim(),
      description: description.trim(),
      due_date: dueDate,
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={onBack} type="button">
        <ArrowLeft className="h-4 w-4" /> Tillbaka
      </Button>

      <h1 className="text-3xl font-bold tracking-tight">Ny läxa</h1>
      <p className="mt-1 text-muted-foreground">
        Berätta vad läxan handlar om och när den ska vara klar.
      </p>

      <Card className="mt-6 p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Ämne</Label>
            <Input
              id="subject"
              required
              placeholder="t.ex. Matematik"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">Ska vara klar senast</Label>
            <Input
              id="date"
              type="date"
              required
              min={minDate}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Vad ska du göra?</Label>
            <Textarea
              id="desc"
              required
              rows={4}
              placeholder="t.ex. Läs kapitel 5 och svara på frågorna 1-10"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={create.isPending}>
            {create.isPending ? (
              "Sparar…"
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Lägg till läxa
              </>
            )}
          </Button>
        </form>
      </Card>
    </>
  );
}
