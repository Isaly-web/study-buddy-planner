import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Todo, type LegalSection } from "@/components/legal/LegalPage";
import { APP_NAME, SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/app-config";

// Structure only — the binding legal/business wording must come from Isaly.
// Everything marked <Todo> is a placeholder, not a commitment.

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: `Användarvillkor – ${APP_NAME}` },
      { name: "description", content: `Villkor för att använda ${APP_NAME}.` },
    ],
  }),
});

const sections: LegalSection[] = [
  {
    id: "om-tjansten",
    heading: "Om tjänsten",
    body: (
      <>
        <p>
          {APP_NAME} tillhandahålls av <Todo>ISALY LEGAL ENTITY</Todo>, organisationsnummer{" "}
          <Todo>ORGANISATIONSNUMMER</Todo>.
        </p>
        <p>
          Tjänsten hjälper dig att planera inför prov: studieplaner dag för dag, övningar, glosor
          och uppläst ljud, som du också kan dela med en länk.
        </p>
      </>
    ),
  },
  {
    id: "ai-innehall",
    heading: "AI-genererat studieinnehåll",
    body: (
      <>
        <p>
          Planer, övningar, rättning, glosor och uppläst ljud skapas med hjälp av AI och kan
          innehålla fel. Kontrollera mot din kursbok eller lärare. Du ansvarar för hur du använder
          innehållet.
        </p>
        <p>
          <Todo>ANSVARSBEGRÄNSNING OCH GARANTIER – BEKRÄFTA MED JURIST</Todo>
        </p>
      </>
    ),
  },
  {
    id: "konto",
    heading: "Konto och delning",
    body: (
      <>
        <p>
          Du ansvarar för ditt konto och för att hålla dina inloggningsuppgifter hemliga. Din
          inloggning delas med andra Isaly-appar.
        </p>
        <p>
          Den som har en delningslänk till din studieplan kan se planen utan att logga in. Dela bara
          länken med dem du vill ska se den.
        </p>
      </>
    ),
  },
  {
    id: "pris",
    heading: "Pris och betalning",
    body: (
      <p>
        <Todo>PRISMODELL OCH BETALVILLKOR (om tjänsten blir avgiftsbelagd)</Todo>
      </p>
    ),
  },
  {
    id: "support",
    heading: "Support",
    body: (
      <p>
        Frågor? Kontakta <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>. Se även vår{" "}
        <Link to="/privacy">integritetspolicy</Link>.
      </p>
    ),
  },
  {
    id: "andringar",
    heading: "Ändringar och uppsägning",
    body: (
      <p>
        <Todo>VILLKOR FÖR ÄNDRINGAR AV VILLKOREN OCH AVSLUT AV KONTO</Todo>
      </p>
    ),
  },
];

function TermsPage() {
  return (
    <LegalPage
      title="Användarvillkor"
      lastUpdated={<Todo>DATUM FÖR FASTSTÄLLD VERSION</Todo>}
      intro={<p>Genom att använda {APP_NAME} godkänner du de här villkoren.</p>}
      sections={sections}
    />
  );
}
