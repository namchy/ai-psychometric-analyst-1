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
    sourceAttemptCount: number;
    generatedAt: string;
    locale: string;
    overviewDescription: string;
  };
  summary: CompositeHrReportSnapshot["summary"];
  structuredSummaryBlocks: Array<{
    label: "Glavni signal" | "Tačka opreza" | "Kako koristiti nalaz";
    body: string;
  }>;
  integratedSignals: Array<
    Omit<CompositeHrReportSnapshot["integratedSignals"][number], "evidence"> & {
      structuredBody: {
        primary: string | null;
        hrCheck: string | null;
      };
      evidenceGroups: Array<{
        label: string;
        items: Array<
          CompositeHrReportSnapshot["integratedSignals"][number]["evidence"][number] & {
            displayTestLabel: string;
          }
        >;
      }>;
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

const EVIDENCE_TEST_LABELS: Record<string, string> = {
  "ipip-neo-120-v1": "Ličnost",
  safran_v1: "Kognitivni rezultat",
  mwms_v1: "Motivacija",
};

const REPORT_COLORS = {
  bubblegumPink: "#ef476f",
  goldenPollen: "#ffd166",
  emerald: "#06d6a0",
  oceanBlue: "#118ab2",
  darkTeal: "#073b4c",
} as const;

function formatAssessmentCountLabel(count: number): string {
  return `${count} završene procjene`;
}

function formatAssessmentCycleIdLabel(value: string): string {
  if (value.length <= 10) {
    return `ID: ${value}`;
  }

  return `ID: ${value.slice(0, 8)}...`;
}

function getEvidenceTestLabel(slug: string): string {
  return EVIDENCE_TEST_LABELS[slug] ?? getAssessmentDisplayName({ slug });
}

function sanitizeLimitationCopy(value: string): string {
  return value
    .replace(/source attempts/gi, "izvorne procjene")
    .replace(/assessment ciklusa/gi, "ciklusa procjene")
    .replace(/score vrijednosti/gi, "rezultate procjena");
}

function sanitizeDisplayCopy(value: string): string {
  return sanitizeLimitationCopy(value).replace(/linked attemptova/gi, "povezanih procjena");
}

function splitIntoSummarySentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildStructuredSignalBody(body: string): {
  primary: string | null;
  hrCheck: string | null;
} {
  const sentences = splitIntoSummarySentences(body);

  if (sentences.length === 0) {
    return { primary: null, hrCheck: null };
  }

  if (sentences.length === 1) {
    return { primary: sentences[0], hrCheck: null };
  }

  return {
    primary: sentences[0],
    hrCheck: sentences.slice(1).join(" "),
  };
}

function buildEvidenceGroups(
  evidence: Array<
    CompositeHrReportSnapshot["integratedSignals"][number]["evidence"][number] & {
      displayTestLabel: string;
    }
  >,
): Array<{
  label: string;
  items: Array<
    CompositeHrReportSnapshot["integratedSignals"][number]["evidence"][number] & {
      displayTestLabel: string;
    }
  >;
}> {
  const groups = new Map<
    string,
    Array<
      CompositeHrReportSnapshot["integratedSignals"][number]["evidence"][number] & {
        displayTestLabel: string;
      }
    >
  >();

  evidence.forEach((item) => {
    const current = groups.get(item.displayTestLabel) ?? [];
    current.push(item);
    groups.set(item.displayTestLabel, current);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function buildStructuredSummaryBlocks(profileOverview: string): Array<{
  label: "Glavni signal" | "Tačka opreza" | "Kako koristiti nalaz";
  body: string;
}> {
  const sentences = splitIntoSummarySentences(profileOverview);

  if (sentences.length === 0) {
    return [];
  }

  if (sentences.length === 1) {
    return [{ label: "Glavni signal", body: sentences[0] }];
  }

  if (sentences.length === 2) {
    return [
      { label: "Glavni signal", body: sentences[0] },
      { label: "Tačka opreza", body: sentences[1] },
    ];
  }

  return [
    { label: "Glavni signal", body: sentences[0] },
    { label: "Tačka opreza", body: sentences[1] },
    { label: "Kako koristiti nalaz", body: sentences.slice(2).join(" ") },
  ];
}

export function buildCompositeHrReportViewModel(input: {
  report: AssessmentReportRecord;
  snapshot: CompositeHrReportSnapshot;
}): CompositeHrReportViewModel {
  return {
    title: "Kompozitni HR izvještaj",
    statusLabel: "Spremno za pregled",
    description:
      "Objedinjuje rezultate procjene ličnosti, kognitivne procjene i motivacije za rad u jedan HR pregled za intervju i onboarding.",
    participantReportsHref: `/dashboard/participants/${input.report.participant_id}/reports`,
    source: {
      assessmentAssignmentId: input.snapshot.generatedFor.assessmentAssignmentId,
      assessmentCycleLabel: "Standardna baterija procjena",
      assessmentCycleIdLabel: formatAssessmentCycleIdLabel(
        input.snapshot.generatedFor.assessmentAssignmentId,
      ),
      assessmentCountLabel: formatAssessmentCountLabel(input.snapshot.source.sourceAttemptIds.length),
      sourceAttemptCount: input.snapshot.source.sourceAttemptIds.length,
      generatedAt: input.snapshot.metadata.generatedAt,
      locale: input.snapshot.locale,
      overviewDescription:
        "Ovaj izvještaj povezuje rezultate procjene ličnosti, kognitivne procjene i motivacije za rad u jedan praktičan HR pregled.",
    },
    summary: {
      headline: sanitizeDisplayCopy(input.snapshot.summary.headline),
      profileOverview: sanitizeDisplayCopy(input.snapshot.summary.profileOverview),
      keyStrengths: input.snapshot.summary.keyStrengths.map((item) => sanitizeDisplayCopy(item)),
      watchouts: input.snapshot.summary.watchouts.map((item) => sanitizeDisplayCopy(item)),
    },
    structuredSummaryBlocks: buildStructuredSummaryBlocks(
      sanitizeDisplayCopy(input.snapshot.summary.profileOverview),
    ),
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
      structuredBody: buildStructuredSignalBody(sanitizeDisplayCopy(signal.body)),
      evidenceGroups: buildEvidenceGroups(
        signal.evidence.map((evidence) => ({
          ...evidence,
          label: sanitizeDisplayCopy(evidence.label),
          value: sanitizeDisplayCopy(evidence.value),
          displayTestLabel: getEvidenceTestLabel(evidence.testSlug),
        })),
      ),
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
              eyebrowClassName="text-[#073b4c]"
              title={model.title}
              description={model.description}
              className="gap-2"
              titleClassName="text-3xl font-extrabold tracking-[-0.05em] text-[#073b4c] sm:text-4xl"
              descriptionClassName="text-base text-slate-600"
            />
            <div className="flex flex-wrap gap-2.5">
              <DashboardStatusBadge tone="success" emphasized>
                {model.statusLabel}
              </DashboardStatusBadge>
              <DashboardStatusBadge className="border-[#118ab2]/20 bg-[#118ab2]/10 text-[#073b4c]">
                {model.source.locale.toUpperCase()}
              </DashboardStatusBadge>
            </div>
          </div>

          <Link
            className="inline-flex min-h-0 rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
            href={model.participantReportsHref}
          >
            Nazad na pregled kandidata
          </Link>
        </div>
        <div className="metadata-strip-grid mt-6 border-t border-slate-200/80 pt-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1 h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: REPORT_COLORS.darkTeal }}
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#073b4c]">
                Kratki pregled izvještaja
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/70 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Ciklus procjene
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-[#073b4c]">
                    {model.source.assessmentCycleLabel}
                  </p>
                  <p
                    className="mt-1 break-all text-xs text-slate-500"
                    title={model.source.assessmentAssignmentId}
                  >
                    {model.source.assessmentCycleIdLabel}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/70 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Obuhvat
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-[#073b4c]">
                    {model.source.assessmentCountLabel}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/70 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Datum izvještaja
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-[#073b4c]">
                    {formatTimestamp(model.source.generatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Sažetak"
          eyebrowClassName="text-[#073b4c]"
          title={model.summary.headline}
          description={undefined}
          className="gap-2"
          titleClassName="text-[1.45rem] text-[#073b4c]"
        />

        {model.structuredSummaryBlocks.length > 0 ? (
          <div className="mt-5">
            <div
              className={`grid gap-3 ${
                model.structuredSummaryBlocks.length >= 3
                  ? "lg:grid-cols-2"
                  : model.structuredSummaryBlocks.length === 2
                    ? "lg:grid-cols-2"
                    : ""
              }`}
            >
              {model.structuredSummaryBlocks.map((block, index) => (
                <div
                  key={`${block.label}-${index}`}
                  className={`summary-signal-block rounded-[1.1rem] border px-4 py-4 sm:px-5 ${
                    model.structuredSummaryBlocks.length >= 3 && index === 2
                      ? "lg:col-span-2"
                      : ""
                  }`}
                  style={
                    block.label === "Glavni signal"
                      ? {
                          borderColor: `${REPORT_COLORS.emerald}55`,
                          backgroundColor: `${REPORT_COLORS.emerald}14`,
                        }
                      : block.label === "Tačka opreza"
                        ? {
                            borderColor: `${REPORT_COLORS.goldenPollen}88`,
                            backgroundColor: `${REPORT_COLORS.goldenPollen}20`,
                          }
                        : {
                            borderColor: `${REPORT_COLORS.oceanBlue}55`,
                            backgroundColor: `${REPORT_COLORS.oceanBlue}12`,
                          }
                  }
                >
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{
                      color:
                        block.label === "Glavni signal"
                          ? REPORT_COLORS.darkTeal
                          : block.label === "Tačka opreza"
                            ? "#7a5600"
                            : REPORT_COLORS.oceanBlue,
                    }}
                  >
                    {block.label}
                  </p>
                  <p className="mt-2 max-w-[68ch] text-sm leading-6 text-slate-700">
                    {block.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div
            className="summary-strengths-block rounded-[1.1rem] border px-4 py-4 sm:px-5"
            style={{
              borderColor: `${REPORT_COLORS.emerald}55`,
              backgroundColor: `${REPORT_COLORS.emerald}12`,
            }}
          >
            <h3 className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: REPORT_COLORS.darkTeal }}>
              Ključne snage
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {model.summary.keyStrengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div
            className="summary-watchout-block rounded-[1.1rem] border px-4 py-4 sm:px-5"
            style={{
              borderColor: `${REPORT_COLORS.goldenPollen}88`,
              backgroundColor: `${REPORT_COLORS.goldenPollen}18`,
            }}
          >
            <h3 className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: "#7a5600" }}>
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

        <div className="mt-6 space-y-5">
          {model.integratedSignals.map((signal) => (
            <div
              key={signal.id}
              className="rounded-[1.35rem] border border-slate-200/90 bg-white px-5 py-5 shadow-[0_14px_34px_rgba(15,23,42,0.04)] sm:px-6 sm:py-6"
            >
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                {signal.title}
              </h3>

              <div
                className={`integrated-signal-interpretation-grid mt-4 grid gap-4 ${
                  signal.structuredBody.primary && signal.structuredBody.hrCheck
                    ? "lg:grid-cols-2"
                    : ""
                }`}
              >
                {signal.structuredBody.primary ? (
                  <div className="integrated-signal-meaning-card rounded-[1rem] border border-slate-200/90 bg-slate-50/80 px-4 py-4 sm:px-5 sm:py-[18px]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Šta ovo znači u radu
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {signal.structuredBody.primary}
                    </p>
                  </div>
                ) : null}

                {signal.structuredBody.hrCheck ? (
                  <div className="integrated-signal-verification-card rounded-[1rem] border border-slate-200/90 bg-slate-50/60 px-4 py-4 sm:px-5 sm:py-[18px]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Šta HR treba provjeriti
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {signal.structuredBody.hrCheck}
                    </p>
                  </div>
                ) : null}
              </div>

              {signal.evidenceGroups.length > 0 ? (
                <div className="integrated-signal-evidence-groups mt-4 rounded-[1rem] border border-slate-200/90 bg-slate-50/55 px-4 py-4 sm:px-5 sm:py-[18px]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Dokazi iz procjena
                  </p>
                  <div
                    className={`mt-3 grid gap-3 ${
                      signal.evidenceGroups.length >= 3
                        ? "lg:grid-cols-3"
                        : signal.evidenceGroups.length === 2
                          ? "md:grid-cols-2"
                          : ""
                    }`}
                  >
                    {signal.evidenceGroups.map((group) => (
                      <div
                        key={`${signal.id}-${group.label}`}
                        className="rounded-[0.95rem] border border-slate-200/80 bg-white/90 px-3.5 py-3"
                      >
                        <p className="text-xs font-semibold text-slate-700">{group.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.items.map((evidence) => (
                            <span
                              key={`${signal.id}-${group.label}-${evidence.label}`}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              {evidence.label}: {evidence.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
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
