const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyModulePath;
  }

  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      resolveWithExtensions(path.join(projectRoot, request.slice(2))),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  buildHrCandidateAssessmentDetailModel,
  buildCompositeCard,
  buildParticipantAssessmentRows,
  resolveHrReportCardState,
  resolveHrReportRecoveryAction,
} = require("../lib/dashboard/hr-candidate-assessment.ts");
const {
  getReportGenerationCapability,
} = require("../lib/assessment/report-capabilities.ts");
const {
  buildCompositeReadinessFromLinkedAttempts,
} = require("../lib/assessment/assessment-reports.ts");

function buildParticipant(id, fullName, email) {
  return {
    id,
    organization_id: "org-1",
    user_id: `user-${id}`,
    email,
    full_name: fullName,
    participant_type: "candidate",
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function buildAttempt({
  id,
  participantId,
  slug,
  lifecycle,
  startedAt,
  completedAt = null,
}) {
  return {
    id,
    test_id: `test-${slug}`,
    locale: "bs",
    user_id: `user-${participantId}`,
    organization_id: "org-1",
    participant_id: participantId,
    status: lifecycle === "completed" ? "completed" : lifecycle === "abandoned" ? "abandoned" : "in_progress",
    started_at: startedAt,
    scored_started_at: null,
    completed_at: completedAt,
    responseCount: lifecycle === "completed" ? 42 : 0,
    lifecycle,
    tests: {
      slug,
      name: slug,
    },
    participants: {
      id: participantId,
      organization_id: "org-1",
      full_name: `Participant ${participantId}`,
      email: `${participantId}@example.com`,
    },
    organizations: {
      name: "Org 1",
      slug: "org-1",
    },
  };
}

function buildHrReport({
  id,
  attemptId,
  testSlug,
  status,
  audience = "hr",
  failureCode = null,
  failureReason = null,
}) {
  return {
    id,
    attempt_id: attemptId,
    test_slug: testSlug,
    audience,
    report_type: "individual",
    source_type: "single_test",
    report_status: status,
    generated_at: "2026-01-02T10:00:00.000Z",
    completed_at: status === "ready" ? "2026-01-02T10:05:00.000Z" : null,
    failure_code: failureCode ?? (status === "failed" ? "generation_failed" : null),
    failure_reason: failureReason ?? (status === "failed" ? "Failed" : null),
  };
}

function buildCompositeAssignment(id, participantId) {
  return {
    id,
    organization_id: "org-1",
    participant_id: participantId,
    assignment_type: "standard_battery",
    status: "active",
    locale: "bs",
    created_by_user_id: "user-1",
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    completed_at: null,
    metadata: {},
  };
}

function buildCompositeLink({
  assignmentId,
  attemptId,
  testSlug,
  status,
  completedAt = null,
  requiredForComposite = true,
  position = 0,
}) {
  return {
    assessment_assignment_id: assignmentId,
    attempt_id: attemptId,
    test_slug: testSlug,
    required_for_composite: requiredForComposite,
    position,
    attempts: {
      status,
      completed_at: completedAt,
    },
  };
}

function buildAssessmentReport({
  id,
  assignmentId,
  participantId,
  status,
  failureCode = null,
  failureReason = null,
}) {
  return {
    id,
    assessment_assignment_id: assignmentId,
    organization_id: "org-1",
    participant_id: participantId,
    report_type: "composite",
    audience: "hr",
    source_type: "assessment",
    report_status: status,
    generator_type: null,
    contract_version: null,
    prompt_version_id: null,
    model_name: null,
    generator_version: null,
    input_snapshot: null,
    report_snapshot: status === "ready" ? {} : null,
    failure_code: failureCode,
    failure_reason: failureReason,
    queued_at: status === "queued" ? "2026-01-02T10:00:00.000Z" : null,
    started_at: status === "processing" ? "2026-01-02T10:01:00.000Z" : null,
    completed_at: status === "ready" || status === "failed" ? "2026-01-02T10:05:00.000Z" : null,
    generated_at: status === "ready" ? "2026-01-02T10:05:00.000Z" : null,
    created_at: "2026-01-02T10:00:00.000Z",
    updated_at: "2026-01-02T10:05:00.000Z",
    metadata: {},
  };
}

function buildDetailModel(input) {
  return buildHrCandidateAssessmentDetailModel({
    participant: input.participant,
    attempts: input.attempts,
    hrReports: input.hrReports,
    organizationName: "Org 1",
    activeCompositeAssignment: input.activeCompositeAssignment ?? null,
    compositeReadiness: input.compositeReadiness ?? null,
    compositeReport: input.compositeReport ?? null,
  });
}

function assertResolvedState(input, expected) {
  assert.deepEqual(resolveHrReportCardState(input), expected);
}

function assertRecoveryAction(input, expected) {
  assert.deepEqual(resolveHrReportRecoveryAction(input), expected);
}

function main() {
  const completedAttempt = buildAttempt({
    id: "attempt-completed",
    participantId: "participant-resolve",
    slug: "ipip-neo-120-v1",
    lifecycle: "completed",
    startedAt: "2026-01-01T09:00:00.000Z",
    completedAt: "2026-01-01T10:00:00.000Z",
  });
  const helperInProgressAttempt = buildAttempt({
    id: "attempt-in-progress",
    participantId: "participant-resolve",
    slug: "safran_v1",
    lifecycle: "in_progress",
    startedAt: "2026-01-01T09:00:00.000Z",
  });
  const abandonedAttempt = buildAttempt({
    id: "attempt-abandoned",
    participantId: "participant-resolve",
    slug: "mwms_v1",
    lifecycle: "abandoned",
    startedAt: "2026-01-01T09:00:00.000Z",
  });

  assertResolvedState(
    {
      attempt: completedAttempt,
      report: buildHrReport({
        id: "report-ready",
        attemptId: completedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "ready",
      }),
      readyHref: `/dashboard/attempts/${completedAttempt.id}`,
    },
    {
      state: "ready",
      statusLabel: "Dostupno",
      body: "HR izvještaj je spreman za pregled.",
      visualVariant: "success",
      cta: {
        label: "Otvori HR izvještaj",
        href: `/dashboard/attempts/${completedAttempt.id}`,
        disabled: false,
      },
    },
  );

  assertRecoveryAction(
    {
      attempt: completedAttempt,
      report: buildHrReport({
        id: "report-failed-retry",
        attemptId: completedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "failed",
      }),
      capability: getReportGenerationCapability({
        testSlug: "ipip-neo-120-v1",
        audience: "hr",
        reportType: "individual",
        sourceType: "single_test",
      }),
    },
    {
      label: "Ponovo generiši",
      kind: "retry",
      enabled: true,
    },
  );

  assertRecoveryAction(
    {
      attempt: completedAttempt,
      report: null,
      capability: getReportGenerationCapability({
        testSlug: "safran_v1",
        audience: "hr",
        reportType: "individual",
        sourceType: "single_test",
      }),
    },
    {
      label: "Generiši HR izvještaj",
      kind: "generate",
      enabled: true,
    },
  );

  assertRecoveryAction(
    {
      attempt: completedAttempt,
      report: buildHrReport({
        id: "report-ready-no-retry",
        attemptId: completedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "ready",
      }),
      capability: getReportGenerationCapability({
        testSlug: "ipip-neo-120-v1",
        audience: "hr",
        reportType: "individual",
        sourceType: "single_test",
      }),
    },
    {
      label: null,
      kind: null,
      enabled: false,
      reason: "HR izvještaj je već pokrenut ili dostupan.",
    },
  );

  assertRecoveryAction(
    {
      attempt: completedAttempt,
      report: buildHrReport({
        id: "report-queued-no-retry",
        attemptId: completedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "queued",
      }),
      capability: getReportGenerationCapability({
        testSlug: "ipip-neo-120-v1",
        audience: "hr",
        reportType: "individual",
        sourceType: "single_test",
      }),
    },
    {
      label: null,
      kind: null,
      enabled: false,
      reason: "HR izvještaj je već pokrenut ili dostupan.",
    },
  );

  assertRecoveryAction(
    {
      attempt: completedAttempt,
      report: buildHrReport({
        id: "report-processing-no-retry",
        attemptId: completedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "processing",
      }),
      capability: getReportGenerationCapability({
        testSlug: "ipip-neo-120-v1",
        audience: "hr",
        reportType: "individual",
        sourceType: "single_test",
      }),
    },
    {
      label: null,
      kind: null,
      enabled: false,
      reason: "HR izvještaj je već pokrenut ili dostupan.",
    },
  );

  assertRecoveryAction(
    {
      attempt: completedAttempt,
      report: null,
      capability: getReportGenerationCapability({
        testSlug: "mwms_v1",
        audience: "hr",
        reportType: "individual",
        sourceType: "single_test",
      }),
    },
    {
      label: "Generiši HR izvještaj",
      kind: "generate",
      enabled: true,
    },
  );

  assertRecoveryAction(
    {
      attempt: helperInProgressAttempt,
      report: null,
      capability: getReportGenerationCapability({
        testSlug: "safran_v1",
        audience: "hr",
        reportType: "individual",
        sourceType: "single_test",
      }),
    },
    {
      label: null,
      kind: null,
      enabled: false,
      reason: "HR izvještaj se može pokrenuti tek nakon završetka procjene.",
    },
  );

  assertRecoveryAction(
    {
      attempt: abandonedAttempt,
      report: null,
      capability: getReportGenerationCapability({
        testSlug: "mwms_v1",
        audience: "hr",
        reportType: "individual",
        sourceType: "single_test",
      }),
    },
    {
      label: null,
      kind: null,
      enabled: false,
      reason: "HR izvještaj se može pokrenuti tek nakon završetka procjene.",
    },
  );

  assertResolvedState(
    {
      attempt: completedAttempt,
      report: buildHrReport({
        id: "report-queued",
        attemptId: completedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "queued",
      }),
      readyHref: `/dashboard/attempts/${completedAttempt.id}`,
    },
    {
      state: "queued",
      statusLabel: "Čeka generisanje",
      body: "HR izvještaj je poslan na generisanje i čeka obradu.",
      visualVariant: "progress",
      cta: {
        label: "Čeka generisanje",
        href: null,
        disabled: true,
      },
    },
  );

  const completedMwmsAttempt = buildAttempt({
    id: "attempt-mwms-completed-statuses",
    participantId: "participant-resolve",
    slug: "mwms_v1",
    lifecycle: "completed",
    startedAt: "2026-01-01T11:00:00.000Z",
    completedAt: "2026-01-01T12:00:00.000Z",
  });

  assertResolvedState(
    {
      attempt: completedMwmsAttempt,
      report: null,
      readyHref: `/dashboard/attempts/${completedMwmsAttempt.id}`,
    },
    {
      state: "completed_without_report",
      statusLabel: "Nije generisano",
      body: "Rezultati su završeni, ali HR izvještaj još nije generisan.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
      },
    },
  );

  assertRecoveryAction(
    {
      attempt: completedMwmsAttempt,
      report: null,
      capability: getReportGenerationCapability({
        testSlug: "mwms_v1",
        audience: "hr",
        reportType: "individual",
        sourceType: "single_test",
      }),
    },
    {
      label: "Generiši HR izvještaj",
      kind: "generate",
      enabled: true,
    },
  );

  assertRecoveryAction(
    {
      attempt: completedMwmsAttempt,
      report: buildHrReport({
        id: "report-mwms-failed-retry",
        attemptId: completedMwmsAttempt.id,
        testSlug: "mwms_v1",
        status: "failed",
      }),
      capability: getReportGenerationCapability({
        testSlug: "mwms_v1",
        audience: "hr",
        reportType: "individual",
        sourceType: "single_test",
      }),
    },
    {
      label: "Ponovo generiši",
      kind: "retry",
      enabled: true,
    },
  );

  assert.equal(
    resolveHrReportCardState({
      attempt: completedMwmsAttempt,
      report: buildHrReport({
        id: "report-mwms-queued",
        attemptId: completedMwmsAttempt.id,
        testSlug: "mwms_v1",
        status: "queued",
      }),
      readyHref: `/dashboard/attempts/${completedMwmsAttempt.id}`,
    }).statusLabel,
    "Čeka generisanje",
  );
  assert.equal(
    resolveHrReportCardState({
      attempt: completedMwmsAttempt,
      report: buildHrReport({
        id: "report-mwms-processing",
        attemptId: completedMwmsAttempt.id,
        testSlug: "mwms_v1",
        status: "processing",
      }),
      readyHref: `/dashboard/attempts/${completedMwmsAttempt.id}`,
    }).statusLabel,
    "Generiše se",
  );
  assert.equal(
    resolveHrReportCardState({
      attempt: completedMwmsAttempt,
      report: buildHrReport({
        id: "report-mwms-failed",
        attemptId: completedMwmsAttempt.id,
        testSlug: "mwms_v1",
        status: "failed",
      }),
      readyHref: `/dashboard/attempts/${completedMwmsAttempt.id}`,
    }).statusLabel,
    "Greška pri generisanju",
  );
  assert.equal(
    resolveHrReportCardState({
      attempt: completedMwmsAttempt,
      report: buildHrReport({
        id: "report-mwms-ready",
        attemptId: completedMwmsAttempt.id,
        testSlug: "mwms_v1",
        status: "ready",
      }),
      readyHref: `/dashboard/attempts/${completedMwmsAttempt.id}`,
    }).cta.label,
    "Otvori HR izvještaj",
  );

  assertResolvedState(
    {
      attempt: completedAttempt,
      report: buildHrReport({
        id: "report-processing",
        attemptId: completedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "processing",
      }),
      readyHref: `/dashboard/attempts/${completedAttempt.id}`,
    },
    {
      state: "processing",
      statusLabel: "Generiše se",
      body: "HR izvještaj se trenutno priprema.",
      visualVariant: "progress",
      cta: {
        label: "Generiše se",
        href: null,
        disabled: true,
      },
    },
  );

  assertResolvedState(
    {
      attempt: completedAttempt,
      report: buildHrReport({
        id: "report-failed",
        attemptId: completedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "failed",
        failureReason: "Cannot read properties of undefined (reading 'map')",
      }),
      readyHref: `/dashboard/attempts/${completedAttempt.id}`,
    },
    {
      state: "failed",
      statusLabel: "Greška pri generisanju",
      body: "Rezultati su sačuvani, ali HR izvještaj nije uspješno generisan.",
      visualVariant: "error",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
      },
    },
  );

  assertResolvedState(
    {
      attempt: completedAttempt,
      report: buildHrReport({
        id: "report-unsupported",
        attemptId: completedAttempt.id,
        testSlug: "mwms_v1",
        status: "unavailable",
        failureCode: "unsupported_audience",
        failureReason: "MWMS V1 supports participant reports only.",
      }),
      readyHref: `/dashboard/attempts/${completedAttempt.id}`,
    },
    {
      state: "unsupported",
      statusLabel: "Još nije podržano",
      body: "Rezultati su završeni, ali HR izvještaj za ovu procjenu još nije podržan.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
      },
    },
  );

  assertResolvedState(
    {
      attempt: completedAttempt,
      report: buildHrReport({
        id: "report-unavailable",
        attemptId: completedAttempt.id,
        testSlug: "safran_v1",
        status: "unavailable",
      }),
      readyHref: `/dashboard/attempts/${completedAttempt.id}`,
    },
    {
      state: "unavailable",
      statusLabel: "Nije dostupno",
      body: "HR izvještaj trenutno nije dostupan.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
      },
    },
  );

  assertResolvedState(
    {
      attempt: completedAttempt,
      report: null,
      readyHref: `/dashboard/attempts/${completedAttempt.id}`,
    },
    {
      state: "completed_without_report",
      statusLabel: "Nije generisano",
      body: "Rezultati su završeni, ali HR izvještaj još nije generisan.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
      },
    },
  );

  assertResolvedState(
    {
      attempt: helperInProgressAttempt,
      report: null,
      readyHref: `/dashboard/attempts/${helperInProgressAttempt.id}`,
    },
    {
      state: "in_progress",
      statusLabel: "U toku",
      body: "Kandidat još nije završio ovu procjenu.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
      },
    },
  );

  assertResolvedState(
    {
      attempt: null,
      report: null,
      readyHref: null,
    },
    {
      state: "not_assigned",
      statusLabel: "Nije dodijeljeno",
      body: "Ova procjena još nije dodijeljena kandidatu.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
      },
    },
  );

  assertResolvedState(
    {
      attempt: abandonedAttempt,
      report: null,
      readyHref: `/dashboard/attempts/${abandonedAttempt.id}`,
    },
    {
      state: "abandoned",
      statusLabel: "Prekinuto",
      body: "Ova procjena je prekinuta ili zamijenjena novijom procjenom.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
      },
    },
  );

  const participant1 = buildParticipant("participant-1", "User 1", "user1@example.com");
  const ipipQueuedAttempt = buildAttempt({
    id: "attempt-ipip-queued",
    participantId: participant1.id,
    slug: "ipip-neo-120-v1",
    lifecycle: "completed",
    startedAt: "2026-01-01T09:00:00.000Z",
    completedAt: "2026-01-01T10:00:00.000Z",
  });
  const safranReadyAttempt = buildAttempt({
    id: "fb749b5a-b0c8-4495-bf0c-abe99bf90095",
    participantId: participant1.id,
    slug: "safran_v1",
    lifecycle: "completed",
    startedAt: "2026-01-02T09:00:00.000Z",
    completedAt: "2026-01-02T10:00:00.000Z",
  });

  const rows1 = buildParticipantAssessmentRows({
    participants: [participant1],
    attempts: [ipipQueuedAttempt, safranReadyAttempt],
  });
  assert.equal(rows1[0].primaryAction.kind, "link");
  assert.equal(rows1[0].primaryAction.href, `/dashboard/participants/${participant1.id}/reports`);

  const model1 = buildDetailModel({
    participant: participant1,
    attempts: [ipipQueuedAttempt, safranReadyAttempt],
    hrReports: [
      buildHrReport({
        id: "report-ipip-queued",
        attemptId: ipipQueuedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "queued",
      }),
      buildHrReport({
        id: "report-safran-ready",
        attemptId: safranReadyAttempt.id,
        testSlug: "safran_v1",
        status: "ready",
      }),
    ],
  });
  const ipipCard1 = model1.cards.find((card) => card.slug === "ipip-neo-120-v1");
  const safranCard1 = model1.cards.find((card) => card.slug === "safran_v1");
  assert.equal(ipipCard1?.statusLabel, "Čeka generisanje");
  assert.equal(ipipCard1?.visualVariant, "progress");
  assert.equal(safranCard1?.statusLabel, "Dostupno");
  assert.equal(safranCard1?.cta.disabled, false);
  assert.equal(safranCard1?.cta.href, "/dashboard/attempts/fb749b5a-b0c8-4495-bf0c-abe99bf90095");
  assert.equal(safranCard1?.cta.label, "Otvori HR izvještaj");
  assert.equal(ipipCard1?.action.enabled, false);
  assert.equal(safranCard1?.action.enabled, false);

  const participant2 = buildParticipant("participant-2", "User 2", "user2@example.com");
  const ipipReadyAttempt = buildAttempt({
    id: "attempt-ipip-ready",
    participantId: participant2.id,
    slug: "ipip-neo-120-v1",
    lifecycle: "completed",
    startedAt: "2026-01-03T09:00:00.000Z",
    completedAt: "2026-01-03T10:00:00.000Z",
  });
  const model2 = buildDetailModel({
    participant: participant2,
    attempts: [ipipReadyAttempt],
    hrReports: [
      buildHrReport({
        id: "report-ipip-ready",
        attemptId: ipipReadyAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "ready",
      }),
    ],
  });
  const ipipCard2 = model2.cards.find((card) => card.slug === "ipip-neo-120-v1");
  assert.equal(ipipCard2?.statusLabel, "Dostupno");
  assert.equal(ipipCard2?.cta.href, `/dashboard/attempts/${ipipReadyAttempt.id}`);

  const participant3 = buildParticipant("participant-3", "User 3", "user3@example.com");
  const queuedAttempt = buildAttempt({
    id: "attempt-queued",
    participantId: participant3.id,
    slug: "ipip-neo-120-v1",
    lifecycle: "completed",
    startedAt: "2026-01-04T09:00:00.000Z",
    completedAt: "2026-01-04T10:00:00.000Z",
  });
  const inProgressAttempt = buildAttempt({
    id: "attempt-in-progress",
    participantId: participant3.id,
    slug: "safran_v1",
    lifecycle: "in_progress",
    startedAt: "2026-01-04T09:00:00.000Z",
  });
  const model3 = buildDetailModel({
    participant: participant3,
    attempts: [queuedAttempt, inProgressAttempt],
    hrReports: [
      buildHrReport({
        id: "report-queued",
        attemptId: queuedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "queued",
      }),
    ],
  });
  assert.equal(model3.cards.some((card) => card.cta.disabled === false), false);
  assert.equal(
    model3.cards.find((card) => card.slug === "ipip-neo-120-v1")?.statusLabel,
    "Čeka generisanje",
  );
  assert.equal(
    model3.cards.find((card) => card.slug === "safran_v1")?.statusLabel,
    "U toku",
  );
  assert.equal(
    model3.cards.find((card) => card.slug === "mwms_v1")?.statusLabel,
    "Nije dodijeljeno",
  );

  const participant4 = buildParticipant("participant-4", "User 4", "user4@example.com");
  const participantOnlyAttempt = buildAttempt({
    id: "attempt-participant-only",
    participantId: participant4.id,
    slug: "safran_v1",
    lifecycle: "completed",
    startedAt: "2026-01-05T09:00:00.000Z",
    completedAt: "2026-01-05T10:00:00.000Z",
  });
  const model4 = buildDetailModel({
    participant: participant4,
    attempts: [participantOnlyAttempt],
    hrReports: [
      buildHrReport({
        id: "report-participant-ready",
        attemptId: participantOnlyAttempt.id,
        testSlug: "safran_v1",
        status: "ready",
        audience: "participant",
      }),
    ],
  });
  assert.equal(
    model4.cards.find((card) => card.slug === "safran_v1")?.statusLabel,
    "Nije generisano",
  );
  assert.equal(
    model4.cards.find((card) => card.slug === "safran_v1")?.action.kind,
    "generate",
  );

  const participant5 = buildParticipant("participant-5", "Amra", "amra@example.com");
  const ipipFailedAttempt = buildAttempt({
    id: "attempt-ipip-failed",
    participantId: participant5.id,
    slug: "ipip-neo-120-v1",
    lifecycle: "completed",
    startedAt: "2026-01-06T09:00:00.000Z",
    completedAt: "2026-01-06T10:00:00.000Z",
  });
  const safranMissingAttempt = buildAttempt({
    id: "attempt-safran-missing",
    participantId: participant5.id,
    slug: "safran_v1",
    lifecycle: "completed",
    startedAt: "2026-01-06T11:00:00.000Z",
    completedAt: "2026-01-06T12:00:00.000Z",
  });
  const mwmsMissingAttempt = buildAttempt({
    id: "attempt-mwms-missing",
    participantId: participant5.id,
    slug: "mwms_v1",
    lifecycle: "completed",
    startedAt: "2026-01-06T13:00:00.000Z",
    completedAt: "2026-01-06T14:00:00.000Z",
  });
  const amraModel = buildDetailModel({
    participant: participant5,
    attempts: [ipipFailedAttempt, safranMissingAttempt, mwmsMissingAttempt],
    hrReports: [
      buildHrReport({
        id: "report-ipip-failed",
        attemptId: ipipFailedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "failed",
        failureReason: "Cannot read properties of undefined (reading 'map')",
      }),
    ],
  });
  assert.equal(
    amraModel.cards.find((card) => card.slug === "ipip-neo-120-v1")?.statusLabel,
    "Greška pri generisanju",
  );
  assert.equal(
    amraModel.cards.find((card) => card.slug === "safran_v1")?.statusLabel,
    "Nije generisano",
  );
  assert.equal(
    amraModel.cards.find((card) => card.slug === "mwms_v1")?.statusLabel,
    "Nije generisano",
  );
  assert.equal(
    amraModel.cards.find((card) => card.slug === "ipip-neo-120-v1")?.action.kind,
    "retry",
  );
  assert.equal(
    amraModel.cards.find((card) => card.slug === "safran_v1")?.action.kind,
    "generate",
  );
  assert.equal(
    amraModel.cards.find((card) => card.slug === "mwms_v1")?.action.kind,
    "generate",
  );
  assert.equal(
    amraModel.cards.find((card) => card.slug === "ipip-neo-120-v1")?.body.includes("Cannot read properties"),
    false,
  );

  const noAssignmentCard = buildCompositeCard({
    assignment: null,
    readiness: null,
    report: null,
  });
  assert.equal(noAssignmentCard.state, "no_assignment");
  assert.equal(noAssignmentCard.cta.disabled, true);
  assert.equal(noAssignmentCard.cta.action, null);

  const incompleteAssignment = buildCompositeAssignment("assignment-incomplete", participant1.id);
  const incompleteReadiness = buildCompositeReadinessFromLinkedAttempts([
    buildCompositeLink({
      assignmentId: incompleteAssignment.id,
      attemptId: "attempt-ipip-linked",
      testSlug: "ipip-neo-120-v1",
      status: "completed",
      completedAt: "2026-01-02T10:00:00.000Z",
      position: 0,
    }),
    buildCompositeLink({
      assignmentId: incompleteAssignment.id,
      attemptId: "attempt-safran-linked",
      testSlug: "safran_v1",
      status: "in_progress",
      position: 1,
    }),
  ]);
  assert.equal(incompleteReadiness.status, "incomplete");
  assert.equal(incompleteReadiness.completedCount, 1);

  const incompleteModel = buildDetailModel({
    participant: participant1,
    attempts: [ipipQueuedAttempt, safranReadyAttempt],
    hrReports: [],
    activeCompositeAssignment: incompleteAssignment,
    compositeReadiness: incompleteReadiness,
  });
  assert.equal(incompleteModel.compositeCard.state, "incomplete");
  assert.equal(incompleteModel.compositeCard.statusLabel, "Nije spremno");
  assert.equal(incompleteModel.compositeCard.cta.disabled, true);
  assert.equal(incompleteModel.compositeCard.cta.action, null);

  const partialCompatibilityAssignment = buildCompositeAssignment("assignment-partial", participant2.id);
  const partialReadiness = buildCompositeReadinessFromLinkedAttempts([
    buildCompositeLink({
      assignmentId: partialCompatibilityAssignment.id,
      attemptId: ipipReadyAttempt.id,
      testSlug: "ipip-neo-120-v1",
      status: "completed",
      completedAt: "2026-01-03T10:00:00.000Z",
      position: 0,
    }),
  ], {
    expectedRequiredTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
  });
  assert.equal(partialReadiness.status, "incomplete");
  const noFallbackModel = buildDetailModel({
    participant: participant2,
    attempts: [
      ipipReadyAttempt,
      buildAttempt({
        id: "historical-safran-completed",
        participantId: participant2.id,
        slug: "safran_v1",
        lifecycle: "completed",
        startedAt: "2025-12-01T09:00:00.000Z",
        completedAt: "2025-12-01T10:00:00.000Z",
      }),
      buildAttempt({
        id: "historical-mwms-completed",
        participantId: participant2.id,
        slug: "mwms_v1",
        lifecycle: "completed",
        startedAt: "2025-12-01T11:00:00.000Z",
        completedAt: "2025-12-01T12:00:00.000Z",
      }),
    ],
    hrReports: [],
    activeCompositeAssignment: partialCompatibilityAssignment,
    compositeReadiness: partialReadiness,
  });
  assert.equal(noFallbackModel.compositeCard.state, "incomplete");
  assert.equal(noFallbackModel.compositeCard.cta.action, null);

  const noRequiredReadiness = buildCompositeReadinessFromLinkedAttempts([]);
  assert.equal(noRequiredReadiness.status, "no_required_components");
  const noRequiredModel = buildDetailModel({
    participant: participant3,
    attempts: [queuedAttempt],
    hrReports: [],
    activeCompositeAssignment: buildCompositeAssignment("assignment-no-required", participant3.id),
    compositeReadiness: noRequiredReadiness,
  });
  assert.equal(noRequiredModel.compositeCard.state, "incomplete");
  assert.equal(noRequiredModel.compositeCard.cta.action, null);

  const readyAssignment = buildCompositeAssignment("assignment-ready", participant4.id);
  const readyReadiness = buildCompositeReadinessFromLinkedAttempts([
    buildCompositeLink({
      assignmentId: readyAssignment.id,
      attemptId: "attempt-ipip-complete",
      testSlug: "ipip-neo-120-v1",
      status: "completed",
      completedAt: "2026-01-02T10:00:00.000Z",
      position: 0,
    }),
    buildCompositeLink({
      assignmentId: readyAssignment.id,
      attemptId: "attempt-safran-complete",
      testSlug: "safran_v1",
      status: "completed",
      completedAt: "2026-01-02T11:00:00.000Z",
      position: 1,
    }),
    buildCompositeLink({
      assignmentId: readyAssignment.id,
      attemptId: "attempt-mwms-complete",
      testSlug: "mwms_v1",
      status: "completed",
      completedAt: "2026-01-02T12:00:00.000Z",
      position: 2,
    }),
  ], {
    expectedRequiredTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
  });
  const readyToGenerateModel = buildDetailModel({
    participant: participant4,
    attempts: [participantOnlyAttempt],
    hrReports: [],
    activeCompositeAssignment: readyAssignment,
    compositeReadiness: readyReadiness,
  });
  assert.equal(readyToGenerateModel.compositeCard.state, "ready_to_generate");
  assert.equal(readyToGenerateModel.compositeCard.cta.disabled, false);
  assert.equal(readyToGenerateModel.compositeCard.cta.action, "generate_composite");
  assert.equal(readyToGenerateModel.compositeCard.cta.href, null);
  assert.equal(
    readyToGenerateModel.compositeCard.cta.label,
    "Generiši kompozitni HR izvještaj",
  );

  const queuedCompositeModel = buildDetailModel({
    participant: participant4,
    attempts: [participantOnlyAttempt],
    hrReports: [],
    activeCompositeAssignment: readyAssignment,
    compositeReadiness: readyReadiness,
    compositeReport: buildAssessmentReport({
      id: "assessment-report-queued",
      assignmentId: readyAssignment.id,
      participantId: participant4.id,
      status: "queued",
    }),
  });
  assert.equal(queuedCompositeModel.compositeCard.state, "queued");
  assert.equal(queuedCompositeModel.compositeCard.cta.disabled, true);
  assert.equal(queuedCompositeModel.compositeCard.cta.action, null);
  assert.equal(queuedCompositeModel.compositeCard.cta.href, null);
  assert.equal(queuedCompositeModel.compositeCard.cta.label, "Čeka generisanje");

  const processingCompositeModel = buildDetailModel({
    participant: participant4,
    attempts: [participantOnlyAttempt],
    hrReports: [],
    activeCompositeAssignment: readyAssignment,
    compositeReadiness: readyReadiness,
    compositeReport: buildAssessmentReport({
      id: "assessment-report-processing",
      assignmentId: readyAssignment.id,
      participantId: participant4.id,
      status: "processing",
    }),
  });
  assert.equal(processingCompositeModel.compositeCard.state, "processing");
  assert.equal(processingCompositeModel.compositeCard.cta.disabled, true);
  assert.equal(processingCompositeModel.compositeCard.cta.action, null);
  assert.equal(processingCompositeModel.compositeCard.cta.href, null);
  assert.equal(processingCompositeModel.compositeCard.cta.label, "Generiše se");

  const readyCompositeModel = buildDetailModel({
    participant: participant4,
    attempts: [participantOnlyAttempt],
    hrReports: [],
    activeCompositeAssignment: readyAssignment,
    compositeReadiness: readyReadiness,
    compositeReport: buildAssessmentReport({
      id: "assessment-report-ready",
      assignmentId: readyAssignment.id,
      participantId: participant4.id,
      status: "ready",
    }),
  });
  assert.equal(readyCompositeModel.compositeCard.state, "ready");
  assert.equal(readyCompositeModel.compositeCard.cta.disabled, false);
  assert.equal(readyCompositeModel.compositeCard.cta.action, null);
  assert.equal(readyCompositeModel.compositeCard.cta.label, "Pogledaj kompozitni izvještaj");
  assert.equal(
    readyCompositeModel.compositeCard.cta.href,
    "/dashboard/assessment-reports/assessment-report-ready",
  );
  assert.equal(
    readyCompositeModel.compositeCard.cta.href.includes("/dashboard/attempts/"),
    false,
  );

  const failedCompositeModel = buildDetailModel({
    participant: participant4,
    attempts: [participantOnlyAttempt],
    hrReports: [],
    activeCompositeAssignment: readyAssignment,
    compositeReadiness: readyReadiness,
    compositeReport: buildAssessmentReport({
      id: "assessment-report-failed",
      assignmentId: readyAssignment.id,
      participantId: participant4.id,
      status: "failed",
      failureCode: "generation_failed",
      failureReason: "Failed",
    }),
  });
  assert.equal(failedCompositeModel.compositeCard.state, "failed");
  assert.equal(failedCompositeModel.compositeCard.cta.disabled, false);
  assert.equal(failedCompositeModel.compositeCard.cta.action, "retry_composite");
  assert.equal(failedCompositeModel.compositeCard.cta.label, "Ponovo generiši");
  assert.equal(failedCompositeModel.compositeCard.cta.href, null);

  console.log("HR candidate assessment detail model tests passed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
