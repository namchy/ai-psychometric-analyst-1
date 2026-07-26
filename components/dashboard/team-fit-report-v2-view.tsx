import { DpStatusBadge } from "@/components/dashboard/primitives";
import {
  CalloutBlock,
  DetailBlock,
  InsightCard,
  ReportHero,
  ReportMetaCard,
  ReportMetaGrid,
  ReportSection,
  ReportShell,
} from "@/components/dashboard/team-fit-report-ui-primitives";
import type { TeamFitReportV2DisplayRecord } from "@/lib/b2b/team-fit-report-display";
import type {
  TeamFitReportV2ActionOwner,
  TeamFitReportV2AssessmentCategory,
  TeamFitReportV2EvidenceReference,
} from "@/lib/b2b/team-fit-report-v2-contract";
import { formatHrDateTime } from "@/lib/dashboard/hr-ui-format";

type TeamFitReportV2ViewProps = { record: TeamFitReportV2DisplayRecord };

function categoryPresentation(category: TeamFitReportV2AssessmentCategory): {
  label: string;
  tone: "success" | "info" | "warning" | "danger" | "neutral";
} {
  switch (category) {
    case "strong_fit": return { label: "Snažno slaganje", tone: "success" };
    case "good_fit_with_conditions": return { label: "Dobro slaganje uz uslove", tone: "info" };
    case "mixed_fit": return { label: "Mješoviti signali", tone: "warning" };
    case "weak_fit": return { label: "Izražene tačke opreza", tone: "danger" };
    case "insufficient_evidence": default: return { label: "Nedovoljno dokaza", tone: "neutral" };
  }
}

function ownerLabel(owner: TeamFitReportV2ActionOwner): string {
  switch (owner) {
    case "hr": return "HR";
    case "hiring_manager": return "Odgovorni menadžer";
    case "team_lead": return "Voditelj tima";
    case "candidate": return "Kandidat";
    case "team": return "Tim";
    case "shared": default: return "Zajednička odgovornost";
  }
}

function provenanceLabel(refs: TeamFitReportV2EvidenceReference[]): string {
  const sources = new Set(refs.map((reference) => reference.source));
  if (sources.has("candidate") && sources.has("team")) return "Signali kandidata i tima";
  return sources.has("team") ? "Signal tima" : "Signal kandidata";
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={`${index}-${item}`} className="flex items-start gap-3 text-[15px] leading-7 text-slate-700">
          <span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#118ab2]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Provenance({ refs }: { refs: TeamFitReportV2EvidenceReference[] }) {
  return <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#118ab2]">{provenanceLabel(refs)}</p>;
}

function NonReadyState({ record }: TeamFitReportV2ViewProps) {
  return (
    <ReportShell>
      <ReportHero>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <DpStatusBadge tone={record.status === "failed" ? "danger" : "info"}>{record.status === "failed" ? "Priprema nije uspjela" : record.status === "processing" ? "Priprema u toku" : "Čeka obradu"}</DpStatusBadge>
              <DpStatusBadge tone="info">V2 · Aktivni Team Fit</DpStatusBadge>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#118ab2]">Team Fit V2</p>
              <h1 className="mt-2 text-2xl font-extrabold leading-tight text-[#073b4c]">{record.candidate.displayName ?? "Kandidat"} × {record.team.name ?? "Tim"}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{record.safeStatusMessage}</p>
            </div>
          </div>
          <ReportMetaGrid>
            <ReportMetaCard label="Kandidat" value={record.candidate.displayName ?? "Kandidat"} />
            <ReportMetaCard label="Tim" value={record.team.name ?? "Tim"} />
            <ReportMetaCard label="Verzija" value="V2" />
            <ReportMetaCard label="Kreirano" value={formatHrDateTime(record.createdAt)} />
          </ReportMetaGrid>
        </div>
      </ReportHero>
    </ReportShell>
  );
}

export function TeamFitReportV2View({ record }: TeamFitReportV2ViewProps) {
  const snapshot = record.reportSnapshot;
  if (record.status !== "ready" || !snapshot) return <NonReadyState record={record} />;
  const category = categoryPresentation(snapshot.executiveAssessment.category);

  return (
    <ReportShell>
      <ReportHero>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(18rem,0.42fr)]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <DpStatusBadge tone="success" emphasized>Spremno za pregled</DpStatusBadge>
              <DpStatusBadge tone={category.tone}>{category.label}</DpStatusBadge>
              <DpStatusBadge tone="info">V2 · Aktivni Team Fit</DpStatusBadge>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#118ab2]">{record.candidate.displayName ?? snapshot.candidateContext.displayName ?? "Kandidat"} × {record.team.name ?? snapshot.teamContext.teamName ?? "Tim"}</p>
              <h1 className="max-w-4xl text-[1.75rem] font-extrabold leading-[1.15] text-[#073b4c] sm:text-[2.1rem]">{snapshot.executiveAssessment.headline}</h1>
              <p className="max-w-4xl text-base leading-7 text-slate-700">{snapshot.executiveAssessment.conclusion}</p>
            </div>
            <CalloutBlock label="Smjernica za odluku" tone="info">{snapshot.executiveAssessment.decisionGuidance}</CalloutBlock>
          </div>
          <ReportMetaGrid>
            <ReportMetaCard label="Kandidat" value={record.candidate.displayName ?? snapshot.candidateContext.displayName ?? "Kandidat"} />
            <ReportMetaCard label="Tim" value={record.team.name ?? snapshot.teamContext.teamName ?? "Tim"} />
            <ReportMetaCard label="Procjena" value={category.label} />
            <ReportMetaCard label="Generisano" value={formatHrDateTime(snapshot.generatedAt)} />
          </ReportMetaGrid>
        </div>
      </ReportHero>

      <ReportSection eyebrow="Obrazloženje" title="Glavni razlozi i ključni signali" description="Relacijski signali koji povezuju kandidata s načinom rada ovog tima.">
        <div className="grid gap-4 lg:grid-cols-2">
          {snapshot.executiveAssessment.mainReasons.map((reason, index) => <InsightCard key={`${index}-${reason.title}`} eyebrow="Glavni razlog" title={reason.title} summary={<><p>{reason.explanation}</p><p className="mt-2 font-medium text-[#073b4c]">{reason.practicalConsequence}</p><Provenance refs={reason.evidenceRefs} /></>} tone="info" />)}
          {snapshot.keySignals.map((signal, index) => <InsightCard key={`${index}-${signal.title}`} eyebrow="Ključni signal" title={signal.title} summary={<><p>{signal.explanation}</p><p className="mt-2">{signal.practicalMeaning}</p><Provenance refs={signal.evidenceRefs} /></>} />)}
        </div>
      </ReportSection>

      <ReportSection eyebrow="Doprinos" title="Mogući doprinosi i uslovi uspjeha">
        <div className="grid gap-4 lg:grid-cols-2">
          {snapshot.likelyContributions.map((item, index) => <InsightCard key={`${index}-${item.title}`} eyebrow="Mogući doprinos" title={item.title} summary={<><p>{item.explanation}</p><p className="mt-2"><strong>Uslovi:</strong> {item.conditions}</p><Provenance refs={item.evidenceRefs} /></>} tone="info" />)}
          {snapshot.successConditions.map((item, index) => <DetailBlock key={`${index}-${item.title}`} label={item.title}><p>{item.condition}</p><p className="mt-2 text-slate-600">{item.whyItMatters}</p><p className="mt-3 text-sm font-semibold text-[#073b4c]">{ownerLabel(item.owner)} · {item.timing}</p></DetailBlock>)}
        </div>
      </ReportSection>

      <ReportSection eyebrow="Oprez i provjera" title="Tačke trenja i provjera" eyebrowClassName="text-[#ef476f]">
        <div className="grid gap-4 lg:grid-cols-2">
          {snapshot.frictionRisks.map((risk, index) => <InsightCard key={`${index}-${risk.title}`} eyebrow="Tačka trenja" title={risk.title} tone="warning" summary={<div className="space-y-2"><p><strong>Okidač:</strong> {risk.trigger}</p><p><strong>Obrazac:</strong> {risk.likelyPattern}</p><p><strong>Uticaj na tim:</strong> {risk.teamImpact}</p><p><strong>Ublažavanje:</strong> {risk.mitigation}</p><p className="font-semibold text-[#073b4c]">{ownerLabel(risk.owner)} · {risk.timing}</p><Provenance refs={risk.evidenceRefs} /></div>} />)}
        </div>
      </ReportSection>

      <ReportSection eyebrow="Intervju" title="Teme za intervju" description="Pitanja za provjeru konkretnih relacijskih hipoteza.">
        <div className="grid gap-4 lg:grid-cols-2">
          {snapshot.interviewPlan.map((item, index) => <InsightCard key={`${index}-${item.question}`} eyebrow={`Pitanje ${index + 1}`} title={item.question} summary={<div className="space-y-3"><p><strong>Svrha:</strong> {item.purpose}</p><p><strong>Slušati:</strong> {item.whatToListenFor}</p><DetailBlock label="Pozitivni signali" tone="info"><BulletList items={item.positiveSignals} /></DetailBlock><DetailBlock label="Signali opreza" tone="warning"><BulletList items={item.concernSignals} /></DetailBlock><Provenance refs={item.evidenceRefs} /></div>} />)}
        </div>
      </ReportSection>

      <ReportSection eyebrow="Integracija u konkretni tim" title="Integracija kandidata u ovaj tim" description={snapshot.teamIntegrationPlan.summary}>
        <div className="grid gap-4 lg:grid-cols-2">
          <DetailBlock label="Prilagodbe za ovaj tim" tone="info">{snapshot.teamIntegrationPlan.adaptForThisTeam.map((item, index) => <div key={`${index}-${item.action}`} className="mb-4 last:mb-0"><p>{item.action}</p><p className="mt-1 text-sm font-semibold text-[#073b4c]">{ownerLabel(item.owner)} · {item.timing}</p><p className="mt-1 text-sm text-slate-600">Očekivano: {item.expectedResult}</p></div>)}</DetailBlock>
          <DetailBlock label="Priprema tima">{snapshot.teamIntegrationPlan.teamPreparations.map((item, index) => <div key={`${index}-${item.action}`} className="mb-4 last:mb-0"><p>{item.action}</p><p className="mt-1 text-sm font-semibold text-[#073b4c]">{ownerLabel(item.owner)} · {item.timing}</p></div>)}</DetailBlock>
          <DetailBlock label="Prvih 30 dana">{snapshot.teamIntegrationPlan.first30Days.map((item, index) => <div key={`${index}-${item.action}`} className="mb-4 last:mb-0"><p className="font-semibold text-[#073b4c]">{item.timing}</p><p>{item.action}</p><p className="mt-1 text-sm text-slate-600">{ownerLabel(item.owner)} · {item.expectedResult}</p></div>)}</DetailBlock>
          <div className="grid gap-4"><DetailBlock label="Rani znaci uspješne integracije" tone="info"><BulletList items={snapshot.teamIntegrationPlan.successSignals} /></DetailBlock><DetailBlock label="Rani znaci trenja" tone="warning"><BulletList items={snapshot.teamIntegrationPlan.earlyFrictionSignals} /></DetailBlock></div>
        </div>
      </ReportSection>

      <ReportSection eyebrow="Menadžerske smjernice" title="Kako menadžer može podržati odnos kandidat × tim">
        <div className="grid gap-4 lg:grid-cols-2">
          {snapshot.managerGuidance.map((item, index) => <InsightCard key={`${index}-${item.action}`} eyebrow="Smjernica" title={item.action} summary={<div className="space-y-2"><p>{item.rationale}</p><p><strong>Vrijeme:</strong> {item.timing}</p><p><strong>Pratiti:</strong> {item.watchFor}</p></div>} tone="info" />)}
        </div>
      </ReportSection>

      <ReportSection eyebrow="Ograničenja" title="Granice tumačenja" eyebrowClassName="text-slate-500">
        <BulletList items={snapshot.interpretationLimits} />
      </ReportSection>
    </ReportShell>
  );
}
