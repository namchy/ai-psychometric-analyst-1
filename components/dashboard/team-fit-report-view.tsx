"use client";

import { useState, type ReactNode } from "react";
import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DashboardStatusBadge,
} from "@/components/dashboard/primitives";
import { SingleOpenPanelGroup } from "@/components/dashboard/single-open-panel-group";
import type { TeamFitReportDisplayRecord } from "@/lib/b2b/team-fit-report-display";
import type {
  TeamFitRelationshipPattern,
} from "@/lib/b2b/team-fit-report-contract";

type TeamFitReportViewProps = {
  record: TeamFitReportDisplayRecord;
};

type TeamFitReportTabId =
  | "pregled"
  | "fit-signali"
  | "rizici-i-validacija"
  | "intervju"
  | "onboarding"
  | "napomene";

type CompactHighlightTone = "neutral" | "info" | "warning";

type CompactHighlight = {
  label: string;
  title: string;
  summary?: string | null;
  helper?: string | null;
  tone?: CompactHighlightTone;
};

const TEAM_FIT_TABS: Array<{ id: TeamFitReportTabId; label: string }> = [
  { id: "pregled", label: "Pregled" },
  { id: "fit-signali", label: "Fit signali" },
  { id: "rizici-i-validacija", label: "Rizici i validacija" },
  { id: "intervju", label: "Intervju" },
  { id: "onboarding", label: "Onboarding" },
  { id: "napomene", label: "Napomene" },
];

const TEAM_FIT_REPORT_MONTH_NAMES = [
  "januar",
  "februar",
  "mart",
  "april",
  "maj",
  "jun",
  "jul",
  "august",
  "septembar",
  "oktobar",
  "novembar",
  "decembar",
] as const;

const TEAM_FIT_REPORT_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Sarajevo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function normalizeNumericPart(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, "");

  return digits.length > 0 ? digits : null;
}

function formatTimestamp(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = TEAM_FIT_REPORT_DATE_TIME_FORMAT.formatToParts(date);
  const day = normalizeNumericPart(parts.find((part) => part.type === "day")?.value);
  const month = normalizeNumericPart(parts.find((part) => part.type === "month")?.value);
  const year = normalizeNumericPart(parts.find((part) => part.type === "year")?.value);
  const hour = normalizeNumericPart(parts.find((part) => part.type === "hour")?.value);
  const minute = normalizeNumericPart(parts.find((part) => part.type === "minute")?.value);

  if (!day || !month || !year || !hour || !minute) {
    return date.toISOString();
  }

  const monthIndex = Number(month) - 1;
  const monthName = TEAM_FIT_REPORT_MONTH_NAMES[monthIndex];

  if (!monthName) {
    return date.toISOString();
  }

  return `${Number(day)}. ${monthName} ${year}. u ${hour}:${minute}`;
}

function mapRelationshipPatternLabel(value: TeamFitRelationshipPattern): string {
  switch (value) {
    case "alignment_signal":
      return "Signal poravnanja";
    case "complementarity_signal":
      return "Signal dopune";
    case "mixed_signal":
      return "Miješani signal";
    case "needs_validation":
    default:
      return "Potrebna dodatna provjera";
  }
}

function buildHeroHeadline(headline: string): string {
  const normalized = headline.trim();

  return normalized;
}

function compact<T>(items: Array<T | null | undefined>): T[] {
  return items.filter((item): item is T => item != null);
}

function firstOrNull<T>(items: readonly T[] | null | undefined): T | null {
  return items && items.length > 0 ? items[0] : null;
}

function MetaCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-[#073b4c]">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[15px] leading-7 text-slate-700">
          <span
            aria-hidden="true"
            className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#118ab2]"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function InfoPanel({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: ReactNode;
  tone?: "neutral" | "info" | "warning";
}) {
  const toneClassName =
    tone === "info"
      ? "border-[#118ab2]/15 bg-[#118ab2]/[0.06]"
      : tone === "warning"
        ? "border-[#ffd166]/45 bg-[#fff5d6]"
        : "border-slate-200/80 bg-white/80";

  return (
    <div className={`rounded-[1rem] border px-4 py-3 ${toneClassName}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-[15px] leading-7 text-slate-700">{children}</div>
    </div>
  );
}

function CompactHighlightCard({
  label,
  title,
  summary,
  helper,
  tone = "neutral",
}: CompactHighlight) {
  const toneClassName =
    tone === "info"
      ? "border-[#118ab2]/18 bg-[#118ab2]/[0.06]"
      : tone === "warning"
        ? "border-[#ef476f]/18 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,71,111,0.05))]"
        : "border-slate-200/80 bg-white/80";

  return (
    <div className={`rounded-[1.15rem] border px-4 py-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)] ${toneClassName}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <h3 className="mt-2 text-base font-bold text-[#073b4c]">
        {title}
      </h3>
      {summary ? <p className="mt-2 text-[15px] leading-7 text-slate-600">{summary}</p> : null}
      {helper ? <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p> : null}
    </div>
  );
}

function DetailLabel({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: ReactNode;
  tone?: "neutral" | "info" | "warning";
}) {
  const toneClassName =
    tone === "info"
      ? "border-[#118ab2]/15 bg-[#118ab2]/[0.06]"
      : tone === "warning"
        ? "border-[#ef476f]/15 bg-[#ef476f]/[0.05]"
        : "border-slate-200/80 bg-white/80";

  return (
    <div className={`rounded-[1rem] border px-4 py-3 ${toneClassName}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-[15px] leading-7 text-slate-700">{children}</div>
    </div>
  );
}

function TabButton({
  id,
  label,
  active,
  onSelect,
}: {
  id: TeamFitReportTabId;
  label: string;
  active: boolean;
  onSelect: (id: TeamFitReportTabId) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`team-fit-tab-${id}`}
      aria-selected={active}
      aria-controls={`team-fit-panel-${id}`}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect(id)}
      className={[
        "inline-flex min-h-0 items-center justify-center whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#118ab2]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        active
          ? "border-[#073b4c] bg-white text-[#073b4c]"
          : "border-transparent bg-white text-slate-500 hover:border-[#118ab2]/40 hover:text-[#073b4c]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function TabPanel({
  id,
  activeTab,
  children,
}: {
  id: TeamFitReportTabId;
  activeTab: TeamFitReportTabId;
  children: ReactNode;
}) {
  return (
    <section
      id={`team-fit-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`team-fit-tab-${id}`}
      hidden={activeTab !== id}
      className={activeTab === id ? "block" : "hidden"}
    >
      {children}
    </section>
  );
}

function ExpandableInsightCard({
  category = "Uvid",
  title,
  summary,
  children,
  defaultOpen = false,
  tone = "neutral",
  actionLabel = "Prikaži detalje",
}: {
  category?: string;
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: "neutral" | "info" | "warning";
  actionLabel?: string;
}) {
  const toneClassName =
    tone === "info"
      ? "border-[#118ab2]/15 bg-[#118ab2]/[0.04]"
      : tone === "warning"
        ? "border-[#ef476f]/15 bg-[#ef476f]/[0.04]"
        : "border-slate-200/80 bg-white/80";

  return (
    <details
      data-single-open-panel
      open={defaultOpen}
      className={`group rounded-[0.9rem] border shadow-[0_8px_20px_rgba(15,23,42,0.035)] transition hover:border-[#118ab2]/25 hover:shadow-[0_14px_28px_rgba(15,23,42,0.055)] ${toneClassName}`}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-[0.9rem] px-5 py-4 outline-none transition hover:bg-white/75 focus-visible:ring-2 focus-visible:ring-[#118ab2]/25 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#118ab2]">
            {category}
          </p>
          <p className="text-base font-bold leading-6 text-[#073b4c]">
            {title}
          </p>
          {summary ? <p className="max-w-3xl text-[15px] leading-7 text-slate-600">{summary}</p> : null}
        </div>
        <div className="mt-0.5 flex shrink-0 items-start text-right">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 shadow-sm">
            <span className="group-open:hidden">{actionLabel}</span>
            <span className="hidden group-open:inline">Sakrij detalje</span>
            <span
              aria-hidden="true"
              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center text-slate-500 transition group-open:rotate-180"
            >
              ▾
            </span>
          </span>
        </div>
      </summary>
      <div className="border-t border-slate-200/80 bg-white/65 px-5 pb-5 pt-4 text-[15px] leading-7 text-slate-700">
        {children}
      </div>
    </details>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  eyebrowClassName,
  titleClassName,
  descriptionClassName,
  className,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  eyebrowClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <DashboardInfoCardShell className={`rounded-[1.15rem] border-slate-200/80 p-5 sm:p-6 ${className ?? ""}`}>
      <DashboardSectionHeader
        eyebrow={eyebrow}
        eyebrowClassName={eyebrowClassName}
        title={title}
        description={description}
        className="gap-2"
        titleClassName={titleClassName}
        descriptionClassName={descriptionClassName}
      />
      <div className="mt-5">{children}</div>
    </DashboardInfoCardShell>
  );
}

function NonReadyState({ record }: TeamFitReportViewProps) {
  const createdAtLabel = formatTimestamp(record.createdAt) ?? "Nije dostupno";
  const queuedAtLabel = formatTimestamp(record.queuedAt);
  const startedAtLabel = formatTimestamp(record.startedAt);
  const failedAtLabel = formatTimestamp(record.failedAt);

  const statusLabel =
    record.status === "queued"
      ? "Pripremljeno"
      : record.status === "processing"
        ? "U obradi"
        : "Trenutno nedostupno";

  return (
    <div className="space-y-6 pb-12">
      <DashboardInfoCardShell className="rounded-[1.6rem] border-slate-200/80 p-6 sm:p-7">
        <div className="space-y-4">
          <DashboardSectionHeader
            eyebrow="Team Fit izvještaj"
            eyebrowClassName="text-[#073b4c]"
            title="HR pregled statusa Team Fit izvještaja"
            description={record.safeStatusMessage}
            className="gap-2"
            titleClassName="max-w-3xl text-[1.85rem] font-extrabold text-[#073b4c] sm:text-[2.2rem]"
            descriptionClassName="max-w-3xl text-base leading-7 text-slate-600"
          />

          <div className="flex flex-wrap gap-2.5">
            <DashboardStatusBadge
              tone="neutral"
              emphasized
              className={
                record.status === "failed"
                  ? "border-rose-300/90 bg-rose-100 text-rose-900 shadow-none"
                  : undefined
              }
            >
              {statusLabel}
            </DashboardStatusBadge>
            <DashboardStatusBadge className="border-[#118ab2]/20 bg-[#118ab2]/10 text-[#073b4c]">
              {record.reportVersion.toUpperCase()}
            </DashboardStatusBadge>
          </div>

          <div className="grid gap-3 border-t border-slate-200/80 pt-5 md:grid-cols-2 xl:grid-cols-4">
            <MetaCard
              label="Kandidat"
              value={record.candidate.displayName ?? "Kandidat"}
              helper={record.candidate.participantId}
            />
            <MetaCard label="Tim" value={record.team.name ?? "Tim"} />
            <MetaCard label="Kreirano" value={createdAtLabel} />
            <MetaCard label="Verzija izvještaja" value={record.reportVersion} />
          </div>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Status obrade"
          eyebrowClassName="text-[#073b4c]"
          title="Šta je trenutno dostupno"
          description="Ovaj prikaz je read-only i ne nudi obradu, retry ili druge akcije u ovom slice-u."
          className="gap-2"
          titleClassName="text-[1.4rem] font-bold text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {queuedAtLabel ? <MetaCard label="Pripremljeno" value={queuedAtLabel} /> : null}
          {startedAtLabel ? <MetaCard label="Obrada počela" value={startedAtLabel} /> : null}
          {failedAtLabel ? <MetaCard label="Označeno kao neuspješno" value={failedAtLabel} /> : null}
        </div>
      </DashboardInfoCardShell>
    </div>
  );
}

function buildKeyHighlights(snapshot: NonNullable<TeamFitReportDisplayRecord["reportSnapshot"]>) {
  const teamPattern = firstOrNull(snapshot.teamContextSummary.relevantTeamPatterns);
  const candidateSignal = firstOrNull(snapshot.candidateSignals);
  const complementaritySignal = firstOrNull(snapshot.complementaritySignals);
  const firstRisk = firstOrNull(snapshot.frictionRisks);
  const firstWatchout = firstOrNull(snapshot.watchouts);

  const signalHighlights = compact<CompactHighlight>([
    teamPattern
      ? {
          label: "Timski signal",
          title: teamPattern.title,
          summary: teamPattern.summary,
        }
      : null,
    candidateSignal
      ? {
          label: "Signal kandidata",
          title: candidateSignal.title,
          summary: candidateSignal.summary,
          helper: candidateSignal.relevanceToFit,
          tone: "info",
        }
      : null,
    complementaritySignal
      ? {
          label: "Dopuna timu",
          title: complementaritySignal.title,
          summary: complementaritySignal.summary,
          helper: complementaritySignal.practicalValue,
          tone: "info",
        }
      : null,
  ]).slice(0, 3);

  const validationHighlights = compact<CompactHighlight>([
    firstRisk
      ? {
          label: "Rizik / validacija",
          title: firstRisk.title,
          summary: firstRisk.summary,
          helper: firstRisk.mitigationFocus,
          tone: "warning",
        }
      : null,
    firstWatchout
      ? {
          label: "Dodatna provjera",
          title: firstWatchout,
          tone: "warning",
        }
      : null,
  ]).slice(0, 2);

  return { signalHighlights, validationHighlights };
}

function OverviewTab({
  snapshot,
  relationshipLabel,
  recommendedNextHrStep,
}: {
  snapshot: NonNullable<TeamFitReportDisplayRecord["reportSnapshot"]>;
  relationshipLabel: string;
  recommendedNextHrStep: string | null;
}) {
  const teamPattern = firstOrNull(snapshot.teamContextSummary.relevantTeamPatterns);
  const candidateSignal = firstOrNull(snapshot.candidateSignals);
  const complementaritySignal = firstOrNull(snapshot.complementaritySignals);
  const firstRisk = firstOrNull(snapshot.frictionRisks);
  const firstWatchout = firstOrNull(snapshot.watchouts);
  const interviewLead = firstOrNull(snapshot.interviewFocus.areas);

  return (
    <div className="space-y-4">
      <SectionCard
        eyebrow="Pregled"
        title="Kompaktni pregled za brzo čitanje"
        description="Najvažnije informacije su već ovdje, bez potrebe da otvaraš detaljne blokove."
        titleClassName="text-[1.45rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <InfoPanel label="Glavni zaključak">{snapshot.fitOverview.summary}</InfoPanel>
          <InfoPanel label="Relationship pattern">{relationshipLabel}</InfoPanel>
          <InfoPanel label="Preporučeni sljedeći HR korak">
            {recommendedNextHrStep ?? "Nije eksplicitno naveden u snapshotu."}
          </InfoPanel>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <InfoPanel label="Timski kontekst">
            {teamPattern?.title ? (
              <p className="font-semibold text-[#073b4c]">{teamPattern.title}</p>
            ) : null}
            {teamPattern?.summary ? <p className="mt-1">{teamPattern.summary}</p> : null}
          </InfoPanel>
          <InfoPanel label="Kandidatov signal">
            {candidateSignal?.title ? (
              <p className="font-semibold text-[#073b4c]">{candidateSignal.title}</p>
            ) : null}
            {candidateSignal?.summary ? <p className="mt-1">{candidateSignal.summary}</p> : null}
          </InfoPanel>
          <InfoPanel label="Dopuna timu">
            {complementaritySignal?.title ? (
              <p className="font-semibold text-[#073b4c]">{complementaritySignal.title}</p>
            ) : null}
            {complementaritySignal?.summary ? (
              <p className="mt-1">{complementaritySignal.summary}</p>
            ) : null}
          </InfoPanel>
          <InfoPanel label="Rizik / validacija">
            {firstRisk?.title ? <p className="font-semibold text-[#073b4c]">{firstRisk.title}</p> : null}
            {firstRisk?.summary ? <p className="mt-1">{firstRisk.summary}</p> : null}
            {firstWatchout ? <p className="mt-2 text-slate-600">{firstWatchout}</p> : null}
          </InfoPanel>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Kako čitati dalje"
        title="Brzi pregled čitanja"
        description="Tabovi ispod zadržavaju puni sadržaj, a ovaj blok služi kao orijentir za HR čitanje."
        eyebrowClassName="text-[#118ab2]"
        titleClassName="text-[1.3rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <InfoPanel label="1. Relacijski signal">
            Počni od glavnog zaključka i relationship pattern-a, pa ga čitaj kao hipotezu za provjeru.
          </InfoPanel>
          <InfoPanel label="2. Provjeri kroz razgovor" tone="warning">
            Interview blokovi nude konkretna pitanja i ono što HR treba slušati.
          </InfoPanel>
          <InfoPanel label="3. Prenesi u saradnju" tone="info">
            Onboarding i menadžerske smjernice koristi za rane dogovore o radu, komunikaciji i očekivanjima.
          </InfoPanel>
        </div>
      </SectionCard>

      {interviewLead ? (
        <SectionCard
          eyebrow="Prvi intervju signal"
          title="Kratka početna tema za razgovor"
          description="Ovo je najkraći ulaz u intervju blok i pomaže da se razgovor brzo usidri u konkretan radni kontekst."
          eyebrowClassName="text-[#073b4c]"
          titleClassName="text-[1.3rem] font-bold text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        >
          <InfoPanel label="Tema">{interviewLead.title}</InfoPanel>
          <InfoPanel label="Zašto je važno" tone="info">
            {interviewLead.rationale}
          </InfoPanel>
          <InfoPanel label="Pitanja">
            <BulletList items={interviewLead.prompts} />
          </InfoPanel>
        </SectionCard>
      ) : null}
    </div>
  );
}

function FitSignalsTab({
  snapshot,
}: {
  snapshot: NonNullable<TeamFitReportDisplayRecord["reportSnapshot"]>;
}) {
  return (
    <div className="space-y-4">
      <SectionCard
        eyebrow="Timski kontekst"
        title="Kako se čita postojeći timski okvir"
        description="Ova sekcija zadržava timske pattern-e i ne prikazuje pojedinačne članove tima."
        eyebrowClassName="text-[#073b4c]"
        titleClassName="text-[1.45rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
        className="border-[#073b4c]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.97))]"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {snapshot.teamContextSummary.relevantTeamPatterns.map((pattern) => (
            <div
              key={pattern.title}
              className="rounded-[1.15rem] border border-slate-200/80 bg-white/80 px-4 py-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Timski signal
              </p>
              <h3 className="mt-2 text-base font-bold text-[#073b4c]">
                {pattern.title}
              </h3>
              <p className="mt-2 text-[15px] leading-7 text-slate-600">{pattern.summary}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Signali kandidata"
        title="Šta relacijski signal znači za HR"
        description="Kandidat-side signali ostaju razvojni ulaz i služe za provjeru, ne za rangiranje osobe."
        eyebrowClassName="text-[#073b4c]"
        titleClassName="text-[1.45rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
        className="border-[#118ab2]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(240,249,252,0.95))]"
      >
        <SingleOpenPanelGroup className="space-y-3">
          {snapshot.candidateSignals.map((signal, index) => (
            <ExpandableInsightCard
              category="Signal kandidata"
              key={signal.title}
              title={signal.title}
              summary={signal.summary}
              defaultOpen={index === 0}
              tone="info"
            >
              <div className="grid gap-3">
                <DetailLabel label="Zašto je važno" tone="info">
                  {signal.summary}
                </DetailLabel>
                <DetailLabel label="Kako se može vidjeti u radu" tone="info">
                  {signal.relevanceToFit}
                </DetailLabel>
                <DetailLabel label="Dodatna interpretacija">
                  Ovaj signal je korisnije čitati kao hipotezu za provjeru nego kao zaključak.
                </DetailLabel>
              </div>
            </ExpandableInsightCard>
          ))}
        </SingleOpenPanelGroup>
      </SectionCard>

      <SectionCard
        eyebrow="Dopuna timu"
        title="Gdje kandidat može dopuniti tim"
        description="Ovdje ostaje zadržan sadržaj koji objašnjava kako kandidat može dodati novu vrijednost postojećem timu."
        eyebrowClassName="text-[#118ab2]"
        titleClassName="text-[1.45rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
        className="border-[#118ab2]/22 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(245,251,253,0.96))]"
      >
        <SingleOpenPanelGroup className="space-y-3">
          {snapshot.complementaritySignals.map((signal, index) => (
            <ExpandableInsightCard
              category="Dopuna timu"
              key={signal.title}
              title={signal.title}
              summary={signal.summary}
              defaultOpen={index === 0}
              tone="info"
            >
              <div className="grid gap-3">
                <DetailLabel label="Kako se može vidjeti u radu" tone="info">
                  {signal.practicalValue}
                </DetailLabel>
                <DetailLabel label="Dodatna interpretacija">
                  Ovaj signal služi za razgovor o tome gdje kandidat može dopuniti postojeći ritam tima.
                </DetailLabel>
              </div>
            </ExpandableInsightCard>
          ))}
        </SingleOpenPanelGroup>
      </SectionCard>
    </div>
  );
}

function RisksValidationTab({
  snapshot,
}: {
  snapshot: NonNullable<TeamFitReportDisplayRecord["reportSnapshot"]>;
}) {
  return (
    <div className="space-y-4">
      <SectionCard
        eyebrow="Rizici i trenje"
        title="Šta HR treba provjeriti prije odluke"
        description="Ovo su oprezne hipoteze o tome gdje bi mogla nastati trenja i kako ih vrijedi rano otvoriti."
        eyebrowClassName="text-[#ef476f]"
        titleClassName="text-[1.4rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <SingleOpenPanelGroup className="space-y-3">
          {snapshot.frictionRisks.map((risk, index) => (
            <ExpandableInsightCard
              category="Tačka opreza"
              key={risk.title}
              title={risk.title}
              summary={risk.summary}
              defaultOpen={index === 0}
              tone="warning"
            >
              <div className="grid gap-3">
                <DetailLabel label="Hipoteza za provjeru" tone="warning">
                  {risk.summary}
                </DetailLabel>
                <DetailLabel label="Zašto je važno" tone="warning">
                  {risk.whyItMayMatter}
                </DetailLabel>
                <DetailLabel label="Šta HR treba provjeriti" tone="info">
                  {risk.mitigationFocus}
                </DetailLabel>
              </div>
            </ExpandableInsightCard>
          ))}
        </SingleOpenPanelGroup>
      </SectionCard>

      <SectionCard
        eyebrow="Hipoteze za provjeru"
        title="Watchouts koji traže dodatnu pažnju"
        description="Ove tačke ne treba čitati kao završni sud, nego kao teme koje traže dodatnu provjeru."
        eyebrowClassName="text-[#ef476f]"
        titleClassName="text-[1.4rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <div className="space-y-3">
          {snapshot.watchouts.map((watchout) => (
            <InfoPanel key={watchout} label="Dodatna provjera" tone="warning">
              {watchout}
            </InfoPanel>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Ograničenja tumačenja"
        title="Kako oprezno čitati ovaj izvještaj"
        description="Guardrail napomene ostaju dio HR/internal čitanja i ne služe za automatsko decisioning tumačenje."
        eyebrowClassName="text-slate-500"
        titleClassName="text-[1.3rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <div className="space-y-3">
          {snapshot.interpretationLimits.map((limit) => (
            <InfoPanel key={limit} label="Limit tumačenja">
              {limit}
            </InfoPanel>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function InterviewTab({
  snapshot,
}: {
  snapshot: NonNullable<TeamFitReportDisplayRecord["reportSnapshot"]>;
}) {
  return (
    <SectionCard
      eyebrow="Interview fokus"
      title="Kako provjeriti signal kroz intervju"
      description="Svaki blok razdvaja pitanje, šta HR treba slušati i koji relacijski signal se provjerava."
      eyebrowClassName="text-[#073b4c]"
      titleClassName="text-[1.4rem] font-bold text-[#073b4c]"
      descriptionClassName="text-sm leading-6 text-slate-600"
    >
      <SingleOpenPanelGroup className="space-y-3">
        {snapshot.interviewFocus.areas.map((area, index) => (
          <ExpandableInsightCard
            category="Tema intervjua"
            key={area.title}
            title={area.title}
            summary={area.rationale}
            defaultOpen={index === 0}
            tone="info"
          >
            <div className="grid gap-3">
              <DetailLabel label="Zašto je važno" tone="warning">
                {area.rationale}
              </DetailLabel>
              <DetailLabel label="Pitanja" tone="info">
                <BulletList items={area.prompts} />
              </DetailLabel>
              <DetailLabel label="Dodatna interpretacija">
                Ovaj blok pomaže da se signal potvrdi kroz konkretan razgovor, a ne kroz utisak.
              </DetailLabel>
            </div>
          </ExpandableInsightCard>
        ))}
      </SingleOpenPanelGroup>
    </SectionCard>
  );
}

function OnboardingTab({
  snapshot,
}: {
  snapshot: NonNullable<TeamFitReportDisplayRecord["reportSnapshot"]>;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard
        eyebrow="Onboarding"
        title="Onboarding smjernice"
        description="Ove tačke pomažu da prvi radni koraci budu jasni, operativni i usklađeni sa timskim kontekstom."
        eyebrowClassName="text-[#118ab2]"
        titleClassName="text-[1.3rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <SingleOpenPanelGroup className="space-y-3">
          <ExpandableInsightCard
            category="Onboarding"
            title="Prvi prioriteti"
            summary="Šta treba zaključati odmah nakon ulaska u tim."
            defaultOpen
          >
            <div className="grid gap-3">
              <DetailLabel label="Prvi prioriteti">
                <BulletList items={snapshot.onboardingGuidance.priorities} />
              </DetailLabel>
            </div>
          </ExpandableInsightCard>
          <ExpandableInsightCard
            category="Onboarding"
            title="Šta HR treba provjeriti"
            summary="Gdje su potrebni dodatni dogovori ili podrška u startu."
            tone="info"
          >
            <div className="grid gap-3">
              <DetailLabel label="Šta HR treba provjeriti" tone="info">
                <BulletList items={snapshot.onboardingGuidance.supportNeeds} />
              </DetailLabel>
              <DetailLabel label="Dodatna interpretacija">
                Ovo je prostor za rani dogovor o tempu, podršci i očekivanjima.
              </DetailLabel>
            </div>
          </ExpandableInsightCard>
        </SingleOpenPanelGroup>
      </SectionCard>

      <SectionCard
        eyebrow="Menadžerske smjernice"
        title="Kako voditi saradnju nakon ulaska u tim"
        description="Smjernice služe kao operativni okvir za očekivanja, način rada i komunikaciju."
        eyebrowClassName="text-[#073b4c]"
        titleClassName="text-[1.3rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <SingleOpenPanelGroup className="space-y-3">
          <ExpandableInsightCard
            category="Menadžerske smjernice"
            title="Način rada"
            summary="Kako organizovati ritam, prioritete i odgovornosti."
            defaultOpen
          >
            <div className="grid gap-3">
              <DetailLabel label="Način rada">
                <BulletList items={snapshot.managerGuidance.workingStyleGuidance} />
              </DetailLabel>
            </div>
          </ExpandableInsightCard>
          <ExpandableInsightCard
            category="Menadžerske smjernice"
            title="Komunikacija"
            summary="Kako držati očekivanja i povratne informacije jasnima."
            tone="info"
          >
            <div className="grid gap-3">
              <DetailLabel label="Komunikacija" tone="info">
                <BulletList items={snapshot.managerGuidance.communicationGuidance} />
              </DetailLabel>
              <DetailLabel label="Dodatna interpretacija">
                Kratke, konkretne provjere smanjuju šansu za pogrešno razumijevanje.
              </DetailLabel>
            </div>
          </ExpandableInsightCard>
        </SingleOpenPanelGroup>
      </SectionCard>
    </div>
  );
}

function NotesTab({
  snapshot,
}: {
  snapshot: NonNullable<TeamFitReportDisplayRecord["reportSnapshot"]>;
}) {
  return (
    <div className="space-y-4">
      <SectionCard
        eyebrow="Napomene"
        title="Interpretation notes i sigurnosne granice"
        description="Ovaj tab je namjerno mirniji i skuplja sve što služi oprezu, kontekstu i fairness čitanju."
        eyebrowClassName="text-slate-500"
        titleClassName="text-[1.3rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <DetailLabel label="Watchouts" tone="warning">
            <BulletList items={snapshot.watchouts} />
          </DetailLabel>
          <DetailLabel label="Ograničenja tumačenja" tone="info">
            <BulletList items={snapshot.interpretationLimits} />
          </DetailLabel>
        </div>
      </SectionCard>
    </div>
  );
}

function ReadyState({
  record,
}: TeamFitReportViewProps) {
  const snapshot = record.reportSnapshot;

  if (!snapshot) {
    return <NonReadyState record={record} />;
  }

  const relationshipLabel = mapRelationshipPatternLabel(snapshot.fitOverview.relationshipPattern);
  const heroHeadline = buildHeroHeadline(snapshot.fitOverview.headline);
  const generatedAtLabel = formatTimestamp(snapshot.generatedAt) ?? snapshot.generatedAt;
  const recommendedNextHrStep =
    snapshot.onboardingGuidance.supportNeeds[0] ??
    snapshot.frictionRisks[0]?.mitigationFocus ??
    null;
  const { signalHighlights, validationHighlights } = buildKeyHighlights(snapshot);
  const [activeTab, setActiveTab] = useState<TeamFitReportTabId>("pregled");

  return (
    <div className="space-y-5 pb-12">
      <DashboardInfoCardShell className="rounded-[1.2rem] border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.97))] p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.55fr)]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <DashboardStatusBadge tone="success" emphasized>
                Spremno za pregled
              </DashboardStatusBadge>
              <DashboardStatusBadge className="border-[#118ab2]/20 bg-[#118ab2]/10 text-[#073b4c]">
                {relationshipLabel}
              </DashboardStatusBadge>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#073b4c]">
                Team Fit izvještaj
              </p>
              <h1 className="max-w-4xl text-[1.65rem] font-extrabold leading-[1.15] text-[#073b4c] sm:text-[1.95rem]">
                {heroHeadline}
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-600">
                {snapshot.fitOverview.summary}
              </p>
            </div>

            <div className="grid gap-3 pt-1 md:grid-cols-3">
              <InfoPanel label="Glavni nalaz">{snapshot.fitOverview.summary}</InfoPanel>
              <InfoPanel label="Relationship pattern">{relationshipLabel}</InfoPanel>
              <InfoPanel label="Sljedeći HR korak">
                {recommendedNextHrStep ?? "Nije eksplicitno naveden u snapshotu."}
              </InfoPanel>
            </div>
          </div>

          <div className="space-y-3 rounded-[1rem] border border-slate-200/90 bg-white/80 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MetaCard
                label="Kandidat"
                value={record.candidate.displayName ?? snapshot.candidateContext.displayName ?? "Kandidat"}
              />
              <MetaCard label="Tim" value={record.team.name ?? snapshot.teamContext.teamName ?? "Tim"} />
              <MetaCard label="Verzija" value={record.reportVersion} />
              <MetaCard label="Generisano" value={generatedAtLabel} />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-slate-200/80 pt-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)]">
          <div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Ključni signali
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                {signalHighlights.map((highlight) => (
                  <CompactHighlightCard key={`${highlight.label}-${highlight.title}`} {...highlight} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Ključni rizici i validacija
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {validationHighlights.map((highlight) => (
                  <CompactHighlightCard key={`${highlight.label}-${highlight.title}`} {...highlight} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="sticky top-0 z-10 rounded-[0.95rem] border-slate-200/90 bg-white/95 p-0 backdrop-blur">
        <div
          role="tablist"
          aria-label="Team Fit report tabs"
          className="flex gap-0 overflow-x-auto border-b border-slate-200/90 px-2 [scrollbar-width:thin]"
        >
          {TEAM_FIT_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              id={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              onSelect={setActiveTab}
            />
          ))}
        </div>
      </DashboardInfoCardShell>

      <div className="space-y-4">
        <TabPanel id="pregled" activeTab={activeTab}>
          <OverviewTab
            snapshot={snapshot}
            relationshipLabel={relationshipLabel}
            recommendedNextHrStep={recommendedNextHrStep}
          />
        </TabPanel>

        <TabPanel id="fit-signali" activeTab={activeTab}>
          <FitSignalsTab snapshot={snapshot} />
        </TabPanel>

        <TabPanel id="rizici-i-validacija" activeTab={activeTab}>
          <RisksValidationTab snapshot={snapshot} />
        </TabPanel>

        <TabPanel id="intervju" activeTab={activeTab}>
          <InterviewTab snapshot={snapshot} />
        </TabPanel>

        <TabPanel id="onboarding" activeTab={activeTab}>
          <OnboardingTab snapshot={snapshot} />
        </TabPanel>

        <TabPanel id="napomene" activeTab={activeTab}>
          <NotesTab snapshot={snapshot} />
        </TabPanel>
      </div>
    </div>
  );
}

export function TeamFitReportView({ record }: TeamFitReportViewProps) {
  if (record.status !== "ready" || !record.reportSnapshot) {
    return <NonReadyState record={record} />;
  }

  return <ReadyState record={record} />;
}
