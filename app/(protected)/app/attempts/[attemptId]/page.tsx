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

function formatEstimatedDuration(
  durationMinutes: number | null,
  questionCount: number,
): string | null {
  if (durationMinutes && durationMinutes > 0) {
    return `${durationMinutes} min`;
  }

  if (questionCount <= 0) {
    return null;
  }

  return `oko ${Math.max(5, Math.ceil(questionCount / 2))} min`;
}

function getMethodologyNote(testSlug: string | null | undefined): string | null {
  if (!testSlug) {
    return null;
  }

  if (testSlug.startsWith("ipip")) {
    return "Procjena koristi kratke tvrdnje na koje odgovaraš stepenom slaganja kako bi se dobio pregled stabilnih obrazaca ličnosti.";
  }

  return null;
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
  const methodologyNote = getMethodologyNote(attempt.tests?.slug);

  return (
    <main className="stack-md">
      <section className="card stack-sm">
        <div className="stack-xs">
          <p className="assessment-eyebrow">
            {attempt.lifecycle === "completed" ? "Procjena završena" : "Procjena je spremna"}
          </p>
          <h1>{attempt.tests?.name ?? attempt.tests?.slug ?? "Procjena"}</h1>
          <p>
            {attempt.tests?.description ??
              "Ova procjena daje strukturisan uvid u obrasce ličnosti i način na koji najčešće pristupaš radu, saradnji i svakodnevnim situacijama."}
          </p>
        </div>

        <div className="stack-xs">
          <p>
            <strong>Broj pitanja:</strong> {questionCount > 0 ? questionCount : "Biće prikazano pri početku"}
          </p>
          {estimatedDuration ? (
            <p>
              <strong>Procijenjeno trajanje:</strong> {estimatedDuration}
            </p>
          ) : null}
          <p>Nema tačnih i netačnih odgovora. Najkorisnije je da odgovaraš iskreno i bez previše premišljanja.</p>
          <p>Rezultati služe kao uvid u obrasce ponašanja i ličnosti, a ne kao apsolutna presuda o tebi.</p>
          {methodologyNote ? <p>{methodologyNote}</p> : null}
        </div>

        <div className="stack-xs">
          {attempt.lifecycle === "completed" ? (
            <p>Tvoja procjena je već završena i izvještaj je dostupan za pregled.</p>
          ) : attempt.lifecycle === "abandoned" ? (
            <p>Ova procjena trenutno nije otvorena za nastavak. Ako očekuješ novi poziv, vrati se na početni ekran.</p>
          ) : attempt.lifecycle === "in_progress" ? (
            <p>Sačuvali smo tvoj dosadašnji napredak, pa možeš nastaviti tamo gdje si stao.</p>
          ) : (
            <p>Kada budeš spreman, možeš započeti procjenu i proći kroz pitanja svojim tempom.</p>
          )}
          <p>
            <Link href={action.href}>{action.label}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
