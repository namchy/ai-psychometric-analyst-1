const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) return candidatePath;
  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;
    if (fs.existsSync(withExtension)) return withExtension;
  }
  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") return emptyModulePath;
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

require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

const {
  GDT_01_ORGANIZATION_NAME,
  GDT_01_PACKAGE_SLUG,
  GDT_01_TEAM_NAME,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-contract.ts");
const {
  TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
  loadTeamDynamicsFinalAggregation,
} = require("../lib/assessment/team-dynamics-final-aggregation.ts");
const {
  TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
} = require("../lib/assessment/team-dynamics-mixed-score-persistence.ts");
const {
  persistTeamDynamicsFinalAggregationSnapshot,
} = require("../lib/assessment/team-dynamics-final-aggregation-persistence.ts");
const {
  loadTeamDynamicsFinalAggregationVerification,
} = require("../lib/assessment/team-dynamics-final-aggregation-read.ts");
const {
  loadTeamDynamicsReportSelectionInclusionState,
  replaceTeamDynamicsReportSelectionInclusionSet,
} = require("../lib/b2b/team-dynamics-report-selection-inclusion.ts");
const {
  queueTeamDynamicsReportShell,
  processTeamDynamicsExecutiveOverviewWithOpenAI,
} = require("../lib/b2b/team-dynamics-report-lifecycle.ts");
const {
  getAiReportReasoningEffortForModel,
} = require("../lib/assessment/report-config.ts");
const {
  shouldOmitOpenAiTemperature,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  createSupabaseAdminClient,
} = require("../lib/supabase/admin.ts");

const expectedAggregation = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "fixtures/golden-demo/partner-plus/v1/team-dynamics-gdt-01-expected-aggregation.json"),
  "utf8",
)).aggregation;

function parseApply(argv) {
  const allowed = new Set(["--apply"]);
  for (const argument of argv) {
    if (!allowed.has(argument)) throw new Error(`Unsupported argument: ${argument}`);
  }
  return argv.includes("--apply");
}

function unique(values) {
  return new Set(values).size === values.length;
}

function exactAggregation(actual) {
  assert.equal(actual.status, "ready");
  assert.equal(actual.participantCount, expectedAggregation.participantCount);
  assert.equal(actual.completedParticipantCount, expectedAggregation.completedParticipantCount);
  assert.equal(actual.incompleteMemberCount, 0);
  assert.equal(actual.readyScoredMemberCount, expectedAggregation.readyScoredMemberCount);
  assert.equal(actual.missingScoreCount, 0);
  assert.equal(actual.invalidScoreCount, 0);
  assert.deepEqual(actual.issues, []);
  assert.deepEqual(actual.scoreEntryAggregations, expectedAggregation.scoreEntryAggregations);
  assert.deepEqual(actual.tdmDomainAggregations, expectedAggregation.tdmDomainAggregations);
  assert.deepEqual(actual.psychologicalSafetyAggregationEntry, expectedAggregation.psychologicalSafetyAggregationEntry);
  assert.deepEqual(actual.sjtAggregationEntry, expectedAggregation.sjtAggregationEntry);
  assert.deepEqual(actual.outcomePulseAggregationEntry, expectedAggregation.outcomePulseAggregationEntry);
  assert.equal(actual.scoreEntryAggregations.length, 8);
  assert.equal(unique(actual.scoreEntryAggregations.map((entry) => entry.scoreKey)), true);
  return true;
}

function mapFinalAggregationToQueueVerification(finalAggregation) {
  return {
    teamAssessmentAssignmentId: finalAggregation.teamAssessmentAssignmentId,
    aggregationVersion: finalAggregation.aggregationVersion,
    exists: finalAggregation.status !== "not_found",
    aggregationSnapshotId: finalAggregation.aggregationSnapshotId ?? null,
    teamId: finalAggregation.teamId ?? null,
    aggregationStatus: finalAggregation.status === "ready" ? "ready" : "not_ready",
    sourceScoringVersion: finalAggregation.scoringVersion ?? null,
    participantCount: finalAggregation.participantCount ?? null,
    completedParticipantCount: finalAggregation.completedParticipantCount ?? null,
    includedScoreCount: finalAggregation.readyScoredMemberCount ?? null,
    excludedScoreCount:
      typeof finalAggregation.incompleteMemberCount === "number" &&
      typeof finalAggregation.missingScoreCount === "number" &&
      typeof finalAggregation.invalidScoreCount === "number"
        ? finalAggregation.incompleteMemberCount +
          finalAggregation.missingScoreCount +
          finalAggregation.invalidScoreCount
        : null,
    missingCompletedScoreParticipantIds: finalAggregation.missingScoreParticipantIds ?? [],
    sourceScoreSnapshotIds: finalAggregation.sourceScoreSnapshotIds ?? [],
    meanScore0To100: finalAggregation.meanScore0To100 ?? null,
    minScore0To100: finalAggregation.minScore0To100 ?? null,
    maxScore0To100: finalAggregation.maxScore0To100 ?? null,
    rangeScore0To100: finalAggregation.rangeScore0To100 ?? null,
    calculatedAt: finalAggregation.calculatedAt ?? null,
    updatedAt: finalAggregation.updatedAt ?? null,
    verificationStatus:
      finalAggregation.status === "ready"
        ? "verified"
        : finalAggregation.status === "not_found"
          ? "missing"
          : "invalid",
    reasons: finalAggregation.reasons ?? [],
  };
}

async function resolveTarget(supabase) {
  const { data: organizations, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, status")
    .eq("name", GDT_01_ORGANIZATION_NAME);
  if (organizationError) throw new Error(`Failed to resolve GDT-01 organization: ${organizationError.message}`);
  if (!organizations || organizations.length !== 1) {
    throw new Error(`Expected exactly one GDT-01 organization, found ${organizations?.length ?? 0}.`);
  }
  const organization = organizations[0];

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id, organization_id, name, archived_at")
    .eq("organization_id", organization.id)
    .eq("name", GDT_01_TEAM_NAME);
  if (teamError) throw new Error(`Failed to resolve GDT-01 team: ${teamError.message}`);
  if (!teams || teams.length !== 1) throw new Error(`Expected exactly one GDT-01 team, found ${teams?.length ?? 0}.`);
  const team = teams[0];
  if (team.archived_at) throw new Error("GDT-01 team is archived.");

  const { data: assignments, error: assignmentError } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug, status")
    .eq("team_id", team.id)
    .eq("package_slug", GDT_01_PACKAGE_SLUG);
  if (assignmentError) throw new Error(`Failed to resolve GDT-01 assignment: ${assignmentError.message}`);
  if (!assignments || assignments.length !== 1) {
    throw new Error(`Expected exactly one active GDT-01 assignment, found ${assignments?.length ?? 0}.`);
  }
  const assignment = assignments[0];
  if (assignment.status !== "active") throw new Error(`GDT-01 assignment is not active: ${assignment.status}.`);
  return { organization, team, assignment };
}

async function countAggregationSnapshots(supabase, assignmentId) {
  const { count, error } = await supabase
    .from("team_assessment_aggregation_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("team_assessment_assignment_id", assignmentId)
    .eq("aggregation_version", TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION);
  if (error) throw new Error(`Failed to count GDT-01 aggregation snapshots: ${error.message}`);
  return count ?? 0;
}

async function inspectMembersAndDuplicates(supabase, assignmentId) {
  const { data: participants, error: participantError } = await supabase
    .from("team_assessment_participants")
    .select("id, participant_id, status")
    .eq("team_assessment_assignment_id", assignmentId);
  if (participantError) throw new Error(`Failed to load GDT-01 members: ${participantError.message}`);
  if (!participants || participants.length !== 6) throw new Error(`Expected 6 GDT-01 members, found ${participants?.length ?? 0}.`);
  if (!unique(participants.map((participant) => participant.id))) throw new Error("Duplicate GDT-01 assignment participant rows detected.");
  if (participants.some((participant) => participant.status !== "completed")) throw new Error("GDT-01 contains a non-completed member.");

  const { data: scores, error: scoreError } = await supabase
    .from("team_assessment_participant_scores")
    .select("id, team_assessment_participant_id, scoring_version, scoring_status")
    .in("team_assessment_participant_id", participants.map((participant) => participant.id))
    .eq("scoring_version", TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION);
  if (scoreError) throw new Error(`Failed to load GDT-01 member scores: ${scoreError.message}`);
  if (!scores || scores.length !== 6) throw new Error(`Expected 6 GDT-01 member scores, found ${scores?.length ?? 0}.`);
  if (!unique(scores.map((score) => score.id))) throw new Error("Duplicate GDT-01 score snapshot IDs detected.");
  if (!unique(scores.map((score) => score.team_assessment_participant_id))) throw new Error("Duplicate GDT-01 score rows per member detected.");
  if (scores.some((score) => score.scoring_status !== "scored")) throw new Error("GDT-01 contains a non-scored member score.");
  return { participants, scores };
}

async function loadReportRows(supabase, assignmentId) {
  const { data, error } = await supabase
    .from("team_assessment_reports")
    .select("id, report_status")
    .eq("team_assessment_assignment_id", assignmentId);
  if (error) throw new Error(`Failed to inspect existing GDT-01 reports: ${error.message}`);
  return data ?? [];
}

async function preflight(supabase) {
  const target = await resolveTarget(supabase);
  const members = await inspectMembersAndDuplicates(supabase, target.assignment.id);
  const beforeSnapshotCount = await countAggregationSnapshots(supabase, target.assignment.id);
  if (beforeSnapshotCount > 1) throw new Error(`Duplicate GDT-01 aggregation snapshots detected: ${beforeSnapshotCount}.`);
  const reportRows = await loadReportRows(supabase, target.assignment.id);
  if (reportRows.length > 0) throw new Error(`Existing GDT-01 report rows would create a duplicate lifecycle: ${reportRows.length}.`);

  const aggregation = await loadTeamDynamicsFinalAggregation({
    teamAssessmentAssignmentId: target.assignment.id,
    aggregationVersion: TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
    scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
  }, { supabase });
  exactAggregation(aggregation);

  const expectedEnv = {
    provider: process.env.AI_REPORT_PROVIDER,
    model: process.env.AI_REPORT_MODEL,
    reasoningEffort: process.env.AI_REPORT_REASONING_EFFORT,
  };
  assert.equal(expectedEnv.provider, "openai");
  assert.equal(expectedEnv.model, "gpt-5.6-sol");
  assert.equal(expectedEnv.reasoningEffort, "medium");

  return { target, members, aggregation, beforeSnapshotCount, expectedEnv };
}

async function apply(supabase, state) {
  const persisted = await persistTeamDynamicsFinalAggregationSnapshot({
    teamAssessmentAssignmentId: state.target.assignment.id,
    aggregationVersion: TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
    scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
  }, { supabase });
  if (!persisted.ok || persisted.value.aggregationStatus !== "ready") {
    throw new Error(`GDT-01 aggregation persistence failed: ${persisted.reason ?? persisted.value?.aggregationStatus ?? "unknown"}.`);
  }

  const persistedAggregation = await loadTeamDynamicsFinalAggregation({
    teamAssessmentAssignmentId: state.target.assignment.id,
    aggregationVersion: TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
    scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
  }, { supabase });
  exactAggregation(persistedAggregation);
  const afterSnapshotCount = await countAggregationSnapshots(supabase, state.target.assignment.id);
  if (afterSnapshotCount !== 1) throw new Error(`Expected exactly one GDT-01 aggregation snapshot after apply, found ${afterSnapshotCount}.`);

  const participantIds = state.members.participants.map((participant) => participant.id).sort();
  const selection = await loadTeamDynamicsReportSelectionInclusionState({
    organizationId: state.target.organization.id,
    teamId: state.target.team.id,
    teamAssessmentAssignmentId: state.target.assignment.id,
  }, { supabase });
  const selectedIds = [...selection.includedTeamAssessmentParticipantIds].sort();
  const selectionDraftId = selection.hasPersistedSelectionDraft && JSON.stringify(selectedIds) === JSON.stringify(participantIds)
    ? selection.selectionDraftId
    : (await replaceTeamDynamicsReportSelectionInclusionSet({
        organizationId: state.target.organization.id,
        teamId: state.target.team.id,
        teamAssessmentAssignmentId: state.target.assignment.id,
        includedTeamAssessmentParticipantIds: participantIds,
        actorUserId: null,
      }, { supabase })).selectionDraftId;

  const queued = await queueTeamDynamicsReportShell({
    organizationId: state.target.organization.id,
    teamId: state.target.team.id,
    teamAssessmentAssignmentId: state.target.assignment.id,
    selectionDraftId,
  }, {
    supabase,
    loadAggregationVerification: async (input, deps) =>
      mapFinalAggregationToQueueVerification(
        await loadTeamDynamicsFinalAggregationVerification(input, deps),
      ),
  });
  if (!queued.ok) throw new Error(`GDT-01 Executive Overview queue failed: ${queued.reason}.`);

  const processed = await processTeamDynamicsExecutiveOverviewWithOpenAI({
    teamAssessmentReportId: queued.report.id,
    organizationId: state.target.organization.id,
  }, {
    supabase,
    executiveOverviewOpenAiOptions: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.AI_REPORT_MODEL,
    },
  });

  return {
    afterSnapshotCount,
    persistedMode: persisted.mode,
    processed,
    reportId: queued.report.id,
  };
}

async function main() {
  const applyRequested = parseApply(process.argv.slice(2));
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));
  const supabase = createSupabaseAdminClient();
  const state = await preflight(supabase);
  const result = {
    mode: applyRequested ? "apply" : "preflight",
    assignmentId: state.target.assignment.id,
    teamId: state.target.team.id,
    aggregation: "EXACT_8_OF_8",
    aggregationEntries: state.aggregation.scoreEntryAggregations.length,
    snapshotCountBefore: state.beforeSnapshotCount,
    snapshotCountAfter: state.beforeSnapshotCount,
    duplicateCheck: "PASS",
    ai: null,
  };

  if (applyRequested) {
    if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY; apply stopped before DB write/OpenAI call.");
    const applied = await apply(supabase, state);
    result.snapshotCountAfter = applied.afterSnapshotCount;
    result.ai = {
      status: applied.processed.ok ? applied.processed.finalStatus : applied.processed.operation,
      reportId: applied.reportId,
      model: applied.processed.provider?.modelName ?? process.env.AI_REPORT_MODEL,
      reasoningEffort: getAiReportReasoningEffortForModel(process.env.AI_REPORT_MODEL),
      temperatureOmitted: shouldOmitOpenAiTemperature(process.env.AI_REPORT_MODEL),
      provider: applied.processed.provider?.provider ?? "openai",
      providerResult: applied.processed.provider?.code ?? null,
    };
    if (!applied.processed.ok) throw new Error(`GDT-01 Executive Overview lifecycle failed: ${applied.processed.reason}.`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  process.exitCode = 1;
});
