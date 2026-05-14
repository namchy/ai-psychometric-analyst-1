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
    label: "Glavni signal" | "Fokus za provjeru" | "Kako koristiti nalaz";
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

const EVIDENCE_GROUP_STYLES: Record<
  string,
  {
    accentColor: string;
    borderColor: string;
    backgroundColor: string;
  }
> = {
  Ličnost: {
    accentColor: REPORT_COLORS.darkTeal,
    borderColor: `${REPORT_COLORS.darkTeal}18`,
    backgroundColor: `${REPORT_COLORS.darkTeal}05`,
  },
  "Kognitivni rezultat": {
    accentColor: REPORT_COLORS.oceanBlue,
    borderColor: `${REPORT_COLORS.oceanBlue}18`,
    backgroundColor: `${REPORT_COLORS.oceanBlue}06`,
  },
  Motivacija: {
    accentColor: REPORT_COLORS.emerald,
    borderColor: `${REPORT_COLORS.emerald}18`,
    backgroundColor: `${REPORT_COLORS.emerald}06`,
  },
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

function getEvidenceTestLabel(slug: string): string {
  return EVIDENCE_TEST_LABELS[slug] ?? getAssessmentDisplayName({ slug });
}

function sanitizeLimitationCopy(value: string): string {
  return value
    .replace(/source attempts/gi, "izvorne procjene")
    .replace(/assessment ciklusa/gi, "ciklusa procjene")
    .replace(/score vrijednosti/gi, "rezultate procjena");
}

function mapAgreeablenessDisplayLabel(value: string, variant: "long" | "short" = "long"): string {
  const replacement = variant === "short" ? "Saradljivost" : "Spremnost na saradnju";

  return value
    .replace(/\bUgodnost\b/gi, replacement)
    .replace(/\bAGREEABLENESS\b/g, replacement);
}

function sanitizeDisplayCopy(value: string): string {
  return mapAgreeablenessDisplayLabel(
    sanitizeLimitationCopy(value).replace(/linked attemptova/gi, "povezanih procjena"),
  );
}

function sanitizeEvidenceLabel(value: string): string {
  return mapAgreeablenessDisplayLabel(
    sanitizeLimitationCopy(value).replace(/linked attemptova/gi, "povezanih procjena"),
    "short",
  );
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

function pickSummaryVerificationFocus(profileOverviewSentences: string[], watchouts: string[]): string | null {
  const watchout =
    watchouts.find((item) => /\bprovjer/i.test(item)) ??
    watchouts[0] ??
    profileOverviewSentences[1] ??
    null;

  return watchout ? splitIntoSummarySentences(watchout)[0] ?? watchout : null;
}

function buildStructuredSummaryBlocks(profileOverview: string, watchouts: string[]): Array<{
  label: "Glavni signal" | "Fokus za provjeru" | "Kako koristiti nalaz";
  body: string;
}> {
  const sentences = splitIntoSummarySentences(profileOverview);

  if (sentences.length === 0) {
    return [];
  }

  const verificationFocus = pickSummaryVerificationFocus(sentences, watchouts);
  const usageGuidance =
    watchouts.length > 0 ? sentences.slice(1).join(" ") : sentences.slice(2).join(" ");
  const blocks: Array<{
    label: "Glavni signal" | "Fokus za provjeru" | "Kako koristiti nalaz";
    body: string;
  }> = [{ label: "Glavni signal", body: sentences[0] }];

  if (verificationFocus) {
    blocks.push({ label: "Fokus za provjeru", body: verificationFocus });
  }

  if (usageGuidance) {
    blocks.push({ label: "Kako koristiti nalaz", body: usageGuidance });
  }

  return blocks;
}

function getSummaryBlockStyle(label: "Glavni signal" | "Fokus za provjeru" | "Kako koristiti nalaz") {
  if (label === "Glavni signal") {
    return {
      borderColor: `${REPORT_COLORS.emerald}55`,
      backgroundColor: `${REPORT_COLORS.emerald}14`,
      headingColor: REPORT_COLORS.darkTeal,
    };
  }

  if (label === "Fokus za provjeru") {
    return {
      borderColor: `${REPORT_COLORS.oceanBlue}36`,
      backgroundColor: `${REPORT_COLORS.oceanBlue}08`,
      headingColor: REPORT_COLORS.oceanBlue,
    };
  }

  return {
    borderColor: `${REPORT_COLORS.darkTeal}22`,
    backgroundColor: `${REPORT_COLORS.darkTeal}05`,
    headingColor: REPORT_COLORS.darkTeal,
  };
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
      input.snapshot.summary.watchouts.map((item) => sanitizeDisplayCopy(item)),
    ),
    integratedSignals: input.snapshot.integratedSignals.map((signal) => ({
      ...signal,
      title: sanitizeDisplayCopy(signal.title),
      body: sanitizeDisplayCopy(signal.body),
      evidence: signal.evidence.map((evidence) => ({
        ...evidence,
        label: sanitizeEvidenceLabel(evidence.label),
        value: sanitizeDisplayCopy(evidence.value),
        displayTestLabel: getEvidenceTestLabel(evidence.testSlug),
      })),
      structuredBody: buildStructuredSignalBody(sanitizeDisplayCopy(signal.body)),
      evidenceGroups: buildEvidenceGroups(
        signal.evidence.map((evidence) => ({
          ...evidence,
          label: sanitizeEvidenceLabel(evidence.label),
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

function getEvidenceGroupStyle(label: string) {
  return (
    EVIDENCE_GROUP_STYLES[label] ?? {
      accentColor: REPORT_COLORS.darkTeal,
      borderColor: "rgba(148, 163, 184, 0.25)",
      backgroundColor: "rgba(248, 250, 252, 0.95)",
    }
  );
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

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {model.structuredSummaryBlocks.map((block, index) => {
            const blockStyle = getSummaryBlockStyle(block.label);

            return (
              <div
                key={`${block.label}-${index}`}
                className="summary-signal-block rounded-[1.1rem] border px-4 py-4 sm:px-5"
                style={{
                  borderColor: blockStyle.borderColor,
                  backgroundColor: blockStyle.backgroundColor,
                }}
              >
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: blockStyle.headingColor }}
                >
                  {block.label}
                </p>
                <p className="mt-2 max-w-[68ch] text-sm leading-6 text-slate-700">{block.body}</p>
              </div>
            );
          })}

          <div
            className="summary-strengths-block rounded-[1.1rem] border px-4 py-4 sm:px-5"
            style={{
              borderColor: `${REPORT_COLORS.emerald}44`,
              backgroundColor: `${REPORT_COLORS.emerald}08`,
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
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="INTEGRISANI SIGNALI"
          eyebrowClassName="text-[#073b4c]"
          title="Integrisana interpretacija"
          description="Signali su prikazani kao HR hipoteze za razgovor i provjeru kroz primjere ponašanja."
          className="gap-2"
          titleClassName="text-[1.45rem] font-semibold tracking-[-0.03em] text-[#073b4c]"
          descriptionClassName="max-w-3xl text-sm leading-6 text-slate-600 sm:text-[0.95rem]"
        />

        <div className="mt-6 space-y-5 sm:space-y-6">
          {model.integratedSignals.map((signal, index) => (
            <div
              key={signal.id}
              className="integrated-signal-module rounded-[1.35rem] border border-slate-200/90 bg-white px-4 py-4 sm:px-6 sm:py-6"
            >
              <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#118ab2]">
                    Signal {index + 1}
                  </p>
                  <h3 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-[#073b4c] sm:text-[1.15rem]">
                    {signal.title}
                  </h3>
                </div>
              </div>

              <div
                className={`integrated-signal-insight-grid mt-4 grid items-start gap-2.5 sm:gap-3 ${
                  signal.structuredBody.primary && signal.structuredBody.hrCheck
                    ? "lg:grid-cols-2"
                    : ""
                }`}
              >
                {signal.structuredBody.primary ? (
                  <div
                    className="integrated-signal-meaning-panel rounded-[0.95rem] border border-slate-200/70 px-3.5 py-3 sm:px-4 sm:py-3.5"
                    style={{
                      backgroundColor: `${REPORT_COLORS.darkTeal}04`,
                    }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      ŠTA ZNAČI U RADU
                    </p>
                    <p className="mt-2 text-[0.93rem] leading-[1.58] text-slate-700">
                      {signal.structuredBody.primary}
                    </p>
                  </div>
                ) : null}

                {signal.structuredBody.hrCheck ? (
                  <div
                    className="integrated-signal-verification-panel rounded-[0.95rem] border border-slate-200/70 px-3.5 py-3 sm:px-4 sm:py-3.5"
                    style={{
                      backgroundColor: `${REPORT_COLORS.oceanBlue}04`,
                    }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      ŠTA HR TREBA PROVJERITI
                    </p>
                    <p className="mt-2 text-[0.93rem] leading-[1.58] text-slate-700">
                      {signal.structuredBody.hrCheck}
                    </p>
                  </div>
                ) : null}
              </div>

              {signal.evidenceGroups.length > 0 ? (
                <div className="integrated-signal-evidence-bar mt-3.5 border-t border-slate-200/70 pt-3 sm:mt-4 sm:pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    DOKAZI IZ PROCJENA
                  </p>
                  <div
                    className={`mt-2.5 grid gap-2 ${
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
                        className="integrated-signal-evidence-group rounded-[0.9rem] border px-3 py-2.5"
                        style={getEvidenceGroupStyle(group.label)}
                      >
                        <p
                          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                          style={{ color: getEvidenceGroupStyle(group.label).accentColor }}
                        >
                          {group.label}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {group.items.map((evidence) => (
                            <span
                              key={`${signal.id}-${group.label}-${evidence.label}`}
                              className="rounded-full border border-white/60 bg-white/80 px-2.5 py-1 text-[11px] font-medium leading-4 text-slate-600"
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
