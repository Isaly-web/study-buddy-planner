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
        <p>{APP_NAME} tillhandahålls av Isaly AB, organisationsnummer 559472-5763.</p>
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
      </>
    ),
  },
  {
    id: "beta-ansvar",
    heading: "Betatjänst och ansvar",
    body: (
      <>
        <p>
          {APP_NAME} är en betatjänst. Den tillhandahålls i befintligt skick och utan garantier för
          att den är felfri, alltid tillgänglig eller lämpar sig för ett visst ändamål.
        </p>
        <p>
          Isaly AB:s ansvar för skada är begränsat så långt lagen tillåter. Begränsningen gäller
          aldrig skada som orsakats med uppsåt eller av grov vårdslöshet.
        </p>
        <p>
          Om du är konsument gäller dina rättigheter enligt tvingande konsumentlagstiftning oavsett
          vad som står i dessa villkor. Ingenting i villkoren inskränker dem.
        </p>
        <p>Särskilt för {APP_NAME}:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            AI-resultat: Resultat som skapas med hjälp av AI kan innehålla fel eller vara
            ofullständiga och ska kontrolleras innan du förlitar dig på dem. Kontrollera
            studieinnehåll mot din kursbok eller lärare.
          </li>
        </ul>
        <p>
          <Todo>JURIST SKA GRANSKA AVSNITTET BETATJÄNST OCH ANSVAR (INKL. KONSUMENTSKYDD)</Todo>
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
    id: "alder",
    heading: "Ålderskrav",
    body: (
      <p>
        Du måste vara minst 13 år för att skapa konto och använda {APP_NAME}. När du skapar konto
        intygar du att du uppfyller kravet. Vi får radera konton som tillhör personer under 13 år.
      </p>
    ),
  },
  {
    id: "pris",
    heading: "Pris och betalning",
    body: (
      <p>
        Tjänsten är kostnadsfri under betaperioden.{" "}
        <Todo>PRISMODELL OCH BETALVILLKOR EFTER BETAPERIODEN</Todo>
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
      lastUpdated="2026-11-05"
      intro={<p>Genom att använda {APP_NAME} godkänner du de här villkoren.</p>}
      sections={sections}
    />
  );
}
