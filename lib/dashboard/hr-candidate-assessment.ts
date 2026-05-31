import { getReportGenerationCapability } from "@/lib/assessment/report-capabilities";
import type {
  ActiveStandardAssessmentAssignment,
  AssessmentReportRecord,
  CompositeReadinessState,
} from "@/lib/assessment/assessment-reports";

export type HrCandidateAssessmentAttemptLifecycle =
  | "completed"
  | "in_progress"
  | "not_started"
  | "abandoned"
  | "unknown";

export type HrCandidateAssessmentAttemptStatus =
  | "in_progress"
  | "completed"
  | "abandoned";

export type HrCandidateAssessmentReportStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "unavailable";

export type HrCandidateAssessmentParticipant = {
  id: string;
  organization_id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  participant_type: "employee" | "candidate";
  status: "active" | "inactive";
  created_at: string;
};

export type HrCandidateAssessmentAttempt = {
  id: string;
  test_id: string;
  locale: string;
  user_id: string | null;
  organization_id: string | null;
  participant_id: string | null;
  status: HrCandidateAssessmentAttemptStatus;
  started_at: string;
  scored_started_at: string | null;
  completed_at: string | null;
  responseCount: number;
  lifecycle: HrCandidateAssessmentAttemptLifecycle;
  tests: {
    slug: string;
    name: string;
  } | null;
  participants: {
    id: string;
    organization_id: string;
    full_name: string;
    email: string;
  } | null;
  organizations: {
    name: string;
    slug: string;
  } | null;
};

export type HrCandidateAssessmentTestSlug =
  | "ipip-neo-120-v1"
  | "safran_v1"
  | "mwms_v1";

export type HrCandidateAssessmentCardState =
  | "ready"
  | "queued"
  | "processing"
  | "failed"
  | "unsupported"
  | "unavailable"
  | "in_progress"
  | "not_started"
  | "abandoned"
  | "not_assigned"
  | "completed_without_report";

export type HrCandidateAssessmentCardVisualVariant =
  | "success"
  | "progress"
  | "error"
  | "info";

export type HrCandidateCompositeCardState =
  | "no_assignment"
  | "incomplete"
  | "ready_to_generate"
  | "queued"
  | "processing"
  | "ready"
  | "failed";

export type HrFriendlyTestStatus =
  | "Završeno"
  | "U toku"
  | "Čeka"
  | "Nije dodijeljeno"
  | "Arhivirano"
  | "Greška";

export type AssessmentAggregateStatus =
  | "Čeka kandidata"
  | "U toku"
  | "Djelimično završeno"
  | "Spremno za pregled"
  | "Traži pažnju";

export type HrCandidateAttemptReportSummary = {
  id: string;
  attempt_id: string;
  test_slug: string;
  audience: "participant" | "hr";
  report_type: string;
  source_type: string;
  report_status: HrCandidateAssessmentReportStatus;
  generated_at: string;
  completed_at: string | null;
  failure_code: string | null;
  failure_reason: string | null;
};

export type HrCandidateAssessmentCard = {
  slug: HrCandidateAssessmentTestSlug;
  title: "IPIP-NEO-120" | "SAFRAN" | "MWMS";
  subtitle: string;
  state: HrCandidateAssessmentCardState;
  statusLabel:
    | "Dostupno"
    | "Čeka generisanje"
    | "Generiše se"
    | "Greška pri generisanju"
    | "Još nije podržano"
    | "Nije dostupno"
    | "U toku"
    | "Čeka kandidata"
    | "Prekinuto"
    | "Nije dodijeljeno"
    | "Nije generisano";
  body: string;
  visualVariant: HrCandidateAssessmentCardVisualVariant;
  action:
    | {
        label: "Generiši HR izvještaj" | "Ponovo generiši";
        kind: "generate" | "retry";
        enabled: true;
      }
    | {
        label: null;
        kind: null;
        enabled: false;
        reason: string | null;
      };
  attempt: HrCandidateAssessmentAttempt | null;
  report: HrCandidateAttemptReportSummary | null;
  cta:
    | {
        label: "Otvori HR izvještaj";
        href: string;
        disabled: false;
      }
    | {
        label: "Čeka generisanje" | "Generiše se" | "Nije dostupno";
        href: null;
        disabled: true;
      };
};

export type HrCandidateCompositeCard = {
  title: "Kompozitni HR izvještaj";
  subtitle: "Integrisani profil kandidata";
  state: HrCandidateCompositeCardState;
  statusLabel:
    | "Nije dostupno"
    | "Nije spremno"
    | "Spremno za generisanje"
    | "Čeka generisanje"
    | "Generiše se"
    | "Spremno za pregled"
    | "Greška pri generisanju";
  body: string;
  visualVariant: HrCandidateAssessmentCardVisualVariant;
  cta:
    | {
        label: string;
        href: string;
        disabled: false;
        action: null;
      }
    | {
        label: string;
        href: null;
        disabled: false;
        action: "generate_composite" | "retry_composite";
      }
    | {
        label: string;
        href: null;
        disabled: true;
        action: null;
      };
  assignment: ActiveStandardAssessmentAssignment | null;
  readiness: CompositeReadinessState | null;
  report: AssessmentReportRecord | null;
};

export type ParticipantAssessmentRow = {
  participant: HrCandidateAssessmentParticipant;
  totalTests: number;
  completedTests: number;
  hasOpenAssessment: boolean;
  aggregateStatus: AssessmentAggregateStatus;
  primaryAction:
    | {
        kind: "create";
        label: "Dodijeli procjenu";
      }
    | {
        kind: "info";
        label: "Čeka kandidata" | "Traži pažnju";
        note: string;
      }
    | {
        kind: "link";
        label: "Pregled procjena";
        href: string;
      };
  testItems: Array<{
    key: string;
    shortLabel: string;
    status: HrFriendlyTestStatus;
  }>;
};

export const HR_CANDIDATE_ASSESSMENT_TESTS: ReadonlyArray<{
  slug: HrCandidateAssessmentTestSlug;
  shortLabel: "IPIP-NEO-120" | "SAFRAN" | "MWMS";
  subtitle: string;
}> = [
  {
    slug: "ipip-neo-120-v1",
    shortLabel: "IPIP-NEO-120",
    subtitle: "Radni obrasci i ponašanje",
  },
  {
    slug: "safran_v1",
    shortLabel: "SAFRAN",
    subtitle: "Kognitivni signali",
  },
  {
    slug: "mwms_v1",
    shortLabel: "MWMS",
    subtitle: "Motivacijski profil",
  },
] as const;

function getAttemptPriority(attempt: HrCandidateAssessmentAttempt): number {
  switch (attempt.lifecycle) {
    case "completed":
      return 0;
    case "in_progress":
      return 1;
    case "not_started":
      return 2;
    case "abandoned":
      return 3;
    default:
      return 4;
  }
}

function getAttemptSortTimestamp(attempt: HrCandidateAssessmentAttempt): number {
  return Date.parse(attempt.completed_at ?? attempt.started_at);
}

export function selectRelevantAttempt(
  attempts: HrCandidateAssessmentAttempt[],
): HrCandidateAssessmentAttempt | null {
  if (attempts.length === 0) {
    return null;
  }

  return [...attempts].sort((left, right) => {
    const priorityDifference = getAttemptPriority(left) - getAttemptPriority(right);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return getAttemptSortTimestamp(right) - getAttemptSortTimestamp(left);
  })[0] ?? null;
}

export function getTestStatusLabel(
  attempt: HrCandidateAssessmentAttempt | null,
): HrFriendlyTestStatus {
  if (!attempt) {
    return "Nije dodijeljeno";
  }

  if (attempt.lifecycle === "completed") {
    return "Završeno";
  }

  if (attempt.lifecycle === "in_progress") {
    return "U toku";
  }

  if (attempt.lifecycle === "not_started") {
    return "Čeka";
  }

  if (attempt.lifecycle === "abandoned") {
    return "Arhivirano";
  }

  return "Greška";
}

function selectLatestHrReportForAttempt(
  reports: HrCandidateAttemptReportSummary[],
): HrCandidateAttemptReportSummary | null {
  if (reports.length === 0) {
    return null;
  }

  return [...reports].sort((left, right) => {
    const generatedAtDifference =
      Date.parse(right.completed_at ?? right.generated_at) -
      Date.parse(left.completed_at ?? left.generated_at);

    if (generatedAtDifference !== 0) {
      return generatedAtDifference;
    }

    return right.id.localeCompare(left.id);
  })[0] ?? null;
}

export function resolveHrReportRecoveryAction(input: {
  attempt: HrCandidateAssessmentAttempt | null;
  report: HrCandidateAttemptReportSummary | null;
  capability: {
    active: boolean;
    status: "active" | "planned" | "inactive";
  };
}): HrCandidateAssessmentCard["action"] {
  const { attempt, report, capability } = input;

  if (!attempt) {
    return {
      label: null,
      kind: null,
      enabled: false,
      reason: "Attempt ne postoji.",
    };
  }

  if (attempt.lifecycle !== "completed") {
    return {
      label: null,
      kind: null,
      enabled: false,
      reason: "HR izvještaj se može pokrenuti tek nakon završetka procjene.",
    };
  }

  if (!capability.active) {
    return {
      label: null,
      kind: null,
      enabled: false,
      reason:
        capability.status === "planned"
          ? "HR izvještaj za ovu procjenu još nije podržan."
          : "HR izvještaj trenutno nije dostupan za ovu procjenu.",
    };
  }

  if (!report) {
    return {
      label: "Generiši HR izvještaj",
      kind: "generate",
      enabled: true,
    };
  }

  if (report.report_status === "failed") {
    return {
      label: "Ponovo generiši",
      kind: "retry",
      enabled: true,
    };
  }

  return {
    label: null,
    kind: null,
    enabled: false,
    reason: "HR izvještaj je već pokrenut ili dostupan.",
  };
}

export function resolveHrReportCardState(input: {
  attempt: HrCandidateAssessmentAttempt | null;
  report: HrCandidateAttemptReportSummary | null;
  readyHref: string | null;
}): Pick<
  HrCandidateAssessmentCard,
  "state" | "statusLabel" | "body" | "visualVariant" | "cta"
> {
  const { attempt, report, readyHref } = input;

  if (!attempt) {
    return {
      state: "not_assigned",
      statusLabel: "Nije dodijeljeno",
      body: "Ova procjena još nije dodijeljena kandidatu.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
      },
    };
  }

  if (attempt.lifecycle === "completed") {
    if (!report) {
      return {
        state: "completed_without_report",
        statusLabel: "Nije generisano",
        body: "Rezultati su završeni, ali HR izvještaj još nije generisan.",
        visualVariant: "info",
        cta: {
          label: "Nije dostupno",
          href: null,
          disabled: true,
        },
      };
    }

    if (report.report_status === "ready" && readyHref) {
      return {
        state: "ready",
        statusLabel: "Dostupno",
        body: "HR izvještaj je spreman za pregled.",
        visualVariant: "success",
        cta: {
          label: "Otvori HR izvještaj",
          href: readyHref,
          disabled: false,
        },
      };
    }

    if (report.report_status === "queued") {
      return {
        state: "queued",
        statusLabel: "Čeka generisanje",
        body: "HR izvještaj je poslan na generisanje i čeka obradu.",
        visualVariant: "progress",
        cta: {
          label: "Čeka generisanje",
          href: null,
          disabled: true,
        },
      };
    }

    if (report.report_status === "processing") {
      return {
        state: "processing",
        statusLabel: "Generiše se",
        body: "HR izvještaj se trenutno priprema.",
        visualVariant: "progress",
        cta: {
          label: "Generiše se",
          href: null,
          disabled: true,
        },
      };
    }

    if (report.report_status === "failed") {
      return {
        state: "failed",
        statusLabel: "Greška pri generisanju",
        body: "Rezultati su sačuvani, ali HR izvještaj nije uspješno generisan.",
        visualVariant: "error",
        cta: {
          label: "Nije dostupno",
          href: null,
          disabled: true,
        },
      };
    }

    if (report.report_status === "unavailable") {
      if (report.failure_code === "unsupported_audience") {
        return {
          state: "unsupported",
          statusLabel: "Još nije podržano",
          body: "Rezultati su završeni, ali HR izvještaj za ovu procjenu još nije podržan.",
          visualVariant: "info",
          cta: {
            label: "Nije dostupno",
            href: null,
            disabled: true,
          },
        };
      }

      return {
        state: "unavailable",
        statusLabel: "Nije dostupno",
        body: "HR izvještaj trenutno nije dostupan.",
        visualVariant: "info",
        cta: {
          label: "Nije dostupno",
          href: null,
          disabled: true,
        },
      };
    }
  }

  if (attempt.lifecycle === "in_progress") {
    return {
      state: "in_progress",
      statusLabel: "U toku",
      body: "Kandidat još nije završio ovu procjenu.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
      },
    };
  }

  if (attempt.lifecycle === "not_started") {
    return {
      state: "not_started",
      statusLabel: "Čeka kandidata",
      body: "Kandidat još nije započeo ovu procjenu.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
      },
    };
  }

  return {
    state: "abandoned",
    statusLabel: "Prekinuto",
    body: "Ova procjena je prekinuta ili zamijenjena novijom procjenom.",
    visualVariant: "info",
    cta: {
      label: "Nije dostupno",
      href: null,
      disabled: true,
    },
  };
}

export function buildHrCandidateReportCards(input: {
  attempts: HrCandidateAssessmentAttempt[];
  hrReports: HrCandidateAttemptReportSummary[];
}): HrCandidateAssessmentCard[] {
  const attemptsBySlug = new Map<string, HrCandidateAssessmentAttempt[]>();

  for (const attempt of input.attempts) {
    const slug = attempt.tests?.slug;

    if (!slug) {
      continue;
    }

    const testAttempts = attemptsBySlug.get(slug) ?? [];
    testAttempts.push(attempt);
    attemptsBySlug.set(slug, testAttempts);
  }

  const reportsByAttemptId = new Map<string, HrCandidateAttemptReportSummary[]>();

  for (const report of input.hrReports) {
    if (
      report.audience !== "hr" ||
      report.report_type !== "individual" ||
      report.source_type !== "single_test"
    ) {
      continue;
    }

    const attemptReports = reportsByAttemptId.get(report.attempt_id) ?? [];
    attemptReports.push(report);
    reportsByAttemptId.set(report.attempt_id, attemptReports);
  }

  return HR_CANDIDATE_ASSESSMENT_TESTS.map((test) => {
    const attempt = selectRelevantAttempt(attemptsBySlug.get(test.slug) ?? []);
    const report = attempt
      ? selectLatestHrReportForAttempt(reportsByAttemptId.get(attempt.id) ?? [])
      : null;
    const recoveryAction = resolveHrReportRecoveryAction({
      attempt,
      report,
      capability: getReportGenerationCapability({
        testSlug: test.slug,
        audience: "hr",
        reportType: "individual",
        sourceType: "single_test",
      }),
    });
    const resolvedState = resolveHrReportCardState({
      attempt,
      report,
      readyHref: attempt ? `/dashboard/attempts/${attempt.id}` : null,
    });

    if (attempt) {
      return {
        slug: test.slug,
        title: test.shortLabel,
        subtitle: test.subtitle,
        ...resolvedState,
        action: recoveryAction,
        attempt,
        report: resolvedState.state === "completed_without_report" ? null : report,
      };
    }

    return {
      slug: test.slug,
      title: test.shortLabel,
      subtitle: test.subtitle,
      ...resolvedState,
      action: recoveryAction,
      attempt: null,
      report: null,
    };
  });
}

export function buildParticipantAssessmentRows(input: {
  participants: HrCandidateAssessmentParticipant[];
  attempts: HrCandidateAssessmentAttempt[];
}): ParticipantAssessmentRow[] {
  const attemptsByParticipantId = new Map<string, HrCandidateAssessmentAttempt[]>();

  for (const attempt of input.attempts) {
    if (!attempt.participant_id) {
      continue;
    }

    const participantAttempts = attemptsByParticipantId.get(attempt.participant_id) ?? [];
    participantAttempts.push(attempt);
    attemptsByParticipantId.set(attempt.participant_id, participantAttempts);
  }

  return input.participants.map((participant) => {
    const participantAttempts = attemptsByParticipantId.get(participant.id) ?? [];
    const attemptsBySlug = new Map<string, HrCandidateAssessmentAttempt[]>();

    for (const attempt of participantAttempts) {
      const slug = attempt.tests?.slug;

      if (!slug) {
        continue;
      }

      const testAttempts = attemptsBySlug.get(slug) ?? [];
      testAttempts.push(attempt);
      attemptsBySlug.set(slug, testAttempts);
    }

    const testItems = HR_CANDIDATE_ASSESSMENT_TESTS.map((test) => {
      const relevantAttempt = selectRelevantAttempt(attemptsBySlug.get(test.slug) ?? []);

      return {
        key: test.slug,
        shortLabel: test.shortLabel,
        status: getTestStatusLabel(relevantAttempt),
      };
    });

    const relevantAttempts = HR_CANDIDATE_ASSESSMENT_TESTS
      .map((test) => selectRelevantAttempt(attemptsBySlug.get(test.slug) ?? []))
      .filter((attempt): attempt is HrCandidateAssessmentAttempt => Boolean(attempt));
    const completedAttempts = relevantAttempts.filter((attempt) => attempt.lifecycle === "completed");
    const openAttempt =
      relevantAttempts.find((attempt) => attempt.lifecycle === "in_progress") ??
      relevantAttempts.find((attempt) => attempt.lifecycle === "not_started") ??
      null;
    const archivedOnlyAttempt =
      !openAttempt && completedAttempts.length === 0
        ? relevantAttempts.find((attempt) => attempt.lifecycle === "abandoned") ?? null
        : null;
    const completedCount = completedAttempts.length;
    const totalTests = HR_CANDIDATE_ASSESSMENT_TESTS.length;
    const hasInvalidState = relevantAttempts.some(
      (attempt) =>
        attempt.lifecycle !== "completed" &&
        attempt.lifecycle !== "in_progress" &&
        attempt.lifecycle !== "not_started" &&
        attempt.lifecycle !== "abandoned",
    );
    const hasInProgressAttempt = relevantAttempts.some((attempt) => attempt.lifecycle === "in_progress");
    const hasNotStartedAttempt = relevantAttempts.some((attempt) => attempt.lifecycle === "not_started");
    const hasOpenAssessment = hasInProgressAttempt || hasNotStartedAttempt;

    let aggregateStatus: AssessmentAggregateStatus = "Čeka kandidata";

    if (hasInvalidState) {
      aggregateStatus = "Traži pažnju";
    } else if (completedCount === totalTests) {
      aggregateStatus = "Spremno za pregled";
    } else if (completedCount > 0) {
      aggregateStatus = "Djelimično završeno";
    } else if (hasInProgressAttempt) {
      aggregateStatus = "U toku";
    } else if (hasNotStartedAttempt || completedCount === 0) {
      aggregateStatus = "Čeka kandidata";
    }

    let primaryAction: ParticipantAssessmentRow["primaryAction"] = {
      kind: "create",
      label: "Dodijeli procjenu",
    };

    if (hasInvalidState) {
      primaryAction = {
        kind: "info",
        label: "Traži pažnju",
        note: "Provjeri status procjene.",
      };
    } else if (completedCount > 0) {
      primaryAction = {
        kind: "link",
        label: "Pregled procjena",
        href: `/dashboard/participants/${participant.id}/reports`,
      };
    } else if (openAttempt || archivedOnlyAttempt) {
      primaryAction = {
        kind: "info",
        label: "Čeka kandidata",
        note: "Rezultati će biti dostupni nakon završenog testa.",
      };
    }

    return {
      participant,
      totalTests,
      completedTests: completedCount,
      hasOpenAssessment,
      aggregateStatus,
      primaryAction,
      testItems,
    };
  });
}

export function buildHrCandidateAssessmentDetailModel(input: {
  participant: HrCandidateAssessmentParticipant;
  attempts: HrCandidateAssessmentAttempt[];
  hrReports: HrCandidateAttemptReportSummary[];
  organizationName: string;
  activeCompositeAssignment: ActiveStandardAssessmentAssignment | null;
  compositeReadiness: CompositeReadinessState | null;
  compositeReport: AssessmentReportRecord | null;
}): {
  participant: HrCandidateAssessmentParticipant;
  organizationName: string;
  cards: HrCandidateAssessmentCard[];
  compositeCard: HrCandidateCompositeCard;
  completedTests: number;
  readyHrReports: number;
  hasAssignedIndividualAssessments: boolean;
  allIndividualReportsNotAssigned: boolean;
  completedLabel: string;
  readyLabel: string;
  availabilityLabel:
    | "Spremno za pregled"
    | "Djelimično dostupno"
    | "Čeka rezultate"
    | "Procjene nisu dodijeljene";
} {
  const cards = buildHrCandidateReportCards({
    attempts: input.attempts,
    hrReports: input.hrReports,
  });
  const completedTests = cards.filter((card) => card.attempt?.lifecycle === "completed").length;
  const readyHrReports = cards.filter((card) => card.state === "ready").length;
  const hasAssignedIndividualAssessments = cards.some((card) => card.state !== "not_assigned");
  const allIndividualReportsNotAssigned = cards.every((card) => card.state === "not_assigned");
  const availabilityLabel =
    allIndividualReportsNotAssigned
      ? "Procjene nisu dodijeljene"
      : readyHrReports === cards.length
      ? "Spremno za pregled"
      : readyHrReports > 0
        ? "Djelimično dostupno"
        : "Čeka rezultate";
  const compositeCard = buildCompositeCard({
    assignment: input.activeCompositeAssignment,
    readiness: input.compositeReadiness,
    report: input.compositeReport,
  });

  return {
    participant: input.participant,
    organizationName: input.organizationName,
    cards,
    compositeCard,
    completedTests,
    readyHrReports,
    hasAssignedIndividualAssessments,
    allIndividualReportsNotAssigned,
    completedLabel: `${completedTests}/${cards.length} testova završeno`,
    readyLabel: `${readyHrReports} pojedinačnih HR izvještaja dostupno`,
    availabilityLabel,
  };
}

export function buildCompositeCard(input: {
  assignment: ActiveStandardAssessmentAssignment | null;
  readiness: CompositeReadinessState | null;
  report: AssessmentReportRecord | null;
}): HrCandidateCompositeCard {
  if (!input.assignment) {
    return {
      title: "Kompozitni HR izvještaj",
      subtitle: "Integrisani profil kandidata",
      state: "no_assignment",
      statusLabel: "Nije dostupno",
      body: "Kompozitni HR izvještaj nije dostupan jer ne postoji aktivan procjenski ciklus.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
        action: null,
      },
      assignment: null,
      readiness: null,
      report: null,
    };
  }

  const readiness = input.readiness;

  if (!readiness || readiness.status !== "ready") {
    const completedCount = readiness?.completedCount ?? 0;
    const requiredCount = readiness?.requiredCount ?? 0;
    const readinessSummary =
      requiredCount > 0
        ? ` Trenutno je završeno ${completedCount}/${requiredCount} potrebnih testova iz ovog ciklusa.`
        : "";

    return {
      title: "Kompozitni HR izvještaj",
      subtitle: "Integrisani profil kandidata",
      state: "incomplete",
      statusLabel: "Nije spremno",
      body: `Kompozitni HR izvještaj se može pripremiti tek kada su svi potrebni testovi završeni unutar istog procjenskog ciklusa.${readinessSummary}`,
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
        action: null,
      },
      assignment: input.assignment,
      readiness: readiness ?? null,
      report: input.report,
    };
  }

  if (!input.report) {
    return {
      title: "Kompozitni HR izvještaj",
      subtitle: "Integrisani profil kandidata",
      state: "ready_to_generate",
      statusLabel: "Spremno za generisanje",
      body: "Svi potrebni testovi iz ovog procjenskog ciklusa su završeni. Možete pokrenuti generisanje kompozitnog HR izvještaja.",
      visualVariant: "success",
      cta: {
        label: "Generiši kompozitni HR izvještaj",
        href: null,
        disabled: false,
        action: "generate_composite",
      },
      assignment: input.assignment,
      readiness,
      report: null,
    };
  }

  if (input.report.report_status === "queued") {
    return {
      title: "Kompozitni HR izvještaj",
      subtitle: "Integrisani profil kandidata",
      state: "queued",
      statusLabel: "Čeka generisanje",
      body: "Kompozitni HR izvještaj je dodat u red za generisanje i čeka obradu.",
      visualVariant: "progress",
      cta: {
        label: "Čeka generisanje",
        href: null,
        disabled: true,
        action: null,
      },
      assignment: input.assignment,
      readiness,
      report: input.report,
    };
  }

  if (input.report.report_status === "processing") {
    return {
      title: "Kompozitni HR izvještaj",
      subtitle: "Integrisani profil kandidata",
      state: "processing",
      statusLabel: "Generiše se",
      body: "Kompozitni HR izvještaj se trenutno priprema.",
      visualVariant: "progress",
      cta: {
        label: "Generiše se",
        href: null,
        disabled: true,
        action: null,
      },
      assignment: input.assignment,
      readiness,
      report: input.report,
    };
  }

  if (input.report.report_status === "ready") {
    return {
      title: "Kompozitni HR izvještaj",
      subtitle: "Integrisani profil kandidata",
      state: "ready",
      statusLabel: "Spremno za pregled",
      body: "Kompozitni HR izvještaj je spreman za pregled.",
      visualVariant: "success",
      cta: {
        label: "Pogledaj kompozitni izvještaj",
        href: `/dashboard/assessment-reports/${input.report.id}`,
        disabled: false,
        action: null,
      },
      assignment: input.assignment,
      readiness,
      report: input.report,
    };
  }

  return {
    title: "Kompozitni HR izvještaj",
    subtitle: "Integrisani profil kandidata",
    state: "failed",
    statusLabel: "Greška pri generisanju",
    body: "Kompozitni HR izvještaj nije uspješno generisan. Možete pokušati ponovno generisanje.",
    visualVariant: "error",
    cta: {
      label: "Ponovo generiši",
      href: null,
      disabled: false,
      action: "retry_composite",
    },
    assignment: input.assignment,
    readiness,
    report: input.report,
  };
}
