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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const { buildMockTeamFitReportSnapshot } = require("../lib/b2b/team-fit-report-mock.ts");
const { reviewTeamFitReportQuality } = require("../lib/b2b/team-fit-report-quality-review.ts");
const { loadTeamFitReportDisplayRecord } = require("../lib/b2b/team-fit-report-display.ts");
const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildInputSnapshot() {
  return {
    inputType: "team_fit_report_input_v1",
    inputVersion: "team_fit_report_input_v1",
    reportType: "team_fit_report_v1",
    reportVersion: "v1",
    locale: "bs",
    generatedAt: "2026-06-02T12:00:00.000Z",
    organizationContext: {
      organizationId: "org-quality-review",
      organizationName: "Deep Profile",
    },
    teamContext: {
      teamId: "team-quality-review",
      teamName: "Delivery Team",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "team-source-1",
    },
    candidateContext: {
      participantId: "participant-quality-review",
      displayName: "Amina Candidate",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-source-1",
    },
    sourceReferences: {
      teamFitReportId: "team-fit-report-quality-review",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-source-1",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "team-source-1",
      executiveOverviewContextIncluded: false,
      roleContextIncluded: false,
    },
    candidateSignals: {
      sourceStatus: "available",
      summary: {
        developmentTheme: "Potrebna je rana provjera očekivanja i načina saradnje.",
      },
    },
    teamSignals: {
      sourceStatus: "available",
      summary: {
        teamTheme: "Tim traži jasan ritam koordinacije i povratnih informacija.",
      },
    },
    interpretationGuardrails: {
      noNumericFitScore: true,
      noHireNoHire: true,
      noRawTeamMemberAnswers: true,
      noIndividualTeamMemberScoreDisplay: true,
      noCandidateFacingOutput: true,
    },
  };
}

function expectFailedWithCode(snapshot, codes) {
  const result = reviewTeamFitReportQuality(snapshot);
  assert.equal(result.reviewStatus, "failed");
  const acceptedCodes = Array.isArray(codes) ? codes : [codes];
  assert.equal(
    result.findings.some((finding) => acceptedCodes.includes(finding.code)),
    true,
  );
}

async function maybeReviewDbBackedRecord() {
  const organizationId = process.env.ORGANIZATION_ID;
  const teamId = process.env.TEAM_ID;
  const participantId = process.env.PARTICIPANT_ID;
  const teamFitReportId = process.env.TEAM_FIT_REPORT_ID;

  if (!organizationId || !teamId || !participantId || !teamFitReportId) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const record = await loadTeamFitReportDisplayRecord(
    {
      organizationId,
      teamId,
      participantId,
      teamFitReportId,
    },
    { supabase },
  );

  assert.ok(record, "Expected DB-backed Team Fit display record.");
  assert.ok(record.reportSnapshot, "Expected DB-backed Team Fit ready report snapshot.");

  const review = reviewTeamFitReportQuality(record);
  assert.notEqual(
    review.reviewStatus,
    "failed",
    `DB-backed Team Fit report failed QA review: ${review.summary}`,
  );
}

async function main() {
  const validSnapshot = buildMockTeamFitReportSnapshot(buildInputSnapshot());
  const validResult = reviewTeamFitReportQuality(validSnapshot);
  assert.equal(validResult.reviewStatus, "passed");
  assert.deepEqual(validResult.findings, []);

  const numericScoreSnapshot = clone(validSnapshot);
  numericScoreSnapshot.fitScore = 82;
  expectFailedWithCode(numericScoreSnapshot, [
    "FORBIDDEN_NUMERIC_SCORE_FIELD",
    "INVALID_REPORT_SNAPSHOT",
  ]);

  const hiringLanguageSnapshot = clone(validSnapshot);
  hiringLanguageSnapshot.fitOverview.summary =
    "Ovaj nalaz znači da kandidata treba zaposliti bez dodatne provjere.";
  expectFailedWithCode(hiringLanguageSnapshot, "FORBIDDEN_HIRING_LANGUAGE");

  const candidateFacingSnapshot = clone(validSnapshot);
  candidateFacingSnapshot.managerGuidance.communicationGuidance = [
    "Ti ćeš se najbrže uklopiti kada rano razjasniš očekivanja sa timom.",
  ];
  expectFailedWithCode(candidateFacingSnapshot, "CANDIDATE_FACING_LANGUAGE");

  const missingInterpretationLimitsSnapshot = clone(validSnapshot);
  delete missingInterpretationLimitsSnapshot.interpretationLimits;
  expectFailedWithCode(
    missingInterpretationLimitsSnapshot,
    "INVALID_REPORT_SNAPSHOT",
  );

  const privacyLeakSnapshot = clone(validSnapshot);
  privacyLeakSnapshot.memberScores = [{ memberId: "member-1", score: 4 }];
  expectFailedWithCode(privacyLeakSnapshot, [
    "FORBIDDEN_PRIVACY_FIELD",
    "INVALID_REPORT_SNAPSHOT",
  ]);

  const emptyGuidanceSnapshot = clone(validSnapshot);
  emptyGuidanceSnapshot.onboardingGuidance.priorities = [];
  emptyGuidanceSnapshot.onboardingGuidance.supportNeeds = [];
  expectFailedWithCode(emptyGuidanceSnapshot, "EMPTY_REQUIRED_SECTION");

  await maybeReviewDbBackedRecord();

  console.log("test-team-fit-report-quality-review: ok");
}

main().catch((error) => {
  console.error("test-team-fit-report-quality-review failed");
  console.error(error);
  process.exitCode = 1;
});
