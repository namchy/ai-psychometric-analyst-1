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

const PRIMARY_NAV_ITEMS = ["Testovi", "Reports"] as const;

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

function getIconTileClassName(iconBgClassName: string): string {
  switch (iconBgClassName) {
    case "assessment-card__icon-tile--primary":
      return "bg-primary/10";
    case "assessment-card__icon-tile--tertiary":
      return "bg-tertiary/10";
    case "assessment-card__icon-tile--cyan":
      return "bg-primary-container/10";
    case "assessment-card__icon-tile--secondary":
      return "bg-secondary/10";
    case "assessment-card__icon-tile--coral":
      return "bg-tertiary-fixed/10";
    default:
      return "bg-white/5";
  }
}

function getIconColorClassName(iconColorClassName: string): string {
  switch (iconColorClassName) {
    case "assessment-card__icon-color--teal":
      return "text-primary-fixed";
    case "assessment-card__icon-color--coral-muted":
      return "text-tertiary-fixed-dim";
    case "assessment-card__icon-color--cyan":
      return "text-secondary-fixed";
    case "assessment-card__icon-color--aqua":
      return "text-secondary-fixed-dim";
    case "assessment-card__icon-color--coral":
      return "text-tertiary-fixed";
    default:
      return "text-white";
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
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#00101a]/80 shadow-[0_18px_44px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-full items-center justify-between px-4 sm:px-6 lg:px-12">
        <div className="flex min-w-0 items-center gap-6 lg:gap-10">
          <Link
            href="/app"
            className="shrink-0 font-headline text-lg font-bold tracking-[-0.04em] text-white transition-opacity hover:opacity-90 sm:text-xl"
          >
            Deep Profile
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-2 lg:flex">
            {PRIMARY_NAV_ITEMS.map((item) => (
              <span
                key={item}
                className={
                  item === "Testovi"
                    ? "rounded-full border border-teal-400/20 bg-teal-500/10 px-3 py-1.5 text-sm font-semibold text-teal-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "rounded-full px-3 py-1.5 text-sm font-medium text-slate-400 transition-colors duration-200 hover:bg-white/[0.03] hover:text-slate-100"
                }
              >
                {item}
              </span>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
          <button
            aria-label="Settings"
            className="min-h-0 rounded-xl border border-transparent bg-transparent p-2 text-slate-400 shadow-none transition-all duration-200 hover:border-white/10 hover:bg-white/[0.04] hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            type="button"
          >
            <DashboardIcon className="h-5 w-5" name="settings" />
          </button>

          <div className="ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <span>{initials || "LU"}</span>
          </div>

          <form action={logout} className="hidden md:block">
            <button
              className="min-h-0 rounded-full border border-outline-variant/20 bg-transparent px-4 py-2 text-[11px] font-label font-semibold uppercase tracking-[0.18em] text-slate-300 shadow-none transition-all duration-200 hover:border-primary/40 hover:bg-white/[0.04] hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              type="submit"
            >
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
    <section className="w-full rounded-[1.75rem] border border-white/10 bg-[#03141c]/70 p-6 shadow-[0_18px_48px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-7">
      <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-300/80">
        Assessment workspace
      </p>
      <h1 className="mt-3 font-headline text-3xl font-extrabold tracking-[-0.045em] text-white sm:text-4xl">
        Dostupni testovi
      </h1>
      <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-slate-400 sm:text-[15px]">
        Pokrenite aktivne procjene i odvojeno pregledajte testove koji još nisu dostupni.
      </p>
    </section>
  );
}

function WelcomeOverviewCard({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName?: string | null;
}) {
  const firstName = userName?.trim()?.split(/\s+/)[0];

  return (
    <section className="glass-card rounded-[1.75rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,32,40,0.92),rgba(3,18,26,0.9))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-7">
      <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-300/75">
        Overview
      </p>
      <h2 className="mt-3 font-headline text-[1.75rem] font-bold tracking-[-0.04em] text-white">
        {firstName ? `Dobrodošao nazad, ${firstName}` : "Dobrodošao nazad"}
      </h2>
      <p className="mt-3 font-body text-sm leading-7 text-slate-300/90">
        Tvoj kandidat profil je spreman za rad. Ovdje imaš brz pregled statusa naloga i aktivnih
        procjena.
      </p>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <p className="font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Account
        </p>
        <p className="mt-2 truncate text-sm font-medium text-white">{userEmail}</p>
        {userName ? <p className="mt-1 text-sm text-slate-400">{userName}</p> : null}
      </div>
    </section>
  );
}

function QuickActionCard() {
  return (
    <section className="glass-card rounded-[1.5rem] border border-white/10 bg-[#041720]/80 p-6 shadow-[0_20px_44px_rgba(0,0,0,0.2)]">
      <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-300/80">
        Quick action
      </p>
      <h2 className="mt-3 font-headline text-xl font-bold tracking-[-0.03em] text-white">
        Generate Insights Report
      </h2>
      <p className="mt-2 font-body text-sm leading-6 text-slate-400">
        CTA ostaje pripremljen za izvještaje, bez nove backend logike u ovoj iteraciji.
      </p>
      <button
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-300/75"
        disabled
        type="button"
      >
        <span>Insights uskoro</span>
        <DashboardIcon className="h-4 w-4" name="arrow_right" />
      </button>
    </section>
  );
}

function AssessmentSection({
  title,
  description,
  assessments,
  muted = false,
  hideSectionHeader = false,
}: {
  title: string;
  description: string;
  assessments: CandidateAssessmentCard[];
  muted?: boolean;
  hideSectionHeader?: boolean;
}) {
  if (assessments.length === 0) {
    return null;
  }

  return (
    <section className={muted ? "mt-8" : "mt-6"}>
      {!hideSectionHeader ? (
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="font-headline text-2xl font-bold tracking-[-0.03em] text-white">{title}</h2>
          <p className="font-body text-sm leading-6 text-slate-400">{description}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:gap-5">
        {assessments.map((assessment) => (
          <AssessmentCard assessment={assessment} key={assessment.title} muted={muted} />
        ))}
      </div>
    </section>
  );
}

function AssessmentCard({
  assessment,
  muted = false,
}: {
  assessment: CandidateAssessmentCard;
  muted?: boolean;
}) {
  const iconTileClassName = getIconTileClassName(assessment.iconBgClassName);
  const iconColorClassName = getIconColorClassName(assessment.iconColorClassName);
  const isAvailable = !assessment.disabled && Boolean(assessment.href);
  const badgeClassName =
    isAvailable && !muted
      ? "border border-teal-400/20 bg-teal-500/10 text-teal-300"
      : "border border-white/8 bg-white/[0.04] text-slate-400";
  const cardClassName = muted
    ? "glass-card border-white/8 bg-[#04131b]/75 hover:border-white/10 hover:shadow-[0_16px_34px_rgba(0,0,0,0.16)]"
    : "glass-card border-white/12 bg-[#051822]/88 hover:border-teal-500/20 hover:shadow-[0_22px_44px_rgba(0,0,0,0.22)]";
  const descriptionClassName = muted ? "text-slate-500" : "text-slate-400";
  const metaClassName = muted ? "text-slate-400/75" : "text-slate-300/85";

  return (
    <article
      className={`group flex h-full flex-col rounded-[1.5rem] border p-4 transition-all duration-300 hover:-translate-y-0.5 sm:p-5 ${cardClassName}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div
          className={`rounded-2xl p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${iconTileClassName} ${muted ? "opacity-75" : ""}`}
        >
          <DashboardIcon className={`h-6 w-6 ${iconColorClassName} sm:h-7 sm:w-7`} name={assessment.icon} />
        </div>
        <span
          className={`inline-flex min-h-8 items-center rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${badgeClassName}`}
        >
          {assessment.status}
        </span>
      </div>

      <div className="flex flex-1 flex-col">
        <h3 className={`font-headline text-[1.35rem] font-bold tracking-[-0.03em] ${muted ? "text-slate-200" : "text-white"}`}>
          {assessment.title}
        </h3>
        <p className={`mt-2 min-h-0 font-body text-sm leading-6 ${descriptionClassName}`}>
          {assessment.description}
        </p>

        <div className="mb-4 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-3">
          <span className={`inline-flex items-center gap-2 text-xs font-medium ${metaClassName}`}>
            <DashboardIcon className="h-4 w-4 text-slate-500/90" name="schedule" />
            {assessment.duration}
          </span>
          <span className={`inline-flex items-center gap-2 text-xs font-medium ${metaClassName}`}>
            <DashboardIcon className="h-4 w-4 text-slate-500/90" name={assessment.secondaryIcon} />
            {assessment.secondaryMeta}
          </span>
        </div>
      </div>

      {!isAvailable ? (
        <button
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-2.5 text-sm font-bold uppercase tracking-[0.16em] text-slate-400/80 opacity-90"
          disabled
          type="button"
        >
          <span>{assessment.ctaLabel}</span>
          <DashboardIcon className="h-4 w-4" name="arrow_right" />
        </button>
      ) : (
        <Link
          className="btn-teal-gradient mt-auto flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_14px_30px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(0,0,0,0.22)] focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:ring-offset-0"
          href={assessment.href!}
        >
          <span>{assessment.ctaLabel}</span>
          <DashboardIcon className="h-4 w-4" name="arrow_right" />
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
    <article className="glass-card rounded-2xl p-5 sm:p-6">
      <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      {status ? (
        <p className="mt-3 inline-flex items-center gap-2.5 text-xl font-bold text-white sm:text-2xl">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.14)]" />
          {value}
        </p>
      ) : (
        <p
          className={`mt-3 text-[2rem] font-extrabold tracking-[-0.04em] sm:text-[2.15rem] ${accent ? "text-teal-300" : "text-white"}`}
        >
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
    <footer className="border-t border-white/8">
      <div className="flex w-full flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-12">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
          <p className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-500">
            © 2024 Luminescent. All rights reserved.
          </p>
          {showHrLink ? (
            <Link
              className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-500 transition-colors duration-200 hover:text-teal-300"
              href="/hr"
            >
              HR Workspace
            </Link>
          ) : null}
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a
            className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-500 transition-colors duration-200 hover:text-teal-300"
            href="/"
          >
            Privacy Policy
          </a>
          <a
            className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-500 transition-colors duration-200 hover:text-teal-300"
            href="/"
          >
            Terms of Service
          </a>
          <a
            className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-500 transition-colors duration-200 hover:text-teal-300"
            href="/"
          >
            Security
          </a>
        </nav>
      </div>
    </footer>
  );
}

function EmptyState() {
  return (
    <section className="glass-card rounded-xl p-8 md:p-10">
      <h2 className="font-headline text-2xl font-bold tracking-tight text-white">
        Kandidat profil još nije povezan
      </h2>
      <p className="mt-4 max-w-2xl font-body text-sm leading-7 text-slate-400">
        Ovaj nalog trenutno nema povezan kandidat profil, pa procjene još nisu dostupne.
      </p>
      <p className="mt-2 max-w-2xl font-body text-sm leading-7 text-slate-400">
        Dok se povezivanje ne završi, ovdje se neće prikazati dostupni testovi ni izvještaji.
      </p>
    </section>
  );
}

export function CandidateDashboardView({
  assessments,
  userEmail,
  userName,
  showHrLink,
  hasLinkedParticipant,
}: CandidateDashboardViewProps) {
  const availableAssessments = assessments.filter(
    (assessment) => !assessment.disabled && Boolean(assessment.href),
  );
  const unavailableAssessments = assessments.filter(
    (assessment) => assessment.disabled || !assessment.href,
  );

  return (
    <div className="candidate-dashboard-page--shell bg-mesh min-h-screen font-body text-white">
      <TopNav userEmail={userEmail} userName={userName} />

      <main className="w-full max-w-full px-6 lg:px-12 pb-14 pt-24">
        {hasLinkedParticipant ? (
          <div className="grid grid-cols-1 gap-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
            <aside className="w-full space-y-5 lg:top-24">
              <WelcomeOverviewCard userEmail={userEmail} userName={userName} />

              <section aria-label="Dashboard overview" className="grid grid-cols-2 gap-4">
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

              <QuickActionCard />
            </aside>

            <section aria-label="Assessments" className="min-w-0 w-full">
              <div className="space-y-6">
                <DashboardHeader />
                {availableAssessments.length > 0 ? (
    <AssessmentSection
      title="Dostupni testovi"
      description="Aktivne procjene koje možeš odmah otvoriti i završiti."
      assessments={availableAssessments}
      hideSectionHeader
    />
                ) : null}
              </div>

              <AssessmentSection
                title="Ostali testovi"
                description="Ove procjene još nisu otključane za tvoj profil."
                assessments={unavailableAssessments}
                muted
              />
            </section>
          </div>
        ) : (
          <EmptyState />
        )}
      </main>

      <DashboardFooter showHrLink={showHrLink} />
    </div>
  );
}
