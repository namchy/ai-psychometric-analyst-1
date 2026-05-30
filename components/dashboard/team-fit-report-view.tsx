import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DashboardStatusBadge,
} from "@/components/dashboard/primitives";
import type {
  TeamFitReportDisplayRecord,
} from "@/lib/b2b/team-fit-report-display";
import type {
  TeamFitRelationshipPattern,
  TeamFitReportCandidateSignal,
  TeamFitReportComplementaritySignal,
  TeamFitReportFrictionRisk,
  TeamFitReportInterviewArea,
  TeamFitReportPatternSummary,
} from "@/lib/b2b/team-fit-report-contract";

type TeamFitReportViewProps = {
  record: TeamFitReportDisplayRecord;
};

function formatTimestamp(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("bs-BA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
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
        <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
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

function CandidateSignalCard({ signal }: { signal: TeamFitReportCandidateSignal }) {
  return (
    <DashboardInfoCardShell className="h-full rounded-[1.3rem] border-slate-200/80 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#118ab2]">
        Signal kandidata
      </p>
      <h3 className="mt-2 text-[1.08rem] font-bold tracking-[-0.03em] text-[#073b4c]">
        {signal.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{signal.summary}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        <span className="font-semibold text-[#073b4c]">Šta ovo znači za HR razgovor: </span>
        {signal.relevanceToFit}
      </p>
    </DashboardInfoCardShell>
  );
}

function ComplementarityCard({
  signal,
}: {
  signal: TeamFitReportComplementaritySignal;
}) {
  return (
    <DashboardInfoCardShell className="h-full rounded-[1.3rem] border-[rgba(17,138,178,0.16)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(17,138,178,0.06))] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#118ab2]">
        Gdje kandidat može dopuniti tim
      </p>
      <h3 className="mt-2 text-[1.08rem] font-bold tracking-[-0.03em] text-[#073b4c]">
        {signal.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{signal.summary}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        <span className="font-semibold text-[#073b4c]">Praktična vrijednost: </span>
        {signal.practicalValue}
      </p>
    </DashboardInfoCardShell>
  );
}

function FrictionRiskCard({ risk }: { risk: TeamFitReportFrictionRisk }) {
  return (
    <DashboardInfoCardShell className="h-full rounded-[1.3rem] border-[rgba(239,71,111,0.16)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,71,111,0.05))] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ef476f]">
        Šta provjeriti prije odluke
      </p>
      <h3 className="mt-2 text-[1.08rem] font-bold tracking-[-0.03em] text-[#073b4c]">
        {risk.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{risk.summary}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        <span className="font-semibold text-[#073b4c]">Zašto je važno: </span>
        {risk.whyItMayMatter}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        <span className="font-semibold text-[#073b4c]">Mitigation fokus: </span>
        {risk.mitigationFocus}
      </p>
    </DashboardInfoCardShell>
  );
}

function InterviewAreaCard({ area }: { area: TeamFitReportInterviewArea }) {
  return (
    <DashboardInfoCardShell className="h-full rounded-[1.3rem] border-slate-200/80 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#073b4c]">
        Praktican HR razgovor
      </p>
      <h3 className="mt-2 text-[1.08rem] font-bold tracking-[-0.03em] text-[#073b4c]">
        {area.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{area.rationale}</p>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Pitanja za razgovor
        </p>
        <div className="mt-3">
          <BulletList items={area.prompts} />
        </div>
      </div>
    </DashboardInfoCardShell>
  );
}

function PatternCard({ pattern }: { pattern: TeamFitReportPatternSummary }) {
  return (
    <DashboardInfoCardShell className="h-full rounded-[1.3rem] border-slate-200/80 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#073b4c]">
        Timski kontekst
      </p>
      <h3 className="mt-2 text-[1.08rem] font-bold tracking-[-0.03em] text-[#073b4c]">
        {pattern.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{pattern.summary}</p>
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
            eyebrow="TEAM FIT REPORT"
            eyebrowClassName="text-[#073b4c]"
            title="HR pregled statusa Team Fit izvještaja"
            description={record.safeStatusMessage}
            className="gap-2"
            titleClassName="max-w-4xl text-[2rem] font-extrabold tracking-[-0.06em] text-[#073b4c] sm:text-[2.5rem]"
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
          titleClassName="text-[1.4rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {queuedAtLabel ? <MetaCard label="Queued" value={queuedAtLabel} /> : null}
          {startedAtLabel ? <MetaCard label="Started" value={startedAtLabel} /> : null}
          {failedAtLabel ? <MetaCard label="Failed" value={failedAtLabel} /> : null}
        </div>
      </DashboardInfoCardShell>
    </div>
  );
}

export function TeamFitReportView({ record }: TeamFitReportViewProps) {
  if (record.status !== "ready" || !record.reportSnapshot) {
    return <NonReadyState record={record} />;
  }

  const snapshot = record.reportSnapshot;
  const relationshipLabel = mapRelationshipPatternLabel(snapshot.fitOverview.relationshipPattern);
  const generatedAtLabel = formatTimestamp(snapshot.generatedAt) ?? snapshot.generatedAt;

  return (
    <div className="space-y-6 pb-12">
      <DashboardInfoCardShell className="rounded-[1.6rem] border-slate-200/80 p-6 sm:p-7">
        <div className="space-y-4">
          <DashboardSectionHeader
            eyebrow="TEAM FIT REPORT"
            eyebrowClassName="text-[#073b4c]"
            title={snapshot.fitOverview.headline}
            description={snapshot.fitOverview.summary}
            className="gap-2"
            titleClassName="max-w-4xl text-[2rem] font-extrabold tracking-[-0.06em] text-[#073b4c] sm:text-[2.6rem]"
            descriptionClassName="max-w-3xl text-base leading-7 text-slate-600"
          />

          <div className="flex flex-wrap gap-2.5">
            <DashboardStatusBadge tone="success" emphasized>
              Spremno za pregled
            </DashboardStatusBadge>
            <DashboardStatusBadge className="border-[#118ab2]/20 bg-[#118ab2]/10 text-[#073b4c]">
              Relacijski signal: {relationshipLabel}
            </DashboardStatusBadge>
          </div>

          <div className="grid gap-3 border-t border-slate-200/80 pt-5 md:grid-cols-2 xl:grid-cols-4">
            <MetaCard
              label="Kandidat"
              value={record.candidate.displayName ?? snapshot.candidateContext.displayName ?? "Kandidat"}
            />
            <MetaCard label="Tim" value={record.team.name ?? snapshot.teamContext.teamName ?? "Tim"} />
            <MetaCard label="Verzija izvještaja" value={record.reportVersion} />
            <MetaCard label="Generisano" value={generatedAtLabel} />
          </div>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Timski kontekst"
          eyebrowClassName="text-[#073b4c]"
          title="Kako čitati postojeći timski okvir"
          description="Ova sekcija pomaže da se fit čita kroz agregirani timski kontekst, bez pojedinačnih prikaza članova."
          className="gap-2"
          titleClassName="text-[1.45rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {snapshot.teamContextSummary.relevantTeamPatterns.map((pattern) => (
            <PatternCard key={pattern.title} pattern={pattern} />
          ))}
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Signali kandidata"
          eyebrowClassName="text-[#073b4c]"
          title="Šta ovo znači za HR razgovor"
          description="Ovdje su izdvojeni kandidat-side obrasci koji pomažu čitanju relacijskog signala bez rangiranja osobe."
          className="gap-2"
          titleClassName="text-[1.45rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {snapshot.candidateSignals.map((signal) => (
            <CandidateSignalCard key={signal.title} signal={signal} />
          ))}
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Dopuna timu"
          eyebrowClassName="text-[#118ab2]"
          title="Gdje kandidat može dopuniti tim"
          description="Fit nije isto što i sličnost. Ova sekcija ističe gdje kandidat može donijeti korisnu dopunu postojećem timu."
          className="gap-2"
          titleClassName="text-[1.45rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {snapshot.complementaritySignals.map((signal) => (
            <ComplementarityCard key={signal.title} signal={signal} />
          ))}
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Rizici i trenje"
          eyebrowClassName="text-[#ef476f]"
          title="Šta provjeriti prije odluke"
          description="Ovo su oprezne hipoteze o tome gdje bi mogla nastati trenja i kako ih vrijedi rano otvoriti."
          className="gap-2"
          titleClassName="text-[1.4rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {snapshot.frictionRisks.map((risk) => (
            <FrictionRiskCard key={risk.title} risk={risk} />
          ))}
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Interview fokus"
          eyebrowClassName="text-[#073b4c]"
          title="Kako otvoriti praktičan HR razgovor"
          description="Ova pitanja služe kao pomoć za dodatnu provjeru relacijskog signala kroz konkretne radne situacije."
          className="gap-2"
          titleClassName="text-[1.4rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {snapshot.interviewFocus.areas.map((area) => (
            <InterviewAreaCard key={area.title} area={area} />
          ))}
        </div>
      </DashboardInfoCardShell>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Onboarding"
            eyebrowClassName="text-[#118ab2]"
            title="Kako podržati onboarding"
            description="Početni onboarding fokus treba čitati kao praktičnu podršku, ne kao presudu o kandidatu."
            className="gap-2"
            titleClassName="text-[1.3rem] font-bold tracking-[-0.035em] text-[#073b4c]"
            descriptionClassName="text-sm leading-6 text-slate-600"
          />
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Prioriteti
              </p>
              <div className="mt-3">
                <BulletList items={snapshot.onboardingGuidance.priorities} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Support needs
              </p>
              <div className="mt-3">
                <BulletList items={snapshot.onboardingGuidance.supportNeeds} />
              </div>
            </div>
          </div>
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Manager guidance"
            eyebrowClassName="text-[#073b4c]"
            title="Kako voditi saradnju"
            description="Smjernice služe za operativnu podršku lideru ili HR-u pri uvođenju kandidata u tim."
            className="gap-2"
            titleClassName="text-[1.3rem] font-bold tracking-[-0.035em] text-[#073b4c]"
            descriptionClassName="text-sm leading-6 text-slate-600"
          />
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Working style guidance
              </p>
              <div className="mt-3">
                <BulletList items={snapshot.managerGuidance.workingStyleGuidance} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Communication guidance
              </p>
              <div className="mt-3">
                <BulletList items={snapshot.managerGuidance.communicationGuidance} />
              </div>
            </div>
          </div>
        </DashboardInfoCardShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Watchouts"
            eyebrowClassName="text-[#ef476f]"
            title="Oprezne hipoteze"
            description="Ove tačke ne treba čitati kao završni sud, nego kao teme koje traže dodatnu provjeru."
            className="gap-2"
            titleClassName="text-[1.3rem] font-bold tracking-[-0.035em] text-[#073b4c]"
            descriptionClassName="text-sm leading-6 text-slate-600"
          />
          <div className="mt-5">
            <BulletList items={snapshot.watchouts} />
          </div>
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Interpretation limits"
            eyebrowClassName="text-slate-500"
            title="Kako oprezno čitati ovaj izvještaj"
            description="Guardrail napomene ostaju dio HR/internal čitanja i ne služe za automatsko decisioning tumačenje."
            className="gap-2"
            titleClassName="text-[1.3rem] font-bold tracking-[-0.035em] text-[#073b4c]"
            descriptionClassName="text-sm leading-6 text-slate-600"
          />
          <div className="mt-5">
            <BulletList items={snapshot.interpretationLimits} />
          </div>
        </DashboardInfoCardShell>
      </div>
    </div>
  );
}
