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
} = require("../lib/dashboard/hr-candidate-assessment.ts");

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

function buildHrReport({ id, attemptId, testSlug, status, audience = "hr" }) {
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
    failure_code: status === "failed" ? "generation_failed" : null,
    failure_reason: status === "failed" ? "Failed" : null,
  };
}

function main() {
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
  assert.equal(ipipCard1?.statusLabel, "U redu čekanja");
  assert.equal(safranCard1?.statusLabel, "Spreman");
  assert.equal(safranCard1?.cta.disabled, false);
  assert.equal(safranCard1?.cta.href, "/dashboard/attempts/fb749b5a-b0c8-4495-bf0c-abe99bf90095");

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
  assert.equal(ipipCard2?.statusLabel, "Spreman");
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
    "U redu čekanja",
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
    "Nije spreman",
  );

  console.log("HR candidate assessment detail model tests passed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
