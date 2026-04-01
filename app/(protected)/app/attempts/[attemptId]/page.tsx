import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  getCandidateAttemptForUser,
  getCandidateAttemptQuestionCount,
} from "@/lib/candidate/attempts";

type CandidateAttemptIntroPageProps = {
  params: {
    attemptId: string;
  };
};

function isIpcAssessmentSlug(slug: string | null | undefined): boolean {
  return slug === "ipip-ipc-v1";
}

function formatEstimatedDuration(
  durationMinutes: number | null,
  questionCount: number,
): string | null {
  if (durationMinutes && durationMinutes > 0) {
    return `${durationMinutes} minuta`;
  }

  if (questionCount <= 0) {
    return null;
  }

  const minimum = Math.max(5, Math.floor(questionCount / 7));
  const maximum = Math.max(minimum + 1, Math.ceil(questionCount / 5));
  return `oko ${minimum} do ${maximum} minuta`;
}

function getAssessmentTitle(name: string | null | undefined, slug: string | null | undefined): string {
  const normalizedName = name?.trim();

  if (normalizedName && /ličnost/i.test(normalizedName)) {
    return normalizedName;
  }

  if (isIpcAssessmentSlug(slug)) {
    return "Procjena interpersonalnog stila";
  }

  if (slug?.startsWith("ipip")) {
    return "Procjena ličnosti";
  }

  return normalizedName ?? slug ?? "Procjena";
}

function getAssessmentDescription(description: string | null | undefined): string {
  if (description?.trim()) {
    return description;
  }

  return "Ova procjena pruža strukturiran uvid u tvoje obrasce ponašanja, načine reagovanja i lične tendencije kroz niz kratkih tvrdnji.";
}

function getResponseScaleLabel(testSlug: string | null | undefined): string {
  if (testSlug?.startsWith("ipip")) {
    return "Odgovori na skali od 1 do 5";
  }

  return "Kratke tvrdnje sa ponuđenom skalom odgovora";
}

function getIntroAction(
  attemptId: string,
  lifecycle: "in_progress" | "not_started" | "completed" | "abandoned",
) {
  switch (lifecycle) {
    case "in_progress":
      return {
        href: `/app/attempts/${attemptId}/run`,
        label: "Nastavi procjenu",
      };
    case "completed":
      return {
        href: `/app/attempts/${attemptId}/report`,
        label: "Pogledaj izvještaj",
      };
    case "abandoned":
      return {
        href: "/app",
        label: "Nazad na početak",
      };
    default:
      return {
        href: `/app/attempts/${attemptId}/run`,
        label: "Započni procjenu",
      };
  }
}

export const dynamic = "force-dynamic";

export default async function CandidateAttemptIntroPage({
  params,
}: CandidateAttemptIntroPageProps) {
  const user = await requireAuthenticatedUser();
  const attempt = await getCandidateAttemptForUser(user.id, params.attemptId);

  if (!attempt) {
    notFound();
  }

  const questionCount = await getCandidateAttemptQuestionCount(attempt.test_id);
  const estimatedDuration = formatEstimatedDuration(
    attempt.tests?.duration_minutes ?? null,
    questionCount,
  );
  const action = getIntroAction(attempt.id, attempt.lifecycle);
  const assessmentTitle = getAssessmentTitle(attempt.tests?.name, attempt.tests?.slug);
  const assessmentDescription = getAssessmentDescription(attempt.tests?.description);
  const responseScaleLabel = getResponseScaleLabel(attempt.tests?.slug);
  const methodologyDescription = isIpcAssessmentSlug(attempt.tests?.slug)
    ? "Procjena se oslanja na IPC interpersonalni okvir i fokusira se na obrasce interpersonalnog stila, saradnje i načina na koji osoba zauzima prostor u odnosima."
    : "Procjena se oslanja na široko korišten okvir ličnosti poznat kao Big Five model, koji se često koristi za razumijevanje stabilnih obrazaca ličnosti u profesionalnom i razvojnom kontekstu.";

  return (
    <main className="candidate-intro stack-md mx-auto w-full max-w-5xl px-4">
      <section className="candidate-intro__hero card stack-sm">
        <div className="stack-sm">
          <div className="stack-xs">
            <p className="assessment-eyebrow">
              {attempt.lifecycle === "completed"
                ? "Procjena završena"
                : attempt.lifecycle === "in_progress"
                  ? "Procjena je u toku"
                  : "Spremno za početak"}
            </p>
            <h1>{assessmentTitle}</h1>
            <p className="candidate-intro__lead">{assessmentDescription}</p>
          </div>

          <dl className="candidate-intro__meta" aria-label="Osnovne informacije o procjeni">
            <div className="candidate-intro__meta-item">
              <dt>Broj pitanja</dt>
              <dd>{questionCount > 0 ? `${questionCount} pitanja` : "Biće prikazano pri početku"}</dd>
            </div>
            {estimatedDuration ? (
              <div className="candidate-intro__meta-item">
                <dt>Procijenjeno trajanje</dt>
                <dd>{estimatedDuration}</dd>
              </div>
            ) : null}
            <div className="candidate-intro__meta-item">
              <dt>Format odgovora</dt>
              <dd>{responseScaleLabel}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="candidate-intro__section card stack-sm">
        <div className="candidate-intro__section-heading stack-xs">
          <p className="assessment-eyebrow">Šta možeš očekivati</p>
          <h2>Kako izgleda procjena</h2>
        </div>
        <p>
          Tokom procjene označavaš u kojoj mjeri te pojedine tvrdnje opisuju. Nema tačnih ni
          netačnih odgovora. Najkorisnije je da odgovaraš iskreno i spontano, prema tome kako inače
          funkcionišeš.
        </p>
      </section>

      <section className="candidate-intro__section card stack-sm">
        <div className="candidate-intro__section-heading stack-xs">
          <p className="assessment-eyebrow">Kako će rezultati biti prikazani</p>
          <h2>Šta dobijaš na kraju</h2>
        </div>
        <p>
          Na kraju ćeš dobiti izvještaj sa glavnim uvidima o tvojim ličnim obrascima i načinu
          funkcionisanja. Rezultati služe kao strukturiran uvid, a ne kao konačna ocjena tvoje
          vrijednosti ili sposobnosti.
        </p>
      </section>

      <section className="candidate-intro__section card stack-sm">
        <div className="candidate-intro__section-heading stack-xs">
          <p className="assessment-eyebrow">Na čemu se procjena zasniva</p>
          <h2>Metodološka osnova</h2>
        </div>
        <p>{methodologyDescription}</p>
      </section>

      <section className="candidate-intro__section card stack-sm">
        <div className="candidate-intro__section-heading stack-xs">
          <p className="assessment-eyebrow">Prije nego počneš</p>
          <h2>Kratke smjernice</h2>
        </div>
        <ul className="candidate-intro__checklist">
          <li>Odvoji nekoliko minuta bez prekida.</li>
          <li>Odgovaraj iskreno.</li>
          <li>Nemoj previše analizirati svaku tvrdnju.</li>
          <li>Ako je omogućeno, procjenu možeš nastaviti kasnije.</li>
        </ul>
      </section>

      <section className="candidate-intro__section card stack-sm">
        <div className="candidate-intro__section-heading stack-xs">
          <p className="assessment-eyebrow">Povjerljivost i upotreba rezultata</p>
          <h2>Kako se odgovori koriste</h2>
        </div>
        <p>
          Tvoji odgovori i rezultati koriste se u okviru procesa procjene za koji je ova aplikacija
          namijenjena. Izvještaj je oblikovan tako da pruži strukturiran i smislen pregled rezultata
          relevantnim učesnicima procesa.
        </p>
      </section>

      <section className="candidate-intro__cta card stack-sm">
        {attempt.lifecycle === "completed" ? (
          <p>Tvoja procjena je završena i izvještaj je spreman za pregled.</p>
        ) : attempt.lifecycle === "abandoned" ? (
          <p>Ova procjena trenutno nije otvorena za nastavak. Vrati se na početni ekran za naredni korak.</p>
        ) : attempt.lifecycle === "in_progress" ? (
          <p>Sačuvali smo tvoj dosadašnji napredak, pa možeš nastaviti tamo gdje si stao.</p>
        ) : (
          <p>Kada budeš spreman, možeš započeti procjenu i proći kroz pitanja svojim tempom.</p>
        )}
        <div>
          <Link className="candidate-home__link" href={action.href}>
            {action.label}
          </Link>
        </div>
        <p className="candidate-intro__cta-note">
          Po završetku procjene dobit ćeš personalizovani izvještaj sa glavnim uvidima.
        </p>
      </section>
    </main>
  );
}
