import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getAppContextForUserId } from "@/lib/auth/app-context";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCandidateAttemptLookupForUser } from "@/lib/candidate/attempts";

export const dynamic = "force-dynamic";

function formatActivityTimestamp(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString();
}

export default async function CandidateAppEntryPage() {
  const user = await requireAuthenticatedUser();
  const [context, candidateLookup] = await Promise.all([
    getAppContextForUserId(user.id),
    getCandidateAttemptLookupForUser(user.id),
  ]);
  const linkedParticipant = context.linkedParticipant;
  const primaryAttempt = candidateLookup.primaryAttempt;

  let primaryAction:
    | {
        href: string;
        label: string;
        supportingText: string;
      }
    | null = null;

  if (primaryAttempt?.lifecycle === "in_progress") {
    primaryAction = {
      href: `/app/attempts/${primaryAttempt.id}/run`,
      label: "Nastavi test",
      supportingText: "Sačuvali smo tvoj dosadašnji napredak i možeš nastaviti tamo gdje si stao.",
    };
  } else if (primaryAttempt?.lifecycle === "not_started") {
    primaryAction = {
      href: `/app/attempts/${primaryAttempt.id}`,
      label: "Započni test",
      supportingText:
        "Tvoja procjena je spremna. Prvo možeš pogledati kratke uvodne informacije prije početka.",
    };
  } else if (primaryAttempt?.lifecycle === "completed") {
    primaryAction = {
      href: `/app/attempts/${primaryAttempt.id}/report`,
      label: "Pogledaj izvještaj",
      supportingText: "Procjena je završena i izvještaj je spreman za pregled.",
    };
  }

  return (
    <main className="stack-md">
      <section className="card stack-sm">
        <div className="stack-xs">
          <h1>Candidate Home</h1>
          <p>Ovdje možeš započeti, nastaviti ili pregledati svoju procjenu i izvještaj.</p>
          {linkedParticipant ? (
            <>
              <p>
                Prijavljen si kao <strong>{linkedParticipant.full_name}</strong> ({linkedParticipant.email})
              </p>
              {primaryAttempt && primaryAction ? (
                <>
                  <p>{primaryAction.supportingText}</p>
                  <p>
                    <strong>{primaryAttempt.tests?.name ?? primaryAttempt.tests?.slug ?? "Procjena"}</strong>
                    {primaryAttempt.lifecycle === "completed"
                      ? ` · završeno ${formatActivityTimestamp(primaryAttempt.completed_at) ?? ""}`
                      : ` · otvoreno od ${formatActivityTimestamp(primaryAttempt.started_at) ?? ""}`}
                  </p>
                  <p>
                    <Link href={primaryAction.href}>{primaryAction.label}</Link>
                  </p>
                </>
              ) : (
                <>
                  <p>Trenutno nema aktivne procjene ili dostupnog izvještaja za ovaj nalog.</p>
                  <p>Kada nova procjena bude dodijeljena, ovdje ćeš dobiti jednu jasnu sljedeću akciju.</p>
                </>
              )}
            </>
          ) : (
            <>
              <p>Ovaj nalog još nema povezan kandidat profil.</p>
              <p>Dok se povezivanje ne završi, candidate procjene i izvještaji neće biti dostupni u ovom prostoru.</p>
            </>
          )}
          <p>Prijavljen si kao {user.email ?? user.id}</p>
        </div>

        {context.recommendedAppArea === "hr" ? (
          <p>
            Ovaj nalog ima i HR pristup. <Link href="/hr">Otvori HR workspace</Link>.
          </p>
        ) : null}

        <form action={logout}>
          <button type="submit">Odjavi se</button>
        </form>
      </section>
    </main>
  );
}
