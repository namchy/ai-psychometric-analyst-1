import {
  validateSafranHrReport,
  type SafranHrReportV1,
} from "@/lib/assessment/safran-hr-report-v1";

export type SafranHrReportDisplay = {
  header: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  executiveSummary: {
    title: string;
    summary: string;
  };
  cognitiveSignals: Array<{
    key: "overall" | "verbal" | "figural" | "numeric";
    label: string;
    body: string;
  }>;
  pointsOfCaution: Array<{
    signal: string;
    whyItMatters: string;
    howToCheck: string;
  }>;
  interviewQuestions: Array<{
    category: string;
    question: string;
    whatToListenFor: string;
  }>;
  onboardingGuidance: Array<{
    key: "first30Days" | "days60" | "days90";
    label: string;
    items: string[];
  }>;
  interpretationLimits: string[];
};

function normalizeNonEmptyString(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function nonEmptyList(values: readonly string[] | null | undefined): string[] {
  return Array.isArray(values)
    ? values.map((value) => normalizeNonEmptyString(value)).filter(Boolean)
    : [];
}

export function buildSafranHrReportDisplay(
  report: SafranHrReportV1,
): SafranHrReportDisplay {
  return {
    header: {
      eyebrow: "HR report",
      title: "SAFRAN HR izvještaj",
      subtitle:
        "Ovaj izvještaj je namijenjen HR-u i daje opreznu interpretaciju signala iz SAFRAN testa.",
    },
    executiveSummary: {
      title: report.executiveSummary.title,
      summary: normalizeNonEmptyString(report.executiveSummary.summary),
    },
    cognitiveSignals: [
      {
        key: "overall",
        label: "Ukupni signal",
        body: normalizeNonEmptyString(report.cognitiveSignals.overall),
      },
      {
        key: "verbal",
        label: "Verbalni signal",
        body: normalizeNonEmptyString(report.cognitiveSignals.verbal),
      },
      {
        key: "figural",
        label: "Figuralni signal",
        body: normalizeNonEmptyString(report.cognitiveSignals.figural),
      },
      {
        key: "numeric",
        label: "Numerički signal",
        body: normalizeNonEmptyString(report.cognitiveSignals.numeric),
      },
    ],
    pointsOfCaution: report.pointsOfCaution.map((item) => ({
      signal: normalizeNonEmptyString(item.signal),
      whyItMatters: normalizeNonEmptyString(item.whyItMatters),
      howToCheck: normalizeNonEmptyString(item.howToCheck),
    })),
    interviewQuestions: report.interviewQuestions.map((item) => ({
      category: normalizeNonEmptyString(item.category),
      question: normalizeNonEmptyString(item.question),
      whatToListenFor: normalizeNonEmptyString(item.whatToListenFor),
    })),
    onboardingGuidance: [
      {
        key: "first30Days",
        label: "Prvih 30 dana",
        items: nonEmptyList(report.onboardingGuidance.first30Days),
      },
      {
        key: "days60",
        label: "60 dana",
        items: nonEmptyList(report.onboardingGuidance.days60),
      },
      {
        key: "days90",
        label: "90 dana",
        items: nonEmptyList(report.onboardingGuidance.days90),
      },
    ],
    interpretationLimits: nonEmptyList(report.interpretationLimits),
  };
}

export function resolveSafranHrReportDisplay(
  report: unknown,
): SafranHrReportDisplay | null {
  const validation = validateSafranHrReport(report);

  if (!validation.ok) {
    return null;
  }

  return buildSafranHrReportDisplay(validation.value);
}
