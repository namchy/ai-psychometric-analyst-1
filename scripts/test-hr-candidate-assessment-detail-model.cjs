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
  buildParticipantAssessmentRows,
  resolveHrReportCardState,
  resolveHrReportRecoveryAction,
} = require("../lib/dashboard/hr-candidate-assessment.ts");
const {
  getReportGenerationCapability,
} = require("../lib/assessment/report-capabilities.ts");

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
      body: "HR izvještaj je dostupan za pregled.",
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
      label: null,
      kind: null,
      enabled: false,
      reason: "HR izvještaj za ovu procjenu još nije podržan.",
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

  const model1 = buildHrCandidateAssessmentDetailModel({
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
    organizationName: "Org 1",
  });
  const ipipCard1 = model1.cards.find((card) => card.slug === "ipip-neo-120-v1");
  const safranCard1 = model1.cards.find((card) => card.slug === "safran_v1");
  assert.equal(ipipCard1?.statusLabel, "Generiše se");
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
  const model2 = buildHrCandidateAssessmentDetailModel({
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
    organizationName: "Org 1",
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
  const model3 = buildHrCandidateAssessmentDetailModel({
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
    organizationName: "Org 1",
  });
  assert.equal(model3.cards.some((card) => card.cta.disabled === false), false);
  assert.equal(
    model3.cards.find((card) => card.slug === "ipip-neo-120-v1")?.statusLabel,
    "Generiše se",
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
  const model4 = buildHrCandidateAssessmentDetailModel({
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
    organizationName: "Org 1",
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
  const mwmsUnsupportedAttempt = buildAttempt({
    id: "attempt-mwms-unsupported",
    participantId: participant5.id,
    slug: "mwms_v1",
    lifecycle: "completed",
    startedAt: "2026-01-06T13:00:00.000Z",
    completedAt: "2026-01-06T14:00:00.000Z",
  });
  const amraModel = buildHrCandidateAssessmentDetailModel({
    participant: participant5,
    attempts: [ipipFailedAttempt, safranMissingAttempt, mwmsUnsupportedAttempt],
    hrReports: [
      buildHrReport({
        id: "report-ipip-failed",
        attemptId: ipipFailedAttempt.id,
        testSlug: "ipip-neo-120-v1",
        status: "failed",
        failureReason: "Cannot read properties of undefined (reading 'map')",
      }),
      buildHrReport({
        id: "report-mwms-unsupported",
        attemptId: mwmsUnsupportedAttempt.id,
        testSlug: "mwms_v1",
        status: "unavailable",
        failureCode: "unsupported_audience",
        failureReason: "MWMS V1 supports participant reports only.",
      }),
    ],
    organizationName: "Org 1",
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
    "Još nije podržano",
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
    amraModel.cards.find((card) => card.slug === "mwms_v1")?.action.enabled,
    false,
  );
  assert.equal(
    amraModel.cards.find((card) => card.slug === "ipip-neo-120-v1")?.body.includes("Cannot read properties"),
    false,
  );

  console.log("HR candidate assessment detail model tests passed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
