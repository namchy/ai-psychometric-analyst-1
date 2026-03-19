import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getAppContextForUserId } from "@/lib/auth/app-context";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  type CandidateAttemptSummary,
  getCandidateAttemptLookupForUser,
} from "@/lib/candidate/attempts";

export const dynamic = "force-dynamic";

function formatActivityTimestamp(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString();
}

function isOpenCandidateAttempt(attempt: CandidateAttemptSummary): boolean {
  return attempt.lifecycle === "in_progress" || attempt.lifecycle === "not_started";
}

function getAttemptDisplayName(attempt: CandidateAttemptSummary): string {
  return attempt.tests?.name ?? attempt.tests?.slug ?? "Procjena";
}

function getAttemptStatusLabel(attempt: CandidateAttemptSummary): string {
  return attempt.lifecycle === "in_progress" ? "U toku" : "Nije započet";
}

function getAttemptAction(attempt: CandidateAttemptSummary): {
  href: string;
  label: string;
  supportingText: string;
} {
  if (attempt.lifecycle === "in_progress") {
    return {
      href: `/app/attempts/${attempt.id}/run`,
      label: "Nastavi test",
      supportingText: "Sačuvali smo tvoj dosadašnji napredak i možeš nastaviti tamo gdje si stao.",
    };
  }

  if (attempt.lifecycle === "completed") {
    return {
      href: `/app/attempts/${attempt.id}/report`,
      label: "Pogledaj izvještaj",
      supportingText: "Procjena je završena i izvještaj je spreman za pregled.",
    };
  }

  return {
    href: `/app/attempts/${attempt.id}`,
    label: "Započni test",
    supportingText:
      "Procjena je spremna. Prvo možeš pogledati kratke uvodne informacije prije početka.",
  };
}

export default async function CandidateAppEntryPage() {
  const user = await requireAuthenticatedUser();
  const [context, candidateLookup] = await Promise.all([
    getAppContextForUserId(user.id),
    getCandidateAttemptLookupForUser(user.id),
  ]);
  const linkedParticipant = context.linkedParticipant;
  const primaryAttempt = candidateLookup.primaryAttempt;
  const openAttempts = candidateLookup.attempts.filter(isOpenCandidateAttempt);

  let primaryAction:
    | {
        href: string;
        label: string;
        supportingText: string;
      }
    | null = null;

  if (openAttempts.length <= 1 && primaryAttempt) {
    primaryAction = getAttemptAction(primaryAttempt);
  }

  return (
    <main className="candidate-home stack-md">
      <section className="candidate-home__hero card stack-sm">
        <div className="stack-sm">
          <div className="stack-xs">
            <p className="assessment-eyebrow">Candidate Home</p>
            <h1>Dobro došao u prostor za procjene</h1>
            <p className="candidate-home__intro">
              Ovdje možeš mirno pregledati dostupne procjene i odabrati onu koju želiš započeti ili
              nastaviti.
            </p>
          </div>

          {linkedParticipant ? (
            <div className="candidate-home__identity">
              <p>
                Prijavljen si kao <strong>{linkedParticipant.full_name}</strong>
              </p>
              <p>{linkedParticipant.email}</p>
            </div>
          ) : (
            <div className="candidate-home__empty-state candidate-home__empty-state--muted stack-xs">
              <h2>Kandidat profil još nije povezan</h2>
              <p>Ovaj nalog trenutno nema povezan kandidat profil, pa procjene još nisu dostupne.</p>
              <p>Dok se povezivanje ne završi, ovdje se neće prikazati dostupni testovi ni izvještaji.</p>
            </div>
          )}
        </div>
      </section>

      {linkedParticipant ? (
        <section className="candidate-home__panel card stack-sm">
          {openAttempts.length > 1 ? (
            <div className="stack-sm">
              <div className="stack-xs">
                <h2>Dostupne procjene</h2>
                <p>
                  Imaš više otvorenih procjena. Odaberi onu koju želiš sada započeti ili nastaviti.
                </p>
              </div>

              <div className="candidate-home__attempt-list" role="list">
                {openAttempts.map((attempt) => {
                  const action = getAttemptAction(attempt);

                  return (
                    <article key={attempt.id} className="candidate-home__attempt-card stack-xs" role="listitem">
                      <div className="candidate-home__attempt-header">
                        <div>
                          <h3>{getAttemptDisplayName(attempt)}</h3>
                          <p>{getAttemptStatusLabel(attempt)}</p>
                        </div>
                        <Link className="candidate-home__link" href={action.href}>
                          {action.label}
                        </Link>
                      </div>
                      <p>{action.supportingText}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : primaryAttempt && primaryAction ? (
            <div className="candidate-home__single-action stack-sm">
              <div className="stack-xs">
                <h2>{getAttemptDisplayName(primaryAttempt)}</h2>
                <p>{primaryAction.supportingText}</p>
              </div>

              <div className="candidate-home__single-meta">
                <p className="candidate-home__status-pill">
                  {primaryAttempt.lifecycle === "completed"
                    ? "Izvještaj dostupan"
                    : getAttemptStatusLabel(primaryAttempt)}
                </p>
                <p>
                  {primaryAttempt.lifecycle === "completed"
                    ? `Završeno ${formatActivityTimestamp(primaryAttempt.completed_at) ?? "nedavno"}`
                    : `Otvoreno ${formatActivityTimestamp(primaryAttempt.started_at) ?? "nedavno"}`}
                </p>
              </div>

              <div>
                <Link className="candidate-home__link" href={primaryAction.href}>
                  {primaryAction.label}
                </Link>
              </div>
            </div>
          ) : (
            <div className="candidate-home__empty-state stack-xs">
              <h2>Trenutno nema dostupnih procjena</h2>
              <p>Za ovaj nalog trenutno nema aktivne procjene koju treba započeti ili nastaviti.</p>
              <p>Kada nova procjena bude dostupna, ovdje ćeš dobiti jasan sljedeći korak.</p>
            </div>
          )}
        </section>
      ) : null}

      <section className="candidate-home__footer card stack-sm">
        {context.recommendedAppArea === "hr" ? (
          <p>
            Ovaj nalog ima i HR pristup. <Link href="/hr">Otvori HR workspace</Link>.
          </p>
        ) : null}
        <p>Prijavljen si kao {user.email ?? user.id}</p>
        <form action={logout}>
          <button type="submit">Odjavi se</button>
        </form>
      </section>
    </main>
  );
}
