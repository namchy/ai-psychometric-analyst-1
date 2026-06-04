"use client";

import { useState, type ReactNode } from "react";
import { DashboardStatusBadge } from "@/components/dashboard/primitives";
import { SingleOpenPanelGroup } from "@/components/dashboard/single-open-panel-group";
import {
  CalloutBlock,
  DetailBlock,
  ExpandableInsightCard,
  InsightCard,
  ReportHero,
  ReportMetaCard,
  ReportMetaGrid,
  ReportSection,
  ReportShell,
  ReportTabNav,
  ReportTabPanel,
} from "@/components/dashboard/team-fit-report-ui-primitives";
import type { TeamFitReportDisplayRecord } from "@/lib/b2b/team-fit-report-display";
import type { TeamFitRelationshipPattern } from "@/lib/b2b/team-fit-report-contract";

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
  return headline.trim();
}

function compact<T>(items: Array<T | null | undefined>): T[] {
  return items.filter((item): item is T => item != null);
}

function firstOrNull<T>(items: readonly T[] | null | undefined): T | null {
  return items && items.length > 0 ? items[0] : null;
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
      <ReportHero className="rounded-[1.6rem] border-slate-200/80 p-6 sm:p-7">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#073b4c]">
              Team Fit izvještaj
            </p>
            <h1 className="max-w-3xl text-[1.85rem] font-extrabold text-[#073b4c] sm:text-[2.2rem]">
              HR pregled statusa Team Fit izvještaja
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-600">{record.safeStatusMessage}</p>
          </div>

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
            <ReportMetaCard
              label="Kandidat"
              value={record.candidate.displayName ?? "Kandidat"}
              helper={record.candidate.participantId}
            />
            <ReportMetaCard label="Tim" value={record.team.name ?? "Tim"} />
            <ReportMetaCard label="Kreirano" value={createdAtLabel} />
            <ReportMetaCard label="Verzija izvještaja" value={record.reportVersion} />
          </div>
        </div>
      </ReportHero>

      <ReportSection
        eyebrow="Status obrade"
        eyebrowClassName="text-[#073b4c]"
        title="Šta je trenutno dostupno"
        description="Ovaj prikaz je read-only i ne nudi obradu, retry ili druge akcije u ovom slice-u."
        titleClassName="text-[1.4rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <div className="grid gap-3 md:grid-cols-3">
          {queuedAtLabel ? <ReportMetaCard label="Pripremljeno" value={queuedAtLabel} /> : null}
          {startedAtLabel ? <ReportMetaCard label="Obrada počela" value={startedAtLabel} /> : null}
          {failedAtLabel ? <ReportMetaCard label="Označeno kao neuspješno" value={failedAtLabel} /> : null}
        </div>
      </ReportSection>
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
      <ReportSection
        eyebrow="Pregled"
        title="Kompaktni pregled za brzo čitanje"
        description="Najvažnije informacije su već ovdje, bez potrebe da otvaraš detaljne blokove."
        titleClassName="text-[1.45rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <CalloutBlock label="Glavni zaključak">{snapshot.fitOverview.summary}</CalloutBlock>
          <CalloutBlock label="Relationship pattern">{relationshipLabel}</CalloutBlock>
          <CalloutBlock label="Preporučeni sljedeći HR korak">
            {recommendedNextHrStep ?? "Nije eksplicitno naveden u snapshotu."}
          </CalloutBlock>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <CalloutBlock label="Timski kontekst">
            {teamPattern?.title ? <p className="font-semibold text-[#073b4c]">{teamPattern.title}</p> : null}
            {teamPattern?.summary ? <p className="mt-1">{teamPattern.summary}</p> : null}
          </CalloutBlock>
          <CalloutBlock label="Kandidatov signal">
            {candidateSignal?.title ? (
              <p className="font-semibold text-[#073b4c]">{candidateSignal.title}</p>
            ) : null}
            {candidateSignal?.summary ? <p className="mt-1">{candidateSignal.summary}</p> : null}
          </CalloutBlock>
          <CalloutBlock label="Dopuna timu">
            {complementaritySignal?.title ? (
              <p className="font-semibold text-[#073b4c]">{complementaritySignal.title}</p>
            ) : null}
            {complementaritySignal?.summary ? (
              <p className="mt-1">{complementaritySignal.summary}</p>
            ) : null}
          </CalloutBlock>
          <CalloutBlock label="Rizik / validacija">
            {firstRisk?.title ? <p className="font-semibold text-[#073b4c]">{firstRisk.title}</p> : null}
            {firstRisk?.summary ? <p className="mt-1">{firstRisk.summary}</p> : null}
            {firstWatchout ? <p className="mt-2 text-slate-600">{firstWatchout}</p> : null}
          </CalloutBlock>
        </div>
      </ReportSection>

      <ReportSection
        eyebrow="Kako čitati dalje"
        title="Brzi pregled čitanja"
        description="Tabovi ispod zadržavaju puni sadržaj, a ovaj blok služi kao orijentir za HR čitanje."
        eyebrowClassName="text-[#118ab2]"
        titleClassName="text-[1.3rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <CalloutBlock label="1. Relacijski signal">
            Počni od glavnog zaključka i relationship pattern-a, pa ga čitaj kao hipotezu za provjeru.
          </CalloutBlock>
          <CalloutBlock label="2. Provjeri kroz razgovor" tone="warning">
            Interview blokovi nude konkretna pitanja i ono što HR treba slušati.
          </CalloutBlock>
          <CalloutBlock label="3. Prenesi u saradnju" tone="info">
            Onboarding i menadžerske smjernice koristi za rane dogovore o radu, komunikaciji i očekivanjima.
          </CalloutBlock>
        </div>
      </ReportSection>

      {interviewLead ? (
        <ReportSection
          eyebrow="Prvi intervju signal"
          title="Kratka početna tema za razgovor"
          description="Ovo je najkraći ulaz u intervju blok i pomaže da se razgovor brzo usidri u konkretan radni kontekst."
          eyebrowClassName="text-[#073b4c]"
          titleClassName="text-[1.3rem] font-bold text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <CalloutBlock label="Tema">{interviewLead.title}</CalloutBlock>
            <CalloutBlock label="Zašto je važno" tone="info">
              {interviewLead.rationale}
            </CalloutBlock>
            <div className="lg:col-span-2">
              <CalloutBlock label="Pitanja">
                <BulletList items={interviewLead.prompts} />
              </CalloutBlock>
            </div>
          </div>
        </ReportSection>
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
      <ReportSection
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
            <InsightCard
              key={pattern.title}
              eyebrow="Timski signal"
              title={pattern.title}
              summary={pattern.summary}
            />
          ))}
        </div>
      </ReportSection>

      <ReportSection
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
                <DetailBlock label="Zašto je važno" tone="info">
                  {signal.summary}
                </DetailBlock>
                <DetailBlock label="Kako se može vidjeti u radu" tone="info">
                  {signal.relevanceToFit}
                </DetailBlock>
                <DetailBlock label="Dodatna interpretacija">
                  Ovaj signal je korisnije čitati kao hipotezu za provjeru nego kao zaključak.
                </DetailBlock>
              </div>
            </ExpandableInsightCard>
          ))}
        </SingleOpenPanelGroup>
      </ReportSection>

      <ReportSection
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
                <DetailBlock label="Kako se može vidjeti u radu" tone="info">
                  {signal.practicalValue}
                </DetailBlock>
                <DetailBlock label="Dodatna interpretacija">
                  Ovaj signal služi za razgovor o tome gdje kandidat može dopuniti postojeći ritam tima.
                </DetailBlock>
              </div>
            </ExpandableInsightCard>
          ))}
        </SingleOpenPanelGroup>
      </ReportSection>
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
      <ReportSection
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
                <DetailBlock label="Hipoteza za provjeru" tone="warning">
                  {risk.summary}
                </DetailBlock>
                <DetailBlock label="Zašto je važno" tone="warning">
                  {risk.whyItMayMatter}
                </DetailBlock>
                <DetailBlock label="Šta HR treba provjeriti" tone="info">
                  {risk.mitigationFocus}
                </DetailBlock>
              </div>
            </ExpandableInsightCard>
          ))}
        </SingleOpenPanelGroup>
      </ReportSection>

      <ReportSection
        eyebrow="Hipoteze za provjeru"
        title="Watchouts koji traže dodatnu pažnju"
        description="Ove tačke ne treba čitati kao završni sud, nego kao teme koje traže dodatnu provjeru."
        eyebrowClassName="text-[#ef476f]"
        titleClassName="text-[1.4rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <div className="space-y-3">
          {snapshot.watchouts.map((watchout) => (
            <CalloutBlock key={watchout} label="Dodatna provjera" tone="warning">
              {watchout}
            </CalloutBlock>
          ))}
        </div>
      </ReportSection>

      <ReportSection
        eyebrow="Ograničenja tumačenja"
        title="Kako oprezno čitati ovaj izvještaj"
        description="Guardrail napomene ostaju dio HR/internal čitanja i ne služe za automatsko decisioning tumačenje."
        eyebrowClassName="text-slate-500"
        titleClassName="text-[1.3rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <div className="space-y-3">
          {snapshot.interpretationLimits.map((limit) => (
            <CalloutBlock key={limit} label="Limit tumačenja">
              {limit}
            </CalloutBlock>
          ))}
        </div>
      </ReportSection>
    </div>
  );
}

function InterviewTab({
  snapshot,
}: {
  snapshot: NonNullable<TeamFitReportDisplayRecord["reportSnapshot"]>;
}) {
  return (
    <ReportSection
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
              <DetailBlock label="Zašto je važno" tone="warning">
                {area.rationale}
              </DetailBlock>
              <DetailBlock label="Pitanja" tone="info">
                <BulletList items={area.prompts} />
              </DetailBlock>
              <DetailBlock label="Dodatna interpretacija">
                Ovaj blok pomaže da se signal potvrdi kroz konkretan razgovor, a ne kroz utisak.
              </DetailBlock>
            </div>
          </ExpandableInsightCard>
        ))}
      </SingleOpenPanelGroup>
    </ReportSection>
  );
}

function OnboardingTab({
  snapshot,
}: {
  snapshot: NonNullable<TeamFitReportDisplayRecord["reportSnapshot"]>;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportSection
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
              <DetailBlock label="Prvi prioriteti">
                <BulletList items={snapshot.onboardingGuidance.priorities} />
              </DetailBlock>
            </div>
          </ExpandableInsightCard>
          <ExpandableInsightCard
            category="Onboarding"
            title="Šta HR treba provjeriti"
            summary="Gdje su potrebni dodatni dogovori ili podrška u startu."
            tone="info"
          >
            <div className="grid gap-3">
              <DetailBlock label="Šta HR treba provjeriti" tone="info">
                <BulletList items={snapshot.onboardingGuidance.supportNeeds} />
              </DetailBlock>
              <DetailBlock label="Dodatna interpretacija">
                Ovo je prostor za rani dogovor o tempu, podršci i očekivanjima.
              </DetailBlock>
            </div>
          </ExpandableInsightCard>
        </SingleOpenPanelGroup>
      </ReportSection>

      <ReportSection
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
              <DetailBlock label="Način rada">
                <BulletList items={snapshot.managerGuidance.workingStyleGuidance} />
              </DetailBlock>
            </div>
          </ExpandableInsightCard>
          <ExpandableInsightCard
            category="Menadžerske smjernice"
            title="Komunikacija"
            summary="Kako držati očekivanja i povratne informacije jasnima."
            tone="info"
          >
            <div className="grid gap-3">
              <DetailBlock label="Komunikacija" tone="info">
                <BulletList items={snapshot.managerGuidance.communicationGuidance} />
              </DetailBlock>
              <DetailBlock label="Dodatna interpretacija">
                Kratke, konkretne provjere smanjuju šansu za pogrešno razumijevanje.
              </DetailBlock>
            </div>
          </ExpandableInsightCard>
        </SingleOpenPanelGroup>
      </ReportSection>
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
      <ReportSection
        eyebrow="Napomene"
        title="Interpretation notes i sigurnosne granice"
        description="Ovaj tab je namjerno mirniji i skuplja sve što služi oprezu, kontekstu i fairness čitanju."
        eyebrowClassName="text-slate-500"
        titleClassName="text-[1.3rem] font-bold text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <DetailBlock label="Watchouts" tone="warning">
            <BulletList items={snapshot.watchouts} />
          </DetailBlock>
          <DetailBlock label="Ograničenja tumačenja" tone="info">
            <BulletList items={snapshot.interpretationLimits} />
          </DetailBlock>
        </div>
      </ReportSection>
    </div>
  );
}

function ReadyState({ record }: TeamFitReportViewProps) {
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
    <ReportShell>
      <ReportHero>
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
              <CalloutBlock label="Glavni nalaz">{snapshot.fitOverview.summary}</CalloutBlock>
              <CalloutBlock label="Relationship pattern">{relationshipLabel}</CalloutBlock>
              <CalloutBlock label="Sljedeći HR korak">
                {recommendedNextHrStep ?? "Nije eksplicitno naveden u snapshotu."}
              </CalloutBlock>
            </div>
          </div>

          <ReportMetaGrid>
            <ReportMetaCard
              label="Kandidat"
              value={record.candidate.displayName ?? snapshot.candidateContext.displayName ?? "Kandidat"}
            />
            <ReportMetaCard label="Tim" value={record.team.name ?? snapshot.teamContext.teamName ?? "Tim"} />
            <ReportMetaCard label="Verzija" value={record.reportVersion} />
            <ReportMetaCard label="Generisano" value={generatedAtLabel} />
          </ReportMetaGrid>
        </div>

        <div className="mt-5 grid gap-4 border-t border-slate-200/80 pt-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Ključni signali
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              {signalHighlights.map((highlight) => (
                <InsightCard
                  key={`${highlight.label}-${highlight.title}`}
                  eyebrow={highlight.label}
                  title={highlight.title}
                  summary={highlight.summary}
                  helper={highlight.helper}
                  tone={highlight.tone}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Ključni rizici i validacija
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {validationHighlights.map((highlight) => (
                <InsightCard
                  key={`${highlight.label}-${highlight.title}`}
                  eyebrow={highlight.label}
                  title={highlight.title}
                  summary={highlight.summary}
                  helper={highlight.helper}
                  tone={highlight.tone}
                />
              ))}
            </div>
          </div>
        </div>
      </ReportHero>

      <ReportTabNav
        tabs={TEAM_FIT_TABS}
        activeTab={activeTab}
        onSelect={setActiveTab}
        ariaLabel="Team Fit report tabs"
      />

      <div className="space-y-4">
        <ReportTabPanel id="pregled" activeTab={activeTab}>
          <OverviewTab
            snapshot={snapshot}
            relationshipLabel={relationshipLabel}
            recommendedNextHrStep={recommendedNextHrStep}
          />
        </ReportTabPanel>

        <ReportTabPanel id="fit-signali" activeTab={activeTab}>
          <FitSignalsTab snapshot={snapshot} />
        </ReportTabPanel>

        <ReportTabPanel id="rizici-i-validacija" activeTab={activeTab}>
          <RisksValidationTab snapshot={snapshot} />
        </ReportTabPanel>

        <ReportTabPanel id="intervju" activeTab={activeTab}>
          <InterviewTab snapshot={snapshot} />
        </ReportTabPanel>

        <ReportTabPanel id="onboarding" activeTab={activeTab}>
          <OnboardingTab snapshot={snapshot} />
        </ReportTabPanel>

        <ReportTabPanel id="napomene" activeTab={activeTab}>
          <NotesTab snapshot={snapshot} />
        </ReportTabPanel>
      </div>
    </ReportShell>
  );
}

export function TeamFitReportView({ record }: TeamFitReportViewProps) {
  if (record.status !== "ready" || !record.reportSnapshot) {
    return <NonReadyState record={record} />;
  }

  return <ReadyState record={record} />;
}
