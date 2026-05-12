import Link from "next/link";
import type { AssessmentReportRecord } from "@/lib/assessment/assessment-reports";
import type { CompositeHrReportSnapshot } from "@/lib/assessment/composite-hr-report-contract";
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
  participantReportsHref: string;
  source: {
    assessmentAssignmentId: string;
    testSlugs: string[];
    sourceAttemptCount: number;
    provider: string;
    providerVersion: string;
    generatedAt: string;
    locale: string;
  };
  summary: CompositeHrReportSnapshot["summary"];
  integratedSignals: CompositeHrReportSnapshot["integratedSignals"];
  interviewGuidance: CompositeHrReportSnapshot["interviewGuidance"];
  onboardingGuidance: CompositeHrReportSnapshot["onboardingGuidance"];
  limitations: CompositeHrReportSnapshot["limitations"];
};

export function buildCompositeHrReportViewModel(input: {
  report: AssessmentReportRecord;
  snapshot: CompositeHrReportSnapshot;
}): CompositeHrReportViewModel {
  return {
    title: "Kompozitni HR izvještaj",
    statusLabel: "Spremno za pregled",
    participantReportsHref: `/dashboard/participants/${input.report.participant_id}/reports`,
    source: {
      assessmentAssignmentId: input.snapshot.generatedFor.assessmentAssignmentId,
      testSlugs: [...input.snapshot.source.testSlugs],
      sourceAttemptCount: input.snapshot.source.sourceAttemptIds.length,
      provider: input.snapshot.metadata.provider,
      providerVersion: input.snapshot.metadata.providerVersion,
      generatedAt: input.snapshot.metadata.generatedAt,
      locale: input.snapshot.locale,
    },
    summary: input.snapshot.summary,
    integratedSignals: input.snapshot.integratedSignals,
    interviewGuidance: input.snapshot.interviewGuidance,
    onboardingGuidance: input.snapshot.onboardingGuidance,
    limitations: input.snapshot.limitations,
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
              eyebrow="ASSESSMENT-LEVEL HR REPORT"
              eyebrowClassName="text-teal-800/90"
              title={model.title}
              description="Prikaz se zasniva na gotovom report snapshotu i ne generiše novi sadržaj."
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
          eyebrow="Izvor procjene"
          eyebrowClassName="text-teal-800/80"
          title="Izvor i trag podataka"
          description="Diskretan pregled izvora i generator metadata za ovaj snapshot."
          className="gap-2"
          titleClassName="text-[1.35rem]"
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Procjenski ciklus
            </p>
            <p className="mt-2 break-all text-[14px] font-semibold text-slate-950">
              {model.source.assessmentAssignmentId}
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Izvori
            </p>
            <p className="mt-2 text-[14px] font-semibold text-slate-950">
              {model.source.sourceAttemptCount} linked attemptova
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Provider
            </p>
            <p className="mt-2 text-[14px] font-semibold text-slate-950">
              {model.source.provider} / {model.source.providerVersion}
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
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {model.source.testSlugs.map((slug) => (
            <span
              key={slug}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600"
            >
              {slug}
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
                    {evidence.testSlug}: {evidence.label} - {evidence.value}
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
          description="Ove napomene ostaju sekundarne, ali su važne za pravilnu interpretaciju snapshot-a."
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
