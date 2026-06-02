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

function buildHeroHeadline(headline: string): string {
  const normalized = headline.trim();

  if (normalized.length <= 78) {
    return normalized;
  }

  const firstClause = normalized.split(/[.!?]/)[0]?.trim();

  if (firstClause && firstClause.length >= 24 && firstClause.length <= 78) {
    return firstClause;
  }

  return `${normalized.slice(0, 75).trimEnd()}...`;
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

function InfoPanel({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: React.ReactNode;
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-sm leading-6 text-slate-700">{children}</div>
    </div>
  );
}

function CandidateSignalCard({ signal }: { signal: TeamFitReportCandidateSignal }) {
  return (
    <DashboardInfoCardShell className="h-full rounded-[1.3rem] border-slate-200/80 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#118ab2]">Signal kandidata</p>
      <h3 className="mt-2 text-[1.08rem] font-bold tracking-[-0.03em] text-[#073b4c]">
        {signal.title}
      </h3>
      <div className="mt-4 space-y-3">
        <InfoPanel label="Relacijski signal">{signal.summary}</InfoPanel>
        <InfoPanel label="Hipoteza za provjeru" tone="info">
          {signal.relevanceToFit}
        </InfoPanel>
      </div>
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
      <div className="mt-4 space-y-3">
        <InfoPanel label="Relacijski signal">{signal.summary}</InfoPanel>
        <InfoPanel label="Šta HR treba provjeriti" tone="info">
          {signal.practicalValue}
        </InfoPanel>
      </div>
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
      <div className="mt-4 space-y-3">
        <InfoPanel label="Hipoteza za provjeru">{risk.summary}</InfoPanel>
        <InfoPanel label="Zašto je važno" tone="warning">
          {risk.whyItMayMatter}
        </InfoPanel>
        <InfoPanel label="Šta HR treba provjeriti" tone="info">
          {risk.mitigationFocus}
        </InfoPanel>
      </div>
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
      <div className="mt-4 space-y-3">
        <InfoPanel label="Koji signal se provjerava">{area.title}</InfoPanel>
        <InfoPanel label="Šta HR treba slušati" tone="warning">
          {area.rationale}
        </InfoPanel>
        <InfoPanel label="Pitanje" tone="info">
          <BulletList items={area.prompts} />
        </InfoPanel>
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

function UsageGuidanceCard() {
  return (
    <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
      <DashboardSectionHeader
        eyebrow="Kako koristiti ovaj izvještaj"
        eyebrowClassName="text-[#118ab2]"
        title="Brzi HR okvir za čitanje Team Fit izvještaja"
        description="Ovaj prikaz je read-only i služi kao razvojni HR pregled relacijskih signala, ne kao završna presuda."
        className="gap-2"
        titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
        descriptionClassName="max-w-3xl text-sm leading-6 text-slate-600"
      />
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <InfoPanel label="1. Čitaj kao signal">
          Počni od glavnog relacijskog signala i tretiraj ga kao hipotezu za provjeru, ne kao odluku.
        </InfoPanel>
        <InfoPanel label="2. Provjeri kroz intervju" tone="warning">
          Interview guidance koristi za konkretna pitanja, za ono što HR treba slušati i za signal koji se provjerava.
        </InfoPanel>
        <InfoPanel label="3. Prenesi u saradnju" tone="info">
          Onboarding i menadžerske smjernice koristi za rane dogovore o radu, komunikaciji i očekivanjima.
        </InfoPanel>
      </div>
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
            titleClassName="max-w-3xl text-[1.85rem] font-extrabold tracking-[-0.05em] text-[#073b4c] sm:text-[2.2rem]"
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
          {queuedAtLabel ? <MetaCard label="Pripremljeno" value={queuedAtLabel} /> : null}
          {startedAtLabel ? <MetaCard label="Obrada počela" value={startedAtLabel} /> : null}
          {failedAtLabel ? <MetaCard label="Označeno kao neuspješno" value={failedAtLabel} /> : null}
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
  const heroHeadline = buildHeroHeadline(snapshot.fitOverview.headline);
  const generatedAtLabel = formatTimestamp(snapshot.generatedAt) ?? snapshot.generatedAt;

  return (
    <div className="space-y-6 pb-12">
      <DashboardInfoCardShell className="rounded-[1.6rem] border-slate-200/80 p-6 sm:p-7">
        <div className="space-y-4">
          <DashboardSectionHeader
            eyebrow="Team Fit izvještaj"
            eyebrowClassName="text-[#073b4c]"
            title={heroHeadline}
            description={snapshot.fitOverview.summary}
            className="gap-2"
            titleClassName="max-w-3xl text-[1.9rem] font-extrabold tracking-[-0.05em] text-[#073b4c] sm:text-[2.2rem]"
            descriptionClassName="max-w-2xl text-[15px] leading-7 text-slate-600"
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

      <UsageGuidanceCard />

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
          title="Šta relacijski signal znači za HR"
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
          title="Šta HR treba provjeriti"
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
          title="Kako provjeriti signal kroz intervju"
          description="Svaki blok razdvaja pitanje, šta HR treba slušati i koji relacijski signal se provjerava."
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
            title="Onboarding smjernice"
            description="Ove tačke pomažu da prvi radni koraci budu jasni, operativni i usklađeni sa timskim kontekstom."
            className="gap-2"
            titleClassName="text-[1.3rem] font-bold tracking-[-0.035em] text-[#073b4c]"
            descriptionClassName="text-sm leading-6 text-slate-600"
          />
          <div className="mt-5 space-y-4">
            <InfoPanel label="Prvi prioriteti">
              <BulletList items={snapshot.onboardingGuidance.priorities} />
            </InfoPanel>
            <InfoPanel label="Šta HR treba provjeriti" tone="info">
              <BulletList items={snapshot.onboardingGuidance.supportNeeds} />
            </InfoPanel>
          </div>
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Menadžerske smjernice"
            eyebrowClassName="text-[#073b4c]"
            title="Kako voditi saradnju nakon ulaska u tim"
            description="Smjernice služe kao operativni okvir za očekivanja, način rada i komunikaciju."
            className="gap-2"
            titleClassName="text-[1.3rem] font-bold tracking-[-0.035em] text-[#073b4c]"
            descriptionClassName="text-sm leading-6 text-slate-600"
          />
          <div className="mt-5 space-y-4">
            <InfoPanel label="Način rada">
              <BulletList items={snapshot.managerGuidance.workingStyleGuidance} />
            </InfoPanel>
            <InfoPanel label="Komunikacija" tone="info">
              <BulletList items={snapshot.managerGuidance.communicationGuidance} />
            </InfoPanel>
          </div>
        </DashboardInfoCardShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Hipoteze za provjeru"
            eyebrowClassName="text-[#ef476f]"
            title="Šta još vrijedi provjeriti"
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
            eyebrow="Ograničenja tumačenja"
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
