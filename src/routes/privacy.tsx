import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Todo, type LegalSection } from "@/components/legal/LegalPage";
import { APP_NAME, SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/app-config";

// Content reflects what the repository actually does. Anything Isaly must decide or confirm is
// marked with <Todo>. Do not remove a TODO without a legal/business decision behind the
// replacement text. List only subprocessors the code actually uses.

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: `Integritetspolicy – ${APP_NAME}` },
      { name: "description", content: `Hur ${APP_NAME} behandlar personuppgifter.` },
    ],
  }),
});

const sections: LegalSection[] = [
  {
    id: "personuppgiftsansvarig",
    heading: "Personuppgiftsansvarig",
    body: (
      <>
        <p>
          Personuppgiftsansvarig är Isaly AB, organisationsnummer 559472-5763, Grimmeredsvägen 45,
          426&nbsp;69 Västra Frölunda.
        </p>
        <p>
          Kontakt i integritetsfrågor: <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> eller per post
          till Isaly AB, Grimmeredsvägen 45, 426&nbsp;69 Västra Frölunda.
        </p>
      </>
    ),
  },
  {
    id: "uppgifter",
    heading: "Vilka uppgifter vi behandlar",
    body: (
      <ul>
        <li>
          Konto: e-postadress, visningsnamn och inloggningsuppgifter (lösenord lagras hashat av
          Supabase Auth).
        </li>
        <li>
          Studieplaner: ämne, provdatum, beskrivning, dagliga uppgifter och det material du anger
          för att skapa planen.
        </li>
        <li>
          Övningar och glosor: de du skapar eller får skapade, dina svar och dina resultat. Text
          eller PDF som du laddar upp för att skapa glosor behandlas för att läsa ut texten.
        </li>
        <li>
          Delningslänk: om du delar en studieplan kan alla som har länken se den utan att logga in.
        </li>
        <li>
          Feedback du skickar via feedbackknappen, tillsammans med din e-postadress och eventuell
          skärmbild.
        </li>
      </ul>
    ),
  },
  {
    id: "andamal",
    heading: "Ändamål och rättslig grund",
    body: (
      <>
        <p>
          Vi behandlar uppgifterna för att tillhandahålla tjänsten (studieplaner, övningar, glosor
          och uppläst ljud) och för att felsöka och förbättra den.{" "}
          <Todo>RÄTTSLIG GRUND PER ÄNDAMÅL – BEKRÄFTA</Todo>
        </p>
        <p>
          Tjänsten riktar sig till personer som pluggar. Åldersgränsen är 13 år, vilket är den
          svenska gränsen för barns eget samtycke till informationssamhällets tjänster. Vi skapar
          inte konton åt personer under 13 år, och om vi får veta att ett konto tillhör någon under
          13 år raderar vi det. Kontakta oss om du tror att ett barn under 13 år har skapat ett
          konto.
        </p>
      </>
    ),
  },
  {
    id: "underbitraden",
    heading: "Underbiträden",
    body: (
      <ul>
        <li>
          Supabase (databas, inloggning och lagring av skärmbilder i feedback), EU-region
          (Stockholm).
        </li>
        <li>
          Vercel (drift och leverans av webbappen). Serverfunktionerna körs i Stockholm.{" "}
          <Todo>BEKRÄFTA ÖVERFÖRINGSMEKANISM FÖR VERCEL</Todo>
        </li>
        <li>
          Anthropic (Claude): det du anger och ditt underlag skickas dit för att skapa studieplaner,
          övningar, rättning och glosor.
        </li>
        <li>OpenAI: text skickas dit för att skapa uppläst ljud (lektionsuppläsning).</li>
        <li>Isaly Feedback Hub (mottagning av feedback du skickar).</li>
        <li>
          Överföring utanför EU/EES:{" "}
          <Todo>
            BESKRIV VAR AI-LEVERANTÖRERNA BEHANDLAR UPPGIFTERNA OCH VILKET SKYDD SOM GÄLLER
          </Todo>
        </li>
      </ul>
    ),
  },
  {
    id: "lagring",
    heading: "Hur länge uppgifterna sparas",
    body: (
      <p>
        Uppgifterna sparas så länge du har ett konto. Skärmdumpar som bifogas feedback tas bort
        automatiskt efter 12 månader.{" "}
        <Todo>
          JURIST: BEKRÄFTA 12 MÅNADER; RETENTIONSTIDER FÖR STUDIEPLANER, SVAR, LOGGAR OCH FEEDBACK
        </Todo>
      </p>
    ),
  },
  {
    id: "rattigheter",
    heading: "Dina rättigheter",
    body: (
      <p>
        Du har rätt till tillgång, rättelse och, i den mån lagen tillåter, radering, begränsning och
        dataportabilitet. Kontakta <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>. Vi svarar utan
        onödigt dröjsmål och senast inom en månad.
      </p>
    ),
  },
  {
    id: "radering",
    heading: "Radera ditt konto",
    body: (
      <p>
        Ditt Isaly-konto delas med andra Isaly-appar, så en app får inte radera själva kontot. Appen
        har ännu ingen funktion där du själv raderar dina uppgifter; kontakta{" "}
        <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> så hjälper vi dig.{" "}
        <Todo>BESKRIV HUR RADERING AV APPENS DATA OCH DET GEMENSAMMA ISALY-KONTOT HANTERAS</Todo>
      </p>
    ),
  },
  {
    id: "andringar",
    heading: "Ändringar",
    body: (
      <p>
        Vi kan uppdatera den här policyn. Datumet högst upp visar när den senast ändrades. Se även
        våra <Link to="/terms">användarvillkor</Link>.
      </p>
    ),
  },
];

function PrivacyPage() {
  return (
    <LegalPage
      title="Integritetspolicy"
      lastUpdated="2026-11-03"
      intro={<p>Den här policyn beskriver hur {APP_NAME} behandlar personuppgifter.</p>}
      sections={sections}
    />
  );
}
