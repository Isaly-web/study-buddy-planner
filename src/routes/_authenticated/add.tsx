import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createAssignment } from "@/lib/exams.functions";
import { createVocabularyDeck } from "@/lib/vocabulary.functions";
import { AppHeader } from "@/components/AppHeader";
import { VocabularySetDialog } from "@/components/VocabularySetDialog";
import { VocabularyPracticeDialog } from "@/components/VocabularyPracticeDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, BookOpenText, GraduationCap, ListChecks, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/add")({
  head: () => ({ meta: [{ title: "Lägg till – Studieplan" }] }),
  component: AddGoal,
});

type Step =
  "choose" | "assignment" | "vocabulary-subject" | "vocabulary-manage" | "vocabulary-practice";

function AddGoal() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("choose");
  const [deck, setDeck] = useState<{ id: string; title: string } | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {step === "choose" ? (
          <ChooseGoalType
            onChooseAssignment={() => setStep("assignment")}
            onChooseVocabulary={() => setStep("vocabulary-subject")}
          />
        ) : step === "assignment" ? (
          <AssignmentForm onBack={() => setStep("choose")} />
        ) : step === "vocabulary-subject" ? (
          <VocabularyDeckForm
            onBack={() => setStep("choose")}
            onCreated={(d) => {
              setDeck(d);
              setStep("vocabulary-manage");
            }}
          />
        ) : null}
      </main>

      {deck ? (
        <>
          <VocabularySetDialog
            topicId={null}
            vocabularySetId={deck.id}
            topicTitle={deck.title}
            open={step === "vocabulary-manage"}
            onOpenChange={(v) => {
              if (!v) setStep("vocabulary-practice");
            }}
          />
          <VocabularyPracticeDialog
            topicId={null}
            vocabularySetId={deck.id}
            topicTitle={deck.title}
            open={step === "vocabulary-practice"}
            onOpenChange={(v) => {
              if (!v) navigate({ to: "/dashboard" });
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function ChooseGoalType({
  onChooseAssignment,
  onChooseVocabulary,
}: {
  onChooseAssignment: () => void;
  onChooseVocabulary: () => void;
}) {
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

        <button type="button" onClick={onChooseVocabulary} className="text-left">
          <Card className="flex h-full flex-col items-start gap-2 p-6 transition-colors hover:border-primary">
            <BookOpenText className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">Ordförråd</h2>
            <p className="text-sm text-muted-foreground">
              En egen glosbok som inte hör till ett prov. Öva den när du vill.
            </p>
          </Card>
        </button>
      </div>
    </>
  );
}

function VocabularyDeckForm({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (deck: { id: string; title: string }) => void;
}) {
  const createFn = useServerFn(createVocabularyDeck);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");

  const create = useMutation({
    mutationFn: (v: { subject: string; title: string }) => createFn({ data: v }),
    onSuccess: (res) => {
      toast.success("Ordlistan är skapad!");
      onCreated({ id: res.id, title: res.title });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Kunde inte skapa ordlistan"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({ subject: subject.trim(), title: title.trim() });
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={onBack} type="button">
        <ArrowLeft className="h-4 w-4" /> Tillbaka
      </Button>

      <h1 className="text-3xl font-bold tracking-tight">Nytt ordförråd</h1>
      <p className="mt-1 text-muted-foreground">
        Ge ordlistan ett namn. I nästa steg lägger du till orden.
      </p>

      <Card className="mt-6 p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="vocab-subject">Ämne</Label>
            <Input
              id="vocab-subject"
              required
              placeholder="t.ex. Engelska"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vocab-title">Namn på ordlistan</Label>
            <Input
              id="vocab-title"
              required
              placeholder="t.ex. Glosor vecka 3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={create.isPending}>
            {create.isPending ? (
              "Skapar…"
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Fortsätt
              </>
            )}
          </Button>
        </form>
      </Card>
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
