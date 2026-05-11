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
  attempt: HrCandidateAssessmentAttempt | null;
  report: HrCandidateAttemptReportSummary | null;
  cta:
    | {
        label: "Otvori HR izvještaj";
        href: string;
        disabled: false;
      }
    | {
        label: "Generiše se" | "Nije dostupno";
        href: null;
        disabled: true;
      };
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
        label: "Pogledaj procjenu";
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
        body: "HR izvještaj je dostupan za pregled.",
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
        attempt,
        report: resolvedState.state === "completed_without_report" ? null : report,
      };
    }

    return {
      slug: test.slug,
      title: test.shortLabel,
      subtitle: test.subtitle,
      ...resolvedState,
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
        label: "Pogledaj procjenu",
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
}): {
  participant: HrCandidateAssessmentParticipant;
  organizationName: string;
  cards: HrCandidateAssessmentCard[];
  completedTests: number;
  readyHrReports: number;
  completedLabel: string;
  readyLabel: string;
  availabilityLabel: "Spremno za pregled" | "Djelimično dostupno" | "Čeka rezultate";
} {
  const cards = buildHrCandidateReportCards({
    attempts: input.attempts,
    hrReports: input.hrReports,
  });
  const completedTests = cards.filter((card) => card.attempt?.lifecycle === "completed").length;
  const readyHrReports = cards.filter((card) => card.state === "ready").length;
  const availabilityLabel =
    readyHrReports === cards.length
      ? "Spremno za pregled"
      : readyHrReports > 0
        ? "Djelimično dostupno"
        : "Čeka rezultate";

  return {
    participant: input.participant,
    organizationName: input.organizationName,
    cards,
    completedTests,
    readyHrReports,
    completedLabel: `${completedTests}/${cards.length} testova završeno`,
    readyLabel: `${readyHrReports} HR izvještaja dostupno`,
    availabilityLabel,
  };
}
