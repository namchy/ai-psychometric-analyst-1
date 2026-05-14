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

const SIGNAL_MODULE_STYLES = {
  meaning: {
    accentColor: REPORT_COLORS.emerald,
    borderColor: `${REPORT_COLORS.emerald}24`,
    backgroundColor: `${REPORT_COLORS.emerald}09`,
    headingColor: REPORT_COLORS.darkTeal,
    headerBackground: `${REPORT_COLORS.emerald}26`,
    capsuleBackground: `${REPORT_COLORS.emerald}20`,
  },
  verification: {
    accentColor: REPORT_COLORS.goldenPollen,
    borderColor: `${REPORT_COLORS.goldenPollen}30`,
    backgroundColor: `${REPORT_COLORS.goldenPollen}0a`,
    headingColor: REPORT_COLORS.darkTeal,
    headerBackground: `${REPORT_COLORS.goldenPollen}30`,
    capsuleBackground: `${REPORT_COLORS.goldenPollen}24`,
  },
  evidence: {
    accentColor: REPORT_COLORS.oceanBlue,
    borderColor: `${REPORT_COLORS.oceanBlue}28`,
    backgroundColor: `${REPORT_COLORS.oceanBlue}0a`,
    headingColor: REPORT_COLORS.darkTeal,
    headerBackground: `${REPORT_COLORS.oceanBlue}26`,
    capsuleBackground: `${REPORT_COLORS.oceanBlue}20`,
  },
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
      accentColor: REPORT_COLORS.oceanBlue,
      borderColor: `${REPORT_COLORS.oceanBlue}28`,
      backgroundColor: "rgba(255, 255, 255, 0.96)",
      headingColor: REPORT_COLORS.darkTeal,
      headerBackground: `${REPORT_COLORS.oceanBlue}24`,
      capsuleBackground: `${REPORT_COLORS.oceanBlue}1a`,
    };
  }

  if (label === "Fokus za provjeru") {
    return {
      accentColor: REPORT_COLORS.goldenPollen,
      borderColor: `${REPORT_COLORS.goldenPollen}28`,
      backgroundColor: "rgba(255, 255, 255, 0.96)",
      headingColor: REPORT_COLORS.darkTeal,
      headerBackground: `${REPORT_COLORS.goldenPollen}28`,
      capsuleBackground: `${REPORT_COLORS.goldenPollen}20`,
    };
  }

  return {
    accentColor: REPORT_COLORS.darkTeal,
    borderColor: `${REPORT_COLORS.darkTeal}24`,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    headingColor: REPORT_COLORS.darkTeal,
    headerBackground: `${REPORT_COLORS.darkTeal}16`,
    capsuleBackground: `${REPORT_COLORS.darkTeal}14`,
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

function splitEvidenceValue(value: string): { primary: string; detail: string | null } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?)\s+(\([^)]+\))$/u);

  if (!match) {
    return { primary: trimmed, detail: null };
  }

  return {
    primary: match[1].trim(),
    detail: match[2].trim(),
  };
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
        <div className="summary-executive-dashboard rounded-[1.35rem] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.99),rgba(248,250,252,0.97)_58%,rgba(241,245,249,0.95))] px-4 py-4 shadow-[0_18px_34px_rgba(15,23,42,0.045)] sm:px-5 sm:py-5">
          <DashboardSectionHeader
            eyebrow="Sažetak"
            eyebrowClassName="text-[#073b4c]"
            title={model.summary.headline}
            description={undefined}
            className="gap-2.5"
            titleClassName="max-w-3xl text-[1.48rem] font-semibold leading-tight tracking-[-0.03em] text-[#073b4c]"
          />

          <div className="mt-4 grid gap-3.5 lg:grid-cols-2">
            <div
              className="summary-strengths-block rounded-[1.1rem] border bg-white px-4 py-4 shadow-[0_12px_24px_rgba(15,23,42,0.045)] sm:px-5"
              style={{
                borderColor: `${REPORT_COLORS.emerald}38`,
                boxShadow: "0 12px 24px rgba(15,23,42,0.045)",
              }}
            >
              <div
                className="rounded-[0.95rem] px-3.5 py-3"
                style={{ backgroundColor: `${REPORT_COLORS.emerald}28` }}
              >
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{
                    backgroundColor: `${REPORT_COLORS.emerald}22`,
                    color: REPORT_COLORS.darkTeal,
                  }}
                >
                  Ključne snage
                </span>
              </div>
              <ul className="mt-3 space-y-2.5 text-sm leading-6 text-slate-800">
                {model.summary.keyStrengths.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 flex-none rounded-full"
                      style={{ backgroundColor: REPORT_COLORS.emerald }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {["Fokus za provjeru", "Glavni signal", "Kako koristiti nalaz"].flatMap((orderedLabel) =>
              model.structuredSummaryBlocks
                .filter((block) => block.label === orderedLabel)
                .map((block, index) => {
                  const blockStyle = getSummaryBlockStyle(block.label);

                  return (
                    <div
                      key={`${orderedLabel}-${index}`}
                      className="summary-signal-block rounded-[1.1rem] border px-4 py-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)] sm:px-5"
                      style={{
                        borderColor: blockStyle.borderColor,
                        backgroundColor: blockStyle.backgroundColor,
                        boxShadow: "0 10px 22px rgba(15,23,42,0.04)",
                      }}
                    >
                      <div
                        className="rounded-[0.95rem] px-3.5 py-3"
                        style={{ backgroundColor: blockStyle.headerBackground }}
                      >
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                          style={{
                            backgroundColor: blockStyle.capsuleBackground,
                            color: blockStyle.headingColor,
                          }}
                        >
                          {block.label}
                        </span>
                      </div>
                      <p className="mt-3 max-w-[68ch] text-sm leading-6 text-slate-800">
                        {block.body}
                      </p>
                    </div>
                  );
                }),
            )}
          </div>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          title="Integrisani signali"
          description="Radni signali povezani iz ličnosti, motivacije i kognitivnog rezultata."
          className="gap-2"
          titleClassName="text-[1.55rem] font-semibold tracking-[-0.035em] text-[#073b4c]"
          descriptionClassName="max-w-2xl text-sm leading-6 text-slate-600 sm:text-[0.95rem]"
        />

        <div className="mt-6 space-y-5 sm:space-y-6">
          {model.integratedSignals.map((signal, index) => (
            <div
              key={signal.id}
              className="integrated-signal-module rounded-[1.35rem] border border-slate-200/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.99),rgba(244,248,251,0.98)_54%,rgba(241,247,250,0.96))] px-4 py-4 shadow-[0_22px_42px_rgba(15,23,42,0.065)] sm:px-6 sm:py-6"
            >
              <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <span className="inline-flex w-fit rounded-full border border-[#118ab2]/22 bg-[#073b4c]/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#073b4c]">
                    Signal {index + 1}
                  </span>
                  <h3 className="max-w-4xl text-[1.26rem] font-extrabold leading-tight tracking-[-0.04em] text-[#073b4c] sm:text-[1.44rem]">
                    {signal.title}
                  </h3>
                </div>
              </div>

              <div className="integrated-signal-insight-grid mt-4 grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,1.08fr)]">
                {signal.structuredBody.primary ? (
                  <div
                    className="integrated-signal-meaning-panel rounded-[1rem] border bg-white px-3.5 py-3.5 shadow-[0_10px_20px_rgba(15,23,42,0.035)] sm:px-4 sm:py-4"
                    style={{
                      borderColor: SIGNAL_MODULE_STYLES.meaning.borderColor,
                      backgroundColor: SIGNAL_MODULE_STYLES.meaning.backgroundColor,
                      boxShadow: "0 10px 20px rgba(15,23,42,0.035)",
                    }}
                  >
                    <div
                      className="rounded-[0.9rem] px-3 py-2.5"
                      style={{ backgroundColor: SIGNAL_MODULE_STYLES.meaning.headerBackground }}
                    >
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                        style={{
                          backgroundColor: SIGNAL_MODULE_STYLES.meaning.capsuleBackground,
                          color: SIGNAL_MODULE_STYLES.meaning.headingColor,
                        }}
                      >
                        ŠTA ZNAČI U RADU
                      </span>
                    </div>
                    <p className="mt-2.5 text-[0.95rem] leading-7 text-slate-800">
                      {signal.structuredBody.primary}
                    </p>
                  </div>
                ) : null}

                <div
                  className="integrated-signal-verification-panel rounded-[1rem] border bg-white px-3.5 py-3.5 shadow-[0_10px_20px_rgba(15,23,42,0.035)] sm:px-4 sm:py-4"
                  style={{
                    borderColor: SIGNAL_MODULE_STYLES.verification.borderColor,
                    backgroundColor: SIGNAL_MODULE_STYLES.verification.backgroundColor,
                    boxShadow: "0 10px 20px rgba(15,23,42,0.035)",
                  }}
                >
                  <div
                    className="rounded-[0.9rem] px-3 py-2.5"
                    style={{ backgroundColor: SIGNAL_MODULE_STYLES.verification.headerBackground }}
                  >
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                      style={{
                        backgroundColor: SIGNAL_MODULE_STYLES.verification.capsuleBackground,
                        color: SIGNAL_MODULE_STYLES.verification.headingColor,
                      }}
                    >
                      ŠTA HR TREBA PROVJERITI
                    </span>
                  </div>
                  <p className="mt-2.5 text-[0.95rem] leading-7 text-slate-800">
                    {signal.structuredBody.hrCheck ?? signal.structuredBody.primary ?? signal.body}
                  </p>
                </div>

                {signal.evidenceGroups.length > 0 ? (
                  <div
                    className="integrated-signal-evidence-panel rounded-[1rem] border bg-white px-3.5 py-3.5 shadow-[0_10px_20px_rgba(15,23,42,0.035)] sm:px-4 sm:py-4"
                    style={{
                      borderColor: SIGNAL_MODULE_STYLES.evidence.borderColor,
                      backgroundColor: SIGNAL_MODULE_STYLES.evidence.backgroundColor,
                      boxShadow: "0 10px 20px rgba(15,23,42,0.035)",
                    }}
                  >
                    <div
                      className="rounded-[0.9rem] px-3 py-2.5"
                      style={{ backgroundColor: SIGNAL_MODULE_STYLES.evidence.headerBackground }}
                    >
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                        style={{
                          backgroundColor: SIGNAL_MODULE_STYLES.evidence.capsuleBackground,
                          color: SIGNAL_MODULE_STYLES.evidence.headingColor,
                        }}
                      >
                        DOKAZI IZ PROCJENA
                      </span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {signal.evidenceGroups.map((group) => {
                        const groupStyle = getEvidenceGroupStyle(group.label);

                        return (
                          <div
                            key={`${signal.id}-${group.label}`}
                            className="integrated-signal-evidence-group rounded-[0.9rem] border px-3 py-3"
                            style={{
                              borderColor: groupStyle.borderColor,
                              backgroundColor: groupStyle.backgroundColor,
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: groupStyle.accentColor }}
                              />
                              <p
                                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                                style={{ color: REPORT_COLORS.darkTeal }}
                              >
                                {group.label}
                              </p>
                            </div>
                            <div className="mt-2.5 space-y-2">
                              {group.items.map((evidence, evidenceIndex) => {
                                const valueParts = splitEvidenceValue(evidence.value);

                                return (
                                  <div
                                    key={`${signal.id}-${group.label}-${evidence.label}`}
                                    className="integrated-signal-evidence-row grid gap-1 rounded-[0.75rem] border px-2.5 py-2.5 text-xs leading-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                                    style={{
                                      borderColor: `${groupStyle.accentColor}1f`,
                                      backgroundColor: "rgba(255,255,255,0.86)",
                                      boxShadow:
                                        evidenceIndex === 0
                                          ? "0 1px 0 rgba(255,255,255,0.8)"
                                          : undefined,
                                    }}
                                  >
                                    <span className="min-w-0 font-medium text-slate-600">
                                      {evidence.label}
                                    </span>
                                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-semibold text-[#073b4c] sm:justify-end sm:text-right">
                                      <span
                                        className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-[#073b4c]"
                                        style={{ backgroundColor: `${REPORT_COLORS.oceanBlue}16` }}
                                      >
                                        {valueParts.primary}
                                      </span>
                                      {valueParts.detail ? (
                                        <span className="text-[11px] font-medium text-slate-500">
                                          {valueParts.detail}
                                        </span>
                                      ) : null}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    className="integrated-signal-evidence-panel rounded-[1rem] border bg-white px-3.5 py-3.5 shadow-[0_10px_20px_rgba(15,23,42,0.035)] sm:px-4 sm:py-4"
                    style={{
                      borderColor: SIGNAL_MODULE_STYLES.evidence.borderColor,
                      backgroundColor: SIGNAL_MODULE_STYLES.evidence.backgroundColor,
                      boxShadow: "0 10px 20px rgba(15,23,42,0.035)",
                    }}
                  >
                    <div
                      className="rounded-[0.9rem] px-3 py-2.5"
                      style={{ backgroundColor: SIGNAL_MODULE_STYLES.evidence.headerBackground }}
                    >
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                        style={{
                          backgroundColor: SIGNAL_MODULE_STYLES.evidence.capsuleBackground,
                          color: SIGNAL_MODULE_STYLES.evidence.headingColor,
                        }}
                      >
                        DOKAZI IZ PROCJENA
                      </span>
                    </div>
                  </div>
                )}
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
