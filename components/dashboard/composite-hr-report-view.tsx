import Link from "next/link";
import type { AssessmentReportRecord } from "@/lib/assessment/assessment-reports";
import type { CompositeHrReportSnapshot } from "@/lib/assessment/composite-hr-report-contract";
import { getAssessmentDisplayName } from "@/lib/assessment/display";
import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DashboardStatusBadge,
} from "@/components/dashboard/primitives";

type CompositeHrReportViewProps = {
  report: AssessmentReportRecord;
  snapshot: CompositeHrReportSnapshot;
};

export type CompositeHrReportViewModel = {
  title: "Kompozitni HR izvještaj";
  statusLabel: "Spremno za pregled";
  description: string;
  participantReportsHref: string;
  source: {
    assessmentAssignmentId: string;
    assessmentCycleLabel: string;
    assessmentCycleIdLabel: string;
    assessmentCountLabel: string;
    testLabels: string[];
    generationModeLabel: string | null;
    sourceAttemptCount: number;
    generatedAt: string;
    locale: string;
  };
  summary: CompositeHrReportSnapshot["summary"];
  integratedSignals: Array<
    Omit<CompositeHrReportSnapshot["integratedSignals"][number], "evidence"> & {
      evidence: Array<
        CompositeHrReportSnapshot["integratedSignals"][number]["evidence"][number] & {
          displayTestLabel: string;
        }
      >;
    }
  >;
  interviewGuidance: CompositeHrReportSnapshot["interviewGuidance"];
  onboardingGuidance: CompositeHrReportSnapshot["onboardingGuidance"];
  limitations: string[];
};

const SOURCE_TEST_LABELS: Record<string, string> = {
  "ipip-neo-120-v1": "Procjena ličnosti",
  safran_v1: "Kognitivna procjena",
  mwms_v1: "Motivacija za rad",
};

const EVIDENCE_TEST_LABELS: Record<string, string> = {
  "ipip-neo-120-v1": "Ličnost",
  safran_v1: "Kognitivni rezultat",
  mwms_v1: "Motivacija",
};

function formatAssessmentCountLabel(count: number): string {
  return `${count} završene procjene`;
}

function formatAssessmentCycleIdLabel(value: string): string {
  if (value.length <= 10) {
    return `ID: ${value}`;
  }

  return `ID: ${value.slice(0, 8)}...`;
}

function getSourceTestLabel(slug: string): string {
  return SOURCE_TEST_LABELS[slug] ?? getAssessmentDisplayName({ slug });
}

function getEvidenceTestLabel(slug: string): string {
  return EVIDENCE_TEST_LABELS[slug] ?? getAssessmentDisplayName({ slug });
}

function getGenerationModeLabel(provider: string): string | null {
  switch (provider.trim().toLowerCase()) {
    case "mock":
      return "Testni prikaz";
    case "openai":
      return "AI interpretacija";
    default:
      return null;
  }
}

function sanitizeLimitationCopy(value: string): string {
  return value
    .replace(/source attempts/gi, "izvorne procjene")
    .replace(/assessment ciklusa/gi, "procjenskog ciklusa")
    .replace(/score vrijednosti/gi, "rezultate procjena");
}

function sanitizeDisplayCopy(value: string): string {
  return sanitizeLimitationCopy(value).replace(/linked attemptova/gi, "povezanih procjena");
}

export function buildCompositeHrReportViewModel(input: {
  report: AssessmentReportRecord;
  snapshot: CompositeHrReportSnapshot;
}): CompositeHrReportViewModel {
  return {
    title: "Kompozitni HR izvještaj",
    statusLabel: "Spremno za pregled",
    description: "Ovaj prikaz koristi već generisan izvještaj i ne mijenja rezultate procjena.",
    participantReportsHref: `/dashboard/participants/${input.report.participant_id}/reports`,
    source: {
      assessmentAssignmentId: input.snapshot.generatedFor.assessmentAssignmentId,
      assessmentCycleLabel: "Standardna baterija procjena",
      assessmentCycleIdLabel: formatAssessmentCycleIdLabel(
        input.snapshot.generatedFor.assessmentAssignmentId,
      ),
      assessmentCountLabel: formatAssessmentCountLabel(input.snapshot.source.sourceAttemptIds.length),
      testLabels: input.snapshot.source.testSlugs.map((slug) => getSourceTestLabel(slug)),
      generationModeLabel: getGenerationModeLabel(input.snapshot.metadata.provider),
      sourceAttemptCount: input.snapshot.source.sourceAttemptIds.length,
      generatedAt: input.snapshot.metadata.generatedAt,
      locale: input.snapshot.locale,
    },
    summary: {
      headline: sanitizeDisplayCopy(input.snapshot.summary.headline),
      profileOverview: sanitizeDisplayCopy(input.snapshot.summary.profileOverview),
      keyStrengths: input.snapshot.summary.keyStrengths.map((item) => sanitizeDisplayCopy(item)),
      watchouts: input.snapshot.summary.watchouts.map((item) => sanitizeDisplayCopy(item)),
    },
    integratedSignals: input.snapshot.integratedSignals.map((signal) => ({
      ...signal,
      title: sanitizeDisplayCopy(signal.title),
      body: sanitizeDisplayCopy(signal.body),
      evidence: signal.evidence.map((evidence) => ({
        ...evidence,
        label: sanitizeDisplayCopy(evidence.label),
        value: sanitizeDisplayCopy(evidence.value),
        displayTestLabel: getEvidenceTestLabel(evidence.testSlug),
      })),
    })),
    interviewGuidance: {
      focusAreas: input.snapshot.interviewGuidance.focusAreas.map((focusArea) => ({
        title: sanitizeDisplayCopy(focusArea.title),
        rationale: sanitizeDisplayCopy(focusArea.rationale),
        questions: focusArea.questions.map((question) => sanitizeDisplayCopy(question)),
      })),
    },
    onboardingGuidance: {
      managementTips: input.snapshot.onboardingGuidance.managementTips.map((tip) =>
        sanitizeDisplayCopy(tip),
      ),
      supportNeeds: input.snapshot.onboardingGuidance.supportNeeds.map((need) =>
        sanitizeDisplayCopy(need),
      ),
    },
    limitations: input.snapshot.limitations.map((item) => sanitizeDisplayCopy(item)),
  };
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("bs-BA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function CompositeHrReportView({ report, snapshot }: CompositeHrReportViewProps) {
  const model = buildCompositeHrReportViewModel({ report, snapshot });

  return (
    <div className="space-y-6 pb-12">
      <DashboardInfoCardShell className="rounded-[1.6rem] border-slate-200/80 p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <DashboardSectionHeader
              eyebrow="KOMPOZITNI HR IZVJEŠTAJ"
              eyebrowClassName="text-teal-800/90"
              title={model.title}
              description={model.description}
              className="gap-2"
              titleClassName="text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl"
              descriptionClassName="text-base text-slate-600"
            />
            <div className="flex flex-wrap gap-2.5">
              <DashboardStatusBadge tone="success" emphasized>
                {model.statusLabel}
              </DashboardStatusBadge>
              <DashboardStatusBadge>{model.source.locale.toUpperCase()}</DashboardStatusBadge>
            </div>
          </div>

          <Link
            className="inline-flex min-h-0 rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
            href={model.participantReportsHref}
          >
            Nazad na pregled kandidata
          </Link>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="OSNOVA IZVJEŠTAJA"
          eyebrowClassName="text-teal-800/80"
          title="Procjene uključene u izvještaj"
          description="Izvještaj je pripremljen na osnovu tri završene procjene iz istog procjenskog ciklusa."
          className="gap-2"
          titleClassName="text-[1.35rem]"
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Ciklus procjene
            </p>
            <p className="mt-2 text-[14px] font-semibold text-slate-950">
              {model.source.assessmentCycleLabel}
            </p>
            <p className="mt-1 break-all text-xs text-slate-500" title={model.source.assessmentAssignmentId}>
              {model.source.assessmentCycleIdLabel}
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Uključene procjene
            </p>
            <p className="mt-2 text-[14px] font-semibold text-slate-950">
              {model.source.assessmentCountLabel}
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Generisano
            </p>
            <p className="mt-2 text-[14px] font-semibold text-slate-950">
              {formatTimestamp(model.source.generatedAt)}
            </p>
          </div>
          {model.source.generationModeLabel ? (
            <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Način generisanja
              </p>
              <p className="mt-2 text-[14px] font-semibold text-slate-950">
                {model.source.generationModeLabel}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {model.source.testLabels.map((label) => (
            <span
              key={label}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600"
            >
              {label}
            </span>
          ))}
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Sažetak"
          eyebrowClassName="text-teal-800/80"
          title={model.summary.headline}
          description={model.summary.profileOverview}
          className="gap-2"
          titleClassName="text-[1.45rem]"
        />

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50/70 px-4 py-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-800">
              Ključne snage
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {model.summary.keyStrengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50/70 px-4 py-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-amber-800">
              Tačke opreza
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {model.summary.watchouts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Integrisani signali"
          eyebrowClassName="text-teal-800/80"
          title="Integrisana interpretacija"
          description="Signali su prikazani kao HR hipoteze za razgovor i provjeru kroz primjere ponašanja."
          className="gap-2"
          titleClassName="text-[1.35rem]"
        />

        <div className="mt-5 space-y-4">
          {model.integratedSignals.map((signal) => (
            <div
              key={signal.id}
              className="rounded-[1.25rem] border border-slate-200 bg-white/80 px-4 py-4"
            >
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                {signal.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{signal.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {signal.evidence.map((evidence) => (
                  <span
                    key={`${signal.id}-${evidence.testSlug}-${evidence.label}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700"
                  >
                    {evidence.displayTestLabel}: {evidence.label} - {evidence.value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DashboardInfoCardShell>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Intervju"
            eyebrowClassName="text-teal-800/80"
            title="Preporučene fokus teme"
            className="gap-2"
            titleClassName="text-[1.35rem]"
          />

          <div className="mt-5 space-y-4">
            {model.interviewGuidance.focusAreas.map((focusArea) => (
              <div
                key={focusArea.title}
                className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4"
              >
                <h3 className="text-base font-semibold text-slate-950">{focusArea.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{focusArea.rationale}</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  {focusArea.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Onboarding"
            eyebrowClassName="text-teal-800/80"
            title="Podrška i menadžerske smjernice"
            className="gap-2"
            titleClassName="text-[1.35rem]"
          />

          <div className="mt-5 grid gap-4">
            <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-700">
                Smjernice za menadžera
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {model.onboardingGuidance.managementTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-700">
                Potrebe za podrškom
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {model.onboardingGuidance.supportNeeds.map((need) => (
                  <li key={need}>{need}</li>
                ))}
              </ul>
            </div>
          </div>
        </DashboardInfoCardShell>
      </div>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Ograničenja"
          eyebrowClassName="text-slate-600"
          title="Napomene za čitanje izvještaja"
          description="Ove napomene ostaju sekundarne, ali su važne za pravilnu interpretaciju izvještaja."
          className="gap-2"
          titleClassName="text-[1.2rem]"
          descriptionClassName="text-sm text-slate-600"
        />

        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
          {model.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </DashboardInfoCardShell>
    </div>
  );
}
