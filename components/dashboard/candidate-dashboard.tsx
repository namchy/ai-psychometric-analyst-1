import Link from "next/link";
import { logout } from "@/app/actions/auth";

type DashboardIconName =
  | "psychology"
  | "work_history"
  | "insights"
  | "groups"
  | "grid_view"
  | "schedule"
  | "task_alt"
  | "trending_up"
  | "biotech"
  | "account_balance"
  | "hub"
  | "search"
  | "notifications"
  | "settings"
  | "arrow_right";

export type CandidateAssessmentCard = {
  title: string;
  description: string;
  status: "Dostupan" | "Nije započet";
  duration: string;
  secondaryMeta: string;
  icon: DashboardIconName;
  secondaryIcon: DashboardIconName;
  iconBgClassName: string;
  iconColorClassName: string;
  href?: string;
  ctaLabel: string;
  disabled?: boolean;
};

type CandidateDashboardViewProps = {
  assessments: CandidateAssessmentCard[];
  userEmail: string;
  userName?: string | null;
  showHrLink: boolean;
  hasLinkedParticipant: boolean;
};

const KPI_CARDS: Array<{
  label: string;
  value: string;
  accent?: boolean;
  status?: boolean;
}> = [
  { label: "Završeni testovi", value: "12" },
  { label: "Ukupno vrijeme", value: "4.5h" },
  { label: "Prosječni rezultat", value: "88%", accent: true },
  { label: "Status profila", value: "Aktivan", status: true },
];

const PRIMARY_NAV_ITEMS = ["Assessments", "Candidates", "Reports", "Library"] as const;

function DashboardIcon({ name, className }: { name: DashboardIconName; className?: string }) {
  const props = {
    "aria-hidden": true,
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "psychology":
      return (
        <svg {...props}>
          <path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.2 3.8 2.5 5.1 1.1 1.1 1.5 2 1.5 3.9" />
          <path d="M12 3a6 6 0 0 1 6 6c0 2.5-1.2 3.8-2.5 5.1-1.1 1.1-1.5 2-1.5 3.9" />
          <path d="M9 21h6" />
          <path d="M10 17h4" />
          <path d="M10.5 8.5c.6-1 2.2-1.2 3-.3.8.8.6 2.3-.3 3l-1.2 1" />
        </svg>
      );
    case "work_history":
      return (
        <svg {...props}>
          <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
          <rect x="4" y="7" width="16" height="12" rx="2" />
          <path d="M4 12h16" />
          <path d="M10 15h4" />
        </svg>
      );
    case "insights":
      return (
        <svg {...props}>
          <path d="M5 19V10" />
          <path d="M12 19V5" />
          <path d="M19 19v-8" />
        </svg>
      );
    case "groups":
      return (
        <svg {...props}>
          <path d="M16.5 20a3.5 3.5 0 0 0-7 0" />
          <circle cx="13" cy="11" r="3" />
          <path d="M3.5 20a3 3 0 0 1 4-2.82" />
          <circle cx="7" cy="12" r="2.5" />
        </svg>
      );
    case "grid_view":
      return (
        <svg {...props}>
          <rect x="4" y="4" width="6" height="6" rx="1.2" />
          <rect x="14" y="4" width="6" height="6" rx="1.2" />
          <rect x="4" y="14" width="6" height="6" rx="1.2" />
          <rect x="14" y="14" width="6" height="6" rx="1.2" />
        </svg>
      );
    case "schedule":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
      );
    case "task_alt":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12 2.2 2.2 4.8-4.8" />
        </svg>
      );
    case "trending_up":
      return (
        <svg {...props}>
          <path d="M5 16 10 11l3 3 6-6" />
          <path d="M14 8h5v5" />
        </svg>
      );
    case "biotech":
      return (
        <svg {...props}>
          <path d="M9 3v6" />
          <path d="M15 3v6" />
          <path d="M8 9h8" />
          <path d="M8 9v4a4 4 0 0 0 8 0V9" />
          <path d="M10 17h4" />
          <path d="M9 21h6" />
        </svg>
      );
    case "account_balance":
      return (
        <svg {...props}>
          <path d="M4 9h16" />
          <path d="M6 9v7" />
          <path d="M12 9v7" />
          <path d="M18 9v7" />
          <path d="M3 20h18" />
          <path d="m12 4 8 4H4l8-4Z" />
        </svg>
      );
    case "hub":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="6" cy="7" r="2" />
          <circle cx="18" cy="7" r="2" />
          <circle cx="18" cy="17" r="2" />
          <path d="M8 8.2 10.4 10" />
          <path d="M14 10 16 8.2" />
          <path d="M14 14l2 1.8" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case "notifications":
      return (
        <svg {...props}>
          <path d="M6 15h12" />
          <path d="M8 15V11a4 4 0 1 1 8 0v4" />
          <path d="M10 18a2 2 0 0 0 4 0" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="2.8" />
          <path d="M12 4.5v1.3" />
          <path d="M12 18.2v1.3" />
          <path d="m6.7 6.7.9.9" />
          <path d="m16.4 16.4.9.9" />
          <path d="M4.5 12h1.3" />
          <path d="M18.2 12h1.3" />
          <path d="m6.7 17.3.9-.9" />
          <path d="m16.4 7.6.9-.9" />
        </svg>
      );
    case "arrow_right":
      return (
        <svg {...props}>
          <path d="M5 12h14" />
          <path d="m13 7 5 5-5 5" />
        </svg>
      );
    default:
      return null;
  }
}

function TopNav({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName?: string | null;
}) {
  const initialsSource = userName?.trim() || userEmail;
  const initials = initialsSource
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <div className="top-nav__left">
          <Link className="top-nav__brand" href="/app">
            Luminescent
          </Link>
          <nav className="top-nav__primary" aria-label="Primary">
            {PRIMARY_NAV_ITEMS.map((item) => (
              <span
                key={item}
                className={`top-nav__link ${item === "Assessments" ? "top-nav__link--active" : ""}`}
              >
                {item}
              </span>
            ))}
          </nav>
        </div>

        <div className="top-nav__right">
          <label className="top-nav__search" aria-label="Search assessments">
            <DashboardIcon className="top-nav__search-icon" name="search" />
            <input placeholder="Search assessments..." type="search" />
          </label>

          <button aria-label="Notifications" className="top-nav__icon-button" type="button">
            <DashboardIcon className="top-nav__icon" name="notifications" />
          </button>
          <button aria-label="Settings" className="top-nav__icon-button" type="button">
            <DashboardIcon className="top-nav__icon" name="settings" />
          </button>

          <div aria-hidden className="top-nav__avatar">
            <span>{initials || "LU"}</span>
          </div>

          <form action={logout}>
            <button className="top-nav__signout" type="submit">
              Odjava
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function DashboardHeader() {
  return (
    <section className="candidate-dashboard__header">
      <h1>Dostupni testovi</h1>
      <p>
        Pregledajte i započnite svoje procjene talenata. Svaki test je dizajniran da pruži dubok
        uvid u vaše profesionalne vještine.
      </p>
    </section>
  );
}

function AssessmentCard({ assessment }: { assessment: CandidateAssessmentCard }) {
  const badgeClassName =
    assessment.status === "Dostupan"
      ? "assessment-card__status assessment-card__status--available"
      : "assessment-card__status assessment-card__status--neutral";

  return (
    <article className="assessment-card glass-card">
      <div className="assessment-card__top-row">
        <div className={`assessment-card__icon-tile ${assessment.iconBgClassName}`}>
          <DashboardIcon className={`assessment-card__main-icon ${assessment.iconColorClassName}`} name={assessment.icon} />
        </div>
        <span className={badgeClassName}>{assessment.status}</span>
      </div>

      <h2>{assessment.title}</h2>
      <p className="assessment-card__description">{assessment.description}</p>

      <div className="assessment-card__meta-row">
        <span className="assessment-card__meta-item">
          <DashboardIcon className="assessment-card__meta-icon" name="schedule" />
          {assessment.duration}
        </span>
        <span className="assessment-card__meta-item">
          <DashboardIcon className="assessment-card__meta-icon" name={assessment.secondaryIcon} />
          {assessment.secondaryMeta}
        </span>
      </div>

      {assessment.disabled || !assessment.href ? (
        <button className="btn-teal-gradient assessment-card__cta assessment-card__cta--disabled" disabled type="button">
          <span>{assessment.ctaLabel}</span>
          <DashboardIcon className="assessment-card__cta-icon" name="arrow_right" />
        </button>
      ) : (
        <Link className="btn-teal-gradient assessment-card__cta" href={assessment.href}>
          <span>{assessment.ctaLabel}</span>
          <DashboardIcon className="assessment-card__cta-icon" name="arrow_right" />
        </Link>
      )}
    </article>
  );
}

function DashboardStatCard({
  label,
  value,
  accent,
  status,
}: {
  label: string;
  value: string;
  accent?: boolean;
  status?: boolean;
}) {
  return (
    <article className="dashboard-stat-card glass-card">
      <p className="dashboard-stat-card__label">{label}</p>
      {status ? (
        <p className="dashboard-stat-card__status">
          <span className="dashboard-stat-card__status-dot" />
          {value}
        </p>
      ) : (
        <p className={`dashboard-stat-card__value ${accent ? "dashboard-stat-card__value--accent" : ""}`}>
          {value}
        </p>
      )}
    </article>
  );
}

function DashboardFooter({
  showHrLink,
}: {
  showHrLink: boolean;
}) {
  return (
    <footer className="candidate-dashboard__footer">
      <div className="candidate-dashboard__footer-inner">
        <div className="candidate-dashboard__footer-left">
          <p>© 2024 Luminescent. All rights reserved.</p>
          {showHrLink ? (
            <Link className="candidate-dashboard__footer-hr" href="/hr">
              HR Workspace
            </Link>
          ) : null}
        </div>
        <nav aria-label="Footer" className="candidate-dashboard__footer-links">
          <a href="/">Privacy Policy</a>
          <a href="/">Terms of Service</a>
          <a href="/">Security</a>
        </nav>
      </div>
    </footer>
  );
}

export function CandidateDashboardView({
  assessments,
  userEmail,
  userName,
  showHrLink,
  hasLinkedParticipant,
}: CandidateDashboardViewProps) {
  return (
    <>
      <TopNav userEmail={userEmail} userName={userName} />
      <main className="candidate-dashboard-page candidate-dashboard-page--shell">
        <DashboardHeader />

        {hasLinkedParticipant ? (
          <>
            <section className="candidate-dashboard__grid" aria-label="Assessments">
              {assessments.map((assessment) => (
                <AssessmentCard assessment={assessment} key={assessment.title} />
              ))}
            </section>

            <section className="candidate-dashboard__kpis" aria-label="Dashboard overview">
              {KPI_CARDS.map((card) => (
                <DashboardStatCard
                  accent={card.accent}
                  key={card.label}
                  label={card.label}
                  status={card.status}
                  value={card.value}
                />
              ))}
            </section>
          </>
        ) : (
          <section className="candidate-dashboard__empty glass-card">
            <h2>Kandidat profil još nije povezan</h2>
            <p>Ovaj nalog trenutno nema povezan kandidat profil, pa procjene još nisu dostupne.</p>
            <p>Dok se povezivanje ne završi, ovdje se neće prikazati dostupni testovi ni izvještaji.</p>
          </section>
        )}
      </main>
      <DashboardFooter showHrLink={showHrLink} />
    </>
  );
}
