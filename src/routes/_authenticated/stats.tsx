import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStats } from "@/lib/stats.functions";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { BarChart3, Sparkles, RotateCcw, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({ meta: [{ title: "Statistik – Studieplan" }] }),
  component: StatsPage,
});

function StatsPage() {
  const fn = useServerFn(getStats);
  const { data, isLoading, error } = useQuery({
    queryKey: ["stats"],
    queryFn: () => fn(),
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Statistik</h1>
            <p className="text-sm text-muted-foreground">Se hur du utvecklas över tid.</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        ) : error ? (
          <p className="text-sm text-destructive">Kunde inte hämta statistik.</p>
        ) : !data ? null : (
          <div className="space-y-6">
            {/* Översikt */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Prov" value={data.totals.exams} />
              <Kpi
                label="Klara uppgifter"
                value={`${data.totals.done_tasks} / ${data.totals.total_tasks}`}
              />
              <Kpi label="Övningar rättade" value={data.totals.attempts} />
              <Kpi
                label="Snittpoäng"
                value={data.totals.avg_score === null ? "–" : `${data.totals.avg_score}/100`}
                sub={
                  data.totals.pass_rate === null
                    ? undefined
                    : `${data.totals.pass_rate}% godkända (≥60)`
                }
              />
            </section>

            {/* Per nivå */}
            <Card className="p-5">
              <h2 className="mb-3 text-lg font-semibold">Rätt/fel per betygsnivå</h2>
              {data.perLevel.every((l) => l.attempts === 0) ? (
                <Empty text="Gör några övningar för att se rättningsstatistik." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {data.perLevel.map((l) => (
                    <div key={l.level} className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Nivå {l.level}</span>
                        <span className="text-xs text-muted-foreground">
                          {l.attempts} övningar
                        </span>
                      </div>
                      <p className="mt-1 text-2xl font-bold">
                        {l.avg_score === null ? "–" : `${l.avg_score}`}
                        <span className="text-sm font-normal text-muted-foreground">/100</span>
                      </p>
                      {l.pass_rate !== null && (
                        <p className="text-xs text-muted-foreground">
                          {l.pass_rate}% godkända
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Per ämne */}
            <Card className="p-5">
              <h2 className="mb-3 text-lg font-semibold">Per ämne</h2>
              {data.perSubject.length === 0 ? (
                <Empty text="Skapa ett prov för att komma igång." />
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer>
                      <BarChart data={data.perSubject}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                        <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="avg_score"
                          name="Snittpoäng"
                          fill="hsl(var(--primary))"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {data.perSubject.map((s) => {
                      const pct = s.total_tasks
                        ? Math.round((s.done_tasks / s.total_tasks) * 100)
                        : 0;
                      return (
                        <li key={s.subject} className="rounded-md border p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{s.subject}</span>
                            <span className="text-xs text-muted-foreground">
                              {s.done_tasks}/{s.total_tasks} uppgifter ·{" "}
                              {s.attempts} övningar ·{" "}
                              {s.avg_score === null ? "–" : `${s.avg_score}/100`}
                            </span>
                          </div>
                          <Progress value={pct} className="mt-2 h-2" />
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Card>

            {/* Per kapitel */}
            <Card className="p-5">
              <h2 className="mb-3 text-lg font-semibold">Per kapitel</h2>
              {data.perTopic.length === 0 ? (
                <Empty text="Områden dyker upp när du har prov med kapitel." />
              ) : (
                <ul className="space-y-2">
                  {data.perTopic.map((t) => {
                    const pct = t.total_tasks
                      ? Math.round((t.done_tasks / t.total_tasks) * 100)
                      : 0;
                    return (
                      <li key={`${t.exam_id}-${t.topic}`} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to="/exam/$examId"
                            params={{ examId: t.exam_id }}
                            className="font-medium hover:underline"
                          >
                            {t.topic}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {t.subject} · {t.attempts} övningar ·{" "}
                            {t.avg_score === null ? "–" : `${t.avg_score}/100`}
                          </span>
                        </div>
                        <Progress value={pct} className="mt-2 h-2" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* Utveckling */}
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <TrendingUp className="h-5 w-5" /> Utveckling (senaste 8 veckor)
              </h2>
              {data.weekly.every((w) => w.attempts === 0 && w.done_tasks === 0) ? (
                <Empty text="Grafen fylls i takt med att du övar och bockar av uppgifter." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <LineChart data={data.weekly}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="avg_score"
                        name="Snittpoäng"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="done_tasks"
                        name="Klara uppgifter"
                        stroke="hsl(var(--accent-foreground))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Repetition */}
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <RotateCcw className="h-5 w-5" /> Repetitionsförslag
              </h2>
              {data.repetition.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Bra jobbat! Inget behöver extra repetition just nu.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.repetition.map((r, i) => (
                    <li key={i} className="rounded-md border bg-muted/30 p-3">
                      <p className="font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}