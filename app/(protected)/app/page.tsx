import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getAppContextForUserId } from "@/lib/auth/app-context";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  type CandidateAttemptSummary,
  getCandidateAttemptLookupForUser,
} from "@/lib/candidate/attempts";

export const dynamic = "force-dynamic";

const DESKTOP_NOT_STARTED_SUPPORTING_TEXT =
  'Test je spreman. Klikom na „Započni test” prvo ćeš otvoriti kratke uvodne informacije i objašnjenje testa.';

const DESKTOP_AVAILABLE_TESTS = [
  {
    title: "IPIP-50 Hrvatski v1",
    description:
      "Kratki Big Five test ličnosti za osnovni uvid u način rada, komunikacije i ponašanja.",
    badges: ["Dostupan", "Nije započet"],
    helperText:
      'Klikom na „Započni test” prvo ćeš otvoriti kratke uvodne informacije i objašnjenje testa.',
    ctaLabel: "Započni test",
  },
];

const DESKTOP_UNAVAILABLE_TESTS = [
  {
    title: "O*NET Interest Profiler",
    description:
      "Test profesionalnih interesovanja koji pokazuje koliko se tvoji interesi podudaraju sa različitim vrstama poslova i radnih uloga.",
  },
  {
    title: "IPIP-NEO",
    description:
      "Detaljan Big Five test koji daje dublji uvid u 5 glavnih osobina ličnosti i njihove specifične fasete.",
  },
  {
    title: "DISC",
    description:
      "Test stilova ponašanja i komunikacije koji pomaže u razumijevanju načina saradnje, uticaja i rada u timu.",
  },
  {
    title: "O*NET Work Importance Locator",
    description:
      "Test radnih vrijednosti koji pokazuje šta ti je najvažnije u poslu, poput priznanja, autonomije, odnosa i uslova rada.",
  },
  {
    title: "OEPS Enneagram",
    description:
      "Test zasnovan na Eneagram modelu koji daje dodatni uvid u lične motivatore, obrasce ponašanja i razvojne potencijale.",
  },
];

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

  const desktopPrimaryAction =
    primaryAction ?? (primaryAttempt ? getAttemptAction(primaryAttempt) : null);
  const desktopUserName = linkedParticipant?.full_name?.trim();
  const desktopUserEmail = linkedParticipant?.email ?? user.email ?? user.id;

  return (
    <main className="app-shell candidate-home stack-lg">
      <section className="candidate-home__hero card stack-md">
        <div className="stack-sm">
          <div className="stack-xs">
            <p className="eyebrow candidate-home-copy-mobile">Candidate Home</p>
            <p className="eyebrow candidate-home-copy-desktop">KONTROLNA PLOČA</p>
            <h1 className="candidate-home-copy-mobile">Dobro došao u prostor za procjene</h1>
            <h1 className="candidate-home-copy-desktop">Dostupni testovi</h1>
            <p className="page-lead candidate-home__intro candidate-home-copy-mobile">
              Ovdje možeš mirno pregledati dostupne procjene i odabrati onu koju želiš započeti ili
              nastaviti.
            </p>
            <p className="page-lead candidate-home__intro candidate-home-copy-desktop">
              Ovdje su prikazani testovi koji su ti trenutno dostupni. Možeš ih započeti odmah ili
              nastaviti tamo gdje si ranije stao.
            </p>
          </div>

          {linkedParticipant ? (
            <div className="candidate-home__identity surface-subtle stack-xs candidate-home-copy-mobile">
              <p>
                Prijavljen si kao <strong>{linkedParticipant.full_name}</strong>
              </p>
              <p>{linkedParticipant.email}</p>
            </div>
          ) : (
            <div className="candidate-home__empty-state candidate-home__empty-state--muted status-panel status-panel--warning stack-xs">
              <h2>Kandidat profil još nije povezan</h2>
              <p>Ovaj nalog trenutno nema povezan kandidat profil, pa procjene još nisu dostupne.</p>
              <p>Dok se povezivanje ne završi, ovdje se neće prikazati dostupni testovi ni izvještaji.</p>
            </div>
          )}
        </div>
      </section>

      {linkedParticipant ? (
        <>
          <section className="candidate-home__panel card stack-md candidate-home-copy-mobile">
            {openAttempts.length > 1 ? (
              <div className="stack-md">
                <div className="stack-xs">
                  <h2 className="candidate-home-copy-mobile">Dostupne procjene</h2>
                  <p className="candidate-home-copy-mobile">
                    Imaš više otvorenih procjena. Odaberi onu koju želiš sada započeti ili nastaviti.
                  </p>
                </div>

                <div className="candidate-home__attempt-list" role="list">
                  {openAttempts.map((attempt) => {
                    const action = getAttemptAction(attempt);

                    return (
                      <article key={attempt.id} className="candidate-home__attempt-card stack-sm" role="listitem">
                        <div className="candidate-home__attempt-header">
                          <div className="stack-xs">
                            <h3>{getAttemptDisplayName(attempt)}</h3>
                            <p>{getAttemptStatusLabel(attempt)}</p>
                          </div>
                          <Link className="candidate-home__link button-primary" href={action.href}>
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
              <div className="candidate-home__single-action stack-md">
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
                  <Link className="candidate-home__link button-primary" href={primaryAction.href}>
                    {primaryAction.label}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="candidate-home__empty-state empty-state stack-xs">
                <h2 className="candidate-home-copy-mobile">Trenutno nema dostupnih procjena</h2>
                <p className="candidate-home-copy-mobile">
                  Za ovaj nalog trenutno nema aktivne procjene koju treba započeti ili nastaviti.
                </p>
                <p className="candidate-home-copy-mobile">
                  Kada nova procjena bude dostupna, ovdje ćeš dobiti jasan sljedeći korak.
                </p>
              </div>
            )}
          </section>

          <section className="candidate-home__desktop-section candidate-home-copy-desktop">
            <div className="candidate-home__section-heading">
              <h2>Dostupni testovi</h2>
              <p>Ovi testovi su ti trenutno dostupni i možeš ih započeti odmah.</p>
            </div>

            <div className="candidate-home__desktop-card-list" role="list">
              {DESKTOP_AVAILABLE_TESTS.map((test) => (
                <article key={test.title} className="candidate-home__desktop-card" role="listitem">
                  <div className="candidate-home__desktop-card-header">
                    <h3>{test.title}</h3>
                    <p>{test.description}</p>
                  </div>
                  <div className="candidate-home__desktop-badge-row" aria-label="Status testa">
                    {test.badges.map((badge) => (
                      <span
                        key={badge}
                        className={`candidate-home__desktop-badge ${
                          badge === "Dostupan"
                            ? "candidate-home__desktop-badge--available"
                            : "candidate-home__desktop-badge--neutral"
                        }`}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <div className="candidate-home__desktop-card-footer">
                    <p>{test.helperText}</p>
                    {desktopPrimaryAction ? (
                      <Link className="candidate-home__desktop-cta" href={desktopPrimaryAction.href}>
                        {test.ctaLabel}
                      </Link>
                    ) : (
                      <button className="candidate-home__desktop-cta" type="button" disabled>
                        {test.ctaLabel}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="candidate-home__desktop-section candidate-home-copy-desktop">
            <div className="candidate-home__section-heading">
              <h2>Ostali testovi na platformi</h2>
              <p>Ovi testovi trenutno nisu uključeni u tvoj paket.</p>
            </div>

            <div className="candidate-home__desktop-card-list" role="list">
              {DESKTOP_UNAVAILABLE_TESTS.map((test) => (
                <article key={test.title} className="candidate-home__desktop-card" role="listitem">
                  <div className="candidate-home__desktop-card-header">
                    <h3>{test.title}</h3>
                    <p>{test.description}</p>
                  </div>
                  <div className="candidate-home__desktop-badge-row" aria-label="Status testa">
                    <span className="candidate-home__desktop-badge candidate-home__desktop-badge--unavailable">
                      Nije dostupno
                    </span>
                  </div>
                  <div className="candidate-home__desktop-card-footer">
                    <button className="candidate-home__desktop-cta candidate-home__desktop-cta--disabled" type="button" disabled>
                      Trenutno nedostupno
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <section className="candidate-home__footer card stack-sm candidate-home-copy-mobile">
        {context.recommendedAppArea === "hr" ? (
          <p className="candidate-home__footer-link">
            Ovaj nalog ima i HR pristup. <Link href="/hr">Otvori HR workspace</Link>.
          </p>
        ) : null}
        <p className="text-secondary">Prijavljen si kao {user.email ?? user.id}</p>
        <form action={logout}>
          <button className="button-secondary" type="submit">
            Odjavi se
          </button>
        </form>
      </section>

      {linkedParticipant ? (
        <section className="candidate-home__desktop-userbar candidate-home-copy-desktop">
          <div className="candidate-home__desktop-userbar-copy">
            <p>Prijavljeni korisnik</p>
            {desktopUserName ? <p>{desktopUserName}</p> : null}
            <p>{desktopUserEmail}</p>
          </div>
          <form action={logout}>
            <button className="candidate-home__desktop-logout" type="submit">
              Odjavi se
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
