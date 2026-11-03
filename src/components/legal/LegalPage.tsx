import type { ReactNode } from "react";

// Foundation layout for legal/policy pages (privacy, terms). App-agnostic:
// each app supplies its own sections; structure and styling stay the same.

export type LegalSection = {
  id: string;
  heading: string;
  body: ReactNode;
};

export function LegalPage({
  title,
  lastUpdated,
  intro,
  sections,
}: {
  title: string;
  lastUpdated: ReactNode;
  intro?: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <main className="bg-background px-4 py-10">
      <article className="mx-auto max-w-3xl">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Senast uppdaterad: {lastUpdated}</p>
          {intro && <div className="mt-4 text-sm leading-relaxed [&_a]:underline">{intro}</div>}
        </header>

        <nav aria-label="Innehåll" className="mt-6 rounded-md border border-border p-4 text-sm">
          <p className="font-medium">Innehåll</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-foreground hover:underline">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="mt-8 scroll-mt-6">
            <h2 className="text-lg font-semibold">
              {i + 1}. {s.heading}
            </h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed [&_a]:underline [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
              {s.body}
            </div>
          </section>
        ))}
      </article>
    </main>
  );
}

/** Visibly marks information Isaly still has to provide. Keep the text searchable ("TODO"). */
export function Todo({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-amber-100 px-1 font-mono text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
      [TODO: {children}]
    </mark>
  );
}
