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

async function main() {
  const {
    createSupabaseAdminClient,
  } = require("../lib/supabase/admin.ts");
  const {
    loadTeamAssessmentExecutionContext,
    loadTeamAssessmentRunHandoff,
    resolveTeamAssessmentExecutionShellState,
  } = require("../lib/assessment/team-assessment-execution.ts");
  const {
    ensureTeamDynamicsAssessmentV1SmokeFixture,
    TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
  } = require("./create-team-dynamics-assessment-v1-smoke-fixture.cjs");
  const {
    shouldHideAssessmentFromCandidateDashboard,
  } = require("../lib/assessment/availability.ts");
  const {
    STANDARD_ASSESSMENT_BATTERY_SLUGS,
  } = require("../lib/assessment/standard-battery.ts");
  const {
    getReportGenerationCapability,
  } = require("../lib/assessment/report-capabilities.ts");

  const result = await ensureTeamDynamicsAssessmentV1SmokeFixture();

  assert.equal(result.fixtureMode, "dedicated_smoke_fixture");
  assert.equal(result.assignment.packageSlug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  assert.equal(result.assignment.status, "active");
  assert.equal(result.test.slug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  assert.equal(result.test.status, "active");
  assert.equal(result.test.isActive, true);
  assert.equal(result.test.scoringMethod, "mixed_v1");
  assert.equal(result.test.activeQuestionCount, 48);
  assert.equal(result.participants.length, 2);
  assert.ok(
    result.participants.every((participant) =>
      participant.runPath.startsWith("/app/team-assessments/") &&
      participant.runPath.endsWith("/run"),
    ),
  );

  const supabase = createSupabaseAdminClient();
  const wrapperIds = result.participants.map((participant) => participant.teamAssessmentParticipantId);
  const { data: wrapperRows, error: wrapperError } = await supabase
    .from("team_assessment_participants")
    .select("id, team_assessment_assignment_id, team_membership_id, participant_id, attempt_id, status")
    .in("id", wrapperIds)
    .order("id", { ascending: true });

  if (wrapperError) {
    throw new Error(`Failed to load smoke wrappers: ${wrapperError.message}`);
  }

  assert.equal(wrapperRows.length, 2);
  assert.ok(wrapperRows.every((wrapper) => wrapper.status === "invited"));
  assert.ok(wrapperRows.every((wrapper) => wrapper.attempt_id));
  const attemptIds = wrapperRows.map((wrapper) => wrapper.attempt_id);

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug, status")
    .eq("id", result.assignment.id)
    .limit(1);

  if (assignmentError) {
    throw new Error(`Failed to load smoke assignment row: ${assignmentError.message}`);
  }

  assert.equal(assignmentRows[0].package_slug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  assert.equal(assignmentRows[0].status, "active");

  const { data: attemptRows, error: attemptError } = await supabase
    .from("attempts")
    .select("id, test_id, participant_id, user_id, organization_id, locale, status, tests(slug, scoring_method, status, is_active)")
    .in("id", attemptIds)
    .order("id", { ascending: true });

  if (attemptError) {
    throw new Error(`Failed to load smoke attempts: ${attemptError.message}`);
  }

  assert.equal(attemptRows.length, 2);
  assert.ok(
    attemptRows.every(
      (attempt) =>
        attempt.status === "in_progress" &&
        attempt.locale === "bs" &&
        attempt.tests &&
        (Array.isArray(attempt.tests) ? attempt.tests[0]?.slug : attempt.tests.slug) ===
          TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG &&
        (Array.isArray(attempt.tests)
          ? attempt.tests[0]?.scoring_method
          : attempt.tests.scoring_method) === "mixed_v1" &&
        (Array.isArray(attempt.tests) ? attempt.tests[0]?.status : attempt.tests.status) ===
          "active" &&
        (Array.isArray(attempt.tests) ? attempt.tests[0]?.is_active : attempt.tests.is_active) ===
          true,
    ),
  );

  const firstParticipant = result.participants[0];
  const contextResult = await loadTeamAssessmentExecutionContext({
    teamAssessmentParticipantId: firstParticipant.teamAssessmentParticipantId,
    userId: firstParticipant.userId,
  });

  assert.equal(contextResult.ok, true);
  assert.equal(contextResult.context.packageSlug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  assert.equal(contextResult.context.test.slug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  assert.equal(contextResult.context.test.isActive, true);

  const shellState = resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: contextResult.context.wrapperStatus,
  });
  const handoff = await loadTeamAssessmentRunHandoff({
    context: contextResult.context,
    shellState,
  });

  assert.equal(handoff.runShellVariant, "mixed_runtime_preview");
  assert.equal(handoff.testSlug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  assert.equal(handoff.packageSlug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  assert.equal(handoff.activeQuestionCount, 48);
  assert.equal(handoff.isRunnableShellState, true);
  assert.equal(handoff.mixedRuntimeHandoff?.testSlug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  assert.equal(handoff.mixedRuntimeHandoff?.scoringMethod, "mixed_v1");
  assert.equal(handoff.mixedRuntimeHandoff?.itemCount, 48);

  assert.equal(
    shouldHideAssessmentFromCandidateDashboard({ slug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG }),
    true,
  );
  assert.equal(
    STANDARD_ASSESSMENT_BATTERY_SLUGS.includes(TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG),
    false,
  );
  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
      audience: "participant",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: false, status: "inactive", reason: "unknown_test" },
  );
  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
      audience: "hr",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: false, status: "inactive", reason: "unknown_test" },
  );

  console.log("Team Dynamics assessment v1 smoke fixture tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
