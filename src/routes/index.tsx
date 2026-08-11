import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, CalendarCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studieplan – din personliga plugg-coach" },
      {
        name: "description",
        content:
          "Skapa en dag-för-dag-plan inför nästa prov. Lugn struktur för elever och tydlig översikt för vårdnadshavare.",
      },
      { property: "og:title", content: "Studieplan – din personliga plugg-coach" },
      {
        property: "og:description",
        content: "Skapa en dag-för-dag-plan inför nästa prov.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <BookOpenCheck className="h-6 w-6 text-primary" />
          Studieplan
        </div>
        <Link to="/auth">
          <Button variant="ghost">Logga in</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16 pt-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" /> AI-skapad studieplan
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Vet exakt vad du ska plugga – varje dag.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Berätta vad provet handlar om. Vi delar upp innehållet i tydliga områden och
          fördelar uppgifter dag-för-dag fram till provdagen.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth">
            <Button size="lg">Kom igång</Button>
          </Link>
        </div>

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            { icon: Sparkles, title: "Skapa plan på 30 sek", body: "Ämne, datum, beskrivning – klart." },
            { icon: CalendarCheck, title: "Dag-för-dag", body: "Du ser tydligt vad du ska göra idag." },
            { icon: BookOpenCheck, title: "Dela med förälder", body: "En länk – ingen inloggning krävs." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold text-card-foreground">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
