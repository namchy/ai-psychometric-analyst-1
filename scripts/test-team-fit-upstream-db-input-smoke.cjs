const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
const FORBIDDEN_KEYS = [
  "rawAnswers",
  "rawResponses",
  "individualAnswers",
  "memberScores",
  "individualScores",
  "fullSnapshot",
  "rawItemText",
  "candidateFacing",
  "candidateFacingOutput",
  "fitScore",
  "score0To100",
  "hireRecommendation",
  "noHireRecommendation",
];

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

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

function buildSkipResult(reason, extra = {}) {
  return {
    ok: false,
    skipped: true,
    reason,
    ...extra,
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertForbiddenKeysAbsent(value, label) {
  const serialized = JSON.stringify(value);

  FORBIDDEN_KEYS.forEach((key) => {
    assert.equal(
      serialized.includes(`"${key}"`),
      false,
      `${label} must not contain forbidden key ${key}.`,
    );
  });
}

async function safeDeleteByIds(supabase, table, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return;
  }

  const { error } = await supabase.from(table).delete().in("id", ids);

  if (error) {
    console.warn(`Failed to cleanup ${table}: ${error.message}`);
  }
}

async function findCompositeReadyAssignment(supabase, buildCompositeHrInputSnapshot) {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, locale, created_at")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(`Failed to load assessment assignments: ${error.message}`);
  }

  for (const row of data ?? []) {
    try {
      const snapshot = await buildCompositeHrInputSnapshot({
        assessmentAssignmentId: row.id,
        organizationId: row.organization_id,
        participantId: row.participant_id,
        locale: row.locale ?? "bs",
      });

      return {
        assignment: row,
        compositeSnapshot: snapshot,
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function findReadyTeamAggregationSource(supabase, loadTeamDynamicsFinalAggregationVerification) {
  const { data, error } = await supabase
    .from("team_assessment_aggregation_snapshots")
    .select(
      "id, team_assessment_assignment_id, team_id, aggregation_version, aggregation_status, source_scoring_version, source_score_snapshot_ids, participant_count, completed_participant_count, included_score_count, excluded_score_count, missing_completed_score_participant_ids, mean_score_0_100, min_score_0_100, max_score_0_100, range_score_0_100, aggregation_snapshot, calculated_at, created_at",
    )
    .eq("aggregation_status", "ready")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`Failed to load Team Dynamics aggregation snapshots: ${error.message}`);
  }

  for (const row of data ?? []) {
    const verification = await loadTeamDynamicsFinalAggregationVerification({
      teamAssessmentAssignmentId: row.team_assessment_assignment_id,
      aggregationVersion: row.aggregation_version,
    });

    if (verification.status === "ready") {
      return {
        sourceRow: row,
        verification,
      };
    }
  }

  return null;
}

async function loadCompositeReportRowsForAssignment(supabase, assessmentAssignmentId) {
  const { data, error } = await supabase
    .from("assessment_reports")
    .select("id, report_type, audience, report_status, generator_type")
    .eq("assessment_assignment_id", assessmentAssignmentId)
    .eq("report_type", "composite")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to inspect composite assessment_reports: ${error.message}`);
  }

  return data ?? [];
}

async function createTempTeam(supabase, organizationId, token) {
  const { data, error } = await supabase
    .from("teams")
    .insert({
      organization_id: organizationId,
      name: `Team Fit Upstream Smoke ${token}`,
      description: "Temporary same-org Team Fit upstream wiring smoke team",
      created_by_user_id: null,
    })
    .select("id, organization_id, name")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create temporary smoke team: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

async function createTempTeamAssessmentAssignment(supabase, teamId) {
  const { data, error } = await supabase
    .from("team_assessment_assignments")
    .insert({
      team_id: teamId,
      package_slug: "team_dynamics_assessment_v1",
      status: "reported",
      created_by_user_id: null,
    })
    .select("id, team_id, package_slug, status")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Failed to create temporary Team Dynamics assignment for smoke: ${error?.message ?? "unknown error"}`,
    );
  }

  return data;
}

async function createClonedAggregationSnapshot(supabase, input) {
  const clonedAggregationSnapshot = {
    ...(input.sourceRow.aggregation_snapshot ?? {}),
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    aggregationVersion: input.sourceRow.aggregation_version,
    ...(input.aggregationSnapshotOverrides ?? {}),
  };

  const { data, error } = await supabase
    .from("team_assessment_aggregation_snapshots")
    .insert({
      team_assessment_assignment_id: input.teamAssessmentAssignmentId,
      team_id: input.teamId,
      aggregation_version: input.sourceRow.aggregation_version,
      aggregation_status: input.sourceRow.aggregation_status,
      source_scoring_version: input.sourceRow.source_scoring_version,
      source_score_snapshot_ids: input.sourceRow.source_score_snapshot_ids ?? [],
      participant_count: input.rowOverrides?.participant_count ?? input.sourceRow.participant_count,
      completed_participant_count:
        input.rowOverrides?.completed_participant_count ??
        input.sourceRow.completed_participant_count,
      included_score_count:
        input.rowOverrides?.included_score_count ?? input.sourceRow.included_score_count,
      excluded_score_count:
        input.rowOverrides?.excluded_score_count ?? input.sourceRow.excluded_score_count,
      missing_completed_score_participant_ids:
        input.rowOverrides?.missing_completed_score_participant_ids ??
        input.sourceRow.missing_completed_score_participant_ids ??
        [],
      mean_score_0_100: input.rowOverrides?.mean_score_0_100 ?? input.sourceRow.mean_score_0_100,
      min_score_0_100: input.rowOverrides?.min_score_0_100 ?? input.sourceRow.min_score_0_100,
      max_score_0_100: input.rowOverrides?.max_score_0_100 ?? input.sourceRow.max_score_0_100,
      range_score_0_100:
        input.rowOverrides?.range_score_0_100 ?? input.sourceRow.range_score_0_100,
      aggregation_snapshot: clonedAggregationSnapshot,
      calculated_at: input.sourceRow.calculated_at,
    })
    .select("id, team_assessment_assignment_id, team_id, aggregation_version, aggregation_status")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Failed to clone Team Dynamics aggregation snapshot for smoke: ${error?.message ?? "unknown error"}`,
    );
  }

  return data;
}

async function queueSmokeReportShell(input) {
  const result = await input.queueTeamFitReportShell({
    organizationId: input.organizationId,
    teamId: input.teamId,
    participantId: input.participantId,
    candidateSourceType: input.TEAM_FIT_CANDIDATE_SOURCE_TYPE,
    candidateSourceId: input.candidateSourceId,
    teamSourceType: input.TEAM_FIT_TEAM_SOURCE_TYPE,
    teamSourceId: input.teamSourceId,
    optionalContext: { locale: "bs" },
    createdBy: null,
  });

  if (!result.ok) {
    throw new Error(`Failed to queue Team Fit smoke shell: ${result.message}`);
  }

  return result;
}

async function main() {
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      JSON.stringify(
        buildSkipResult("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", {
          tested: "script wiring only",
          skipped_target: "Team Fit upstream DB-backed input smoke",
        }),
        null,
        2,
      ),
    );
    return;
  }

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const {
    buildCompositeHrInputSnapshot,
  } = require("../lib/assessment/composite-input.ts");
  const {
    loadTeamDynamicsFinalAggregationVerification,
  } = require("../lib/assessment/team-dynamics-final-aggregation-read.ts");
  const {
    queueTeamFitReportShell,
    TEAM_FIT_CANDIDATE_SOURCE_TYPE,
    TEAM_FIT_TEAM_SOURCE_TYPE,
  } = require("../lib/b2b/team-fit-report-lifecycle.ts");
  const {
    buildTeamFitReportInputSnapshot,
    TEAM_FIT_REPORT_INPUT_VERSION,
  } = require("../lib/b2b/team-fit-report-input.ts");

  const supabase = createSupabaseAdminClient();
  const token = crypto.randomUUID().slice(0, 8);
  const cleanup = {
    teamIds: [],
    assignmentIds: [],
    snapshotIds: [],
    reportIds: [],
  };

  try {
    const candidateSource = await findCompositeReadyAssignment(
      supabase,
      buildCompositeHrInputSnapshot,
    );

    assert.ok(candidateSource, "Expected at least one real assessment_assignment to build composite input.");

    const teamSource = await findReadyTeamAggregationSource(
      supabase,
      loadTeamDynamicsFinalAggregationVerification,
    );

    assert.ok(teamSource, "Expected at least one ready Team Dynamics aggregation snapshot in local DB.");

    const compositeReportRows = await loadCompositeReportRowsForAssignment(
      supabase,
      candidateSource.assignment.id,
    );

    const tempTeam = await createTempTeam(
      supabase,
      candidateSource.assignment.organization_id,
      token,
    );
    cleanup.teamIds.push(tempTeam.id);

    const tempTeamAssignment = await createTempTeamAssessmentAssignment(
      supabase,
      tempTeam.id,
    );
    cleanup.assignmentIds.push(tempTeamAssignment.id);

    const clonedSnapshot = await createClonedAggregationSnapshot(supabase, {
      teamAssessmentAssignmentId: tempTeamAssignment.id,
      teamId: tempTeam.id,
      sourceRow: teamSource.sourceRow,
    });
    cleanup.snapshotIds.push(clonedSnapshot.id);

    const partialTeamAssignment = await createTempTeamAssessmentAssignment(
      supabase,
      tempTeam.id,
    );
    cleanup.assignmentIds.push(partialTeamAssignment.id);

    const partialSnapshot = await createClonedAggregationSnapshot(supabase, {
      teamAssessmentAssignmentId: partialTeamAssignment.id,
      teamId: tempTeam.id,
      sourceRow: teamSource.sourceRow,
      rowOverrides: {
        included_score_count: Math.max((teamSource.sourceRow.included_score_count ?? 1) - 1, 0),
        excluded_score_count: (teamSource.sourceRow.excluded_score_count ?? 0) + 1,
      },
      aggregationSnapshotOverrides: {
        teamAssessmentAssignmentId: partialTeamAssignment.id,
        readyScoredMemberCount: Math.max(
          (teamSource.verification.readyScoredMemberCount ?? 1) - 1,
          0,
        ),
        missingScoreCount: 1,
        missingScoreParticipantIds: ["partial-member-placeholder"],
        reasons: ["partial_aggregation_detected_missing_scores"],
      },
    });
    cleanup.snapshotIds.push(partialSnapshot.id);

    const clonedVerification = await loadTeamDynamicsFinalAggregationVerification({
      teamAssessmentAssignmentId: tempTeamAssignment.id,
      aggregationVersion: clonedSnapshot.aggregation_version,
    });

    assert.equal(clonedVerification.status, "ready");
    assert.equal(clonedVerification.aggregationSnapshotId, clonedSnapshot.id);
    assert.equal(clonedVerification.incompleteMemberCount, 0);
    assert.equal(clonedVerification.missingScoreCount, 0);
    assert.equal(clonedVerification.invalidScoreCount, 0);

    const partialVerification = await loadTeamDynamicsFinalAggregationVerification({
      teamAssessmentAssignmentId: partialTeamAssignment.id,
      aggregationVersion: partialSnapshot.aggregation_version,
    });

    assert.equal(partialVerification.status, "invalid");
    assert.equal(partialVerification.aggregationSnapshotId, partialSnapshot.id);

    const assignmentSourceShell = await queueSmokeReportShell({
      queueTeamFitReportShell,
      organizationId: candidateSource.assignment.organization_id,
      teamId: tempTeam.id,
      participantId: candidateSource.assignment.participant_id,
      candidateSourceId: candidateSource.assignment.id,
      teamSourceId: tempTeamAssignment.id,
      TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      TEAM_FIT_TEAM_SOURCE_TYPE,
    });
    cleanup.reportIds.push(assignmentSourceShell.reportId);

    const assignmentBuilt = await buildTeamFitReportInputSnapshot({
      teamFitReportId: assignmentSourceShell.reportId,
      organizationId: candidateSource.assignment.organization_id,
    });

    assert.equal(assignmentBuilt.ok, true);
    assert.equal(assignmentBuilt.inputSnapshot.inputVersion, TEAM_FIT_REPORT_INPUT_VERSION);
    assert.equal(assignmentBuilt.inputSnapshot.candidateSignals.sourceStatus, "available");
    assert.equal(
      assignmentBuilt.inputSnapshot.teamSignals.sourceStatus,
      "available",
      JSON.stringify(assignmentBuilt.inputSnapshot.teamSignals, null, 2),
    );
    assert.ok(
      (assignmentBuilt.inputSnapshot.candidateSignals.summary?.personalityHighestDomains?.length ?? 0) >
        0,
    );
    assert.ok(
      (assignmentBuilt.inputSnapshot.candidateSignals.collaborationRelevantSignals?.length ?? 0) > 0,
    );
    assert.ok(isNonEmptyString(assignmentBuilt.inputSnapshot.teamSignals.summary?.aggregationStatus));
    assert.ok((assignmentBuilt.inputSnapshot.teamSignals.coreSignals?.length ?? 0) > 0);
    assert.deepEqual(
      assignmentBuilt.inputSnapshot.relationshipReasoningGuardrails.allowedPatterns,
      ["alignment_signal", "complementarity_signal", "mixed_signal", "needs_validation"],
    );
    assert.equal(
      assignmentBuilt.inputSnapshot.candidateSignals.sourceMetadata?.assessmentAssignmentId,
      candidateSource.assignment.id,
    );
    assert.equal(
      assignmentBuilt.inputSnapshot.teamSignals.sourceMetadata?.aggregationSnapshotId,
      clonedSnapshot.id,
    );
    assert.equal(
      assignmentBuilt.inputSnapshot.teamSignals.sourceMetadata?.teamAssessmentAssignmentId,
      tempTeamAssignment.id,
    );

    const snapshotSourceShell = await queueSmokeReportShell({
      queueTeamFitReportShell,
      organizationId: candidateSource.assignment.organization_id,
      teamId: tempTeam.id,
      participantId: candidateSource.assignment.participant_id,
      candidateSourceId: candidateSource.assignment.id,
      teamSourceId: clonedSnapshot.id,
      TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      TEAM_FIT_TEAM_SOURCE_TYPE,
    });
    cleanup.reportIds.push(snapshotSourceShell.reportId);

    const snapshotBuilt = await buildTeamFitReportInputSnapshot({
      teamFitReportId: snapshotSourceShell.reportId,
      organizationId: candidateSource.assignment.organization_id,
    });

    assert.equal(snapshotBuilt.ok, true);
    assert.equal(snapshotBuilt.inputSnapshot.inputVersion, TEAM_FIT_REPORT_INPUT_VERSION);
    assert.equal(snapshotBuilt.inputSnapshot.candidateSignals.sourceStatus, "available");
    assert.equal(
      snapshotBuilt.inputSnapshot.teamSignals.sourceStatus,
      "available",
      JSON.stringify(snapshotBuilt.inputSnapshot.teamSignals, null, 2),
    );
    assert.equal(
      snapshotBuilt.inputSnapshot.teamSignals.sourceMetadata?.aggregationSnapshotId,
      clonedSnapshot.id,
    );
    assert.equal(
      snapshotBuilt.inputSnapshot.teamSignals.sourceMetadata?.teamAssessmentAssignmentId,
      tempTeamAssignment.id,
    );

    assertForbiddenKeysAbsent(assignmentBuilt.inputSnapshot, "Team Fit upstream input snapshot");
    assertForbiddenKeysAbsent(snapshotBuilt.inputSnapshot, "Team Fit upstream input snapshot");
    assert.equal(
      JSON.stringify(snapshotBuilt.inputSnapshot).includes("assessment_reports"),
      false,
      "Input snapshot must not require composite assessment_reports artefact references.",
    );

    const wrongCandidateShell = await queueSmokeReportShell({
      queueTeamFitReportShell,
      organizationId: candidateSource.assignment.organization_id,
      teamId: tempTeam.id,
      participantId: candidateSource.assignment.participant_id,
      candidateSourceId: crypto.randomUUID(),
      teamSourceId: tempTeamAssignment.id,
      TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      TEAM_FIT_TEAM_SOURCE_TYPE,
    });
    cleanup.reportIds.push(wrongCandidateShell.reportId);

    const wrongCandidateBuilt = await buildTeamFitReportInputSnapshot({
      teamFitReportId: wrongCandidateShell.reportId,
      organizationId: candidateSource.assignment.organization_id,
    });

    assert.equal(wrongCandidateBuilt.ok, true);
    assert.notEqual(wrongCandidateBuilt.inputSnapshot.candidateSignals.sourceStatus, "available");

    const missingTeamShell = await queueSmokeReportShell({
      queueTeamFitReportShell,
      organizationId: candidateSource.assignment.organization_id,
      teamId: tempTeam.id,
      participantId: candidateSource.assignment.participant_id,
      candidateSourceId: candidateSource.assignment.id,
      teamSourceId: crypto.randomUUID(),
      TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      TEAM_FIT_TEAM_SOURCE_TYPE,
    });
    cleanup.reportIds.push(missingTeamShell.reportId);

    const missingTeamBuilt = await buildTeamFitReportInputSnapshot({
      teamFitReportId: missingTeamShell.reportId,
      organizationId: candidateSource.assignment.organization_id,
    });

    assert.equal(missingTeamBuilt.ok, true);
    assert.equal(missingTeamBuilt.inputSnapshot.teamSignals.sourceStatus, "source_unavailable");

    const partialTeamShell = await queueSmokeReportShell({
      queueTeamFitReportShell,
      organizationId: candidateSource.assignment.organization_id,
      teamId: tempTeam.id,
      participantId: candidateSource.assignment.participant_id,
      candidateSourceId: candidateSource.assignment.id,
      teamSourceId: partialSnapshot.id,
      TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      TEAM_FIT_TEAM_SOURCE_TYPE,
    });
    cleanup.reportIds.push(partialTeamShell.reportId);

    const partialTeamBuilt = await buildTeamFitReportInputSnapshot({
      teamFitReportId: partialTeamShell.reportId,
      organizationId: candidateSource.assignment.organization_id,
    });

    assert.equal(partialTeamBuilt.ok, true);
    assert.equal(partialTeamBuilt.inputSnapshot.teamSignals.sourceStatus, "source_invalid");

    console.log(
      JSON.stringify(
        {
          ok: true,
          reportInputVersion: assignmentBuilt.inputSnapshot.inputVersion,
          candidateSource: {
            assessmentAssignmentId: candidateSource.assignment.id,
            compositeInputAvailable: true,
            compositeReportRowsObserved: compositeReportRows.length,
          },
          teamSource: {
            originalAggregationSnapshotId: teamSource.sourceRow.id,
            clonedAggregationSnapshotId: clonedSnapshot.id,
            teamAssessmentAssignmentId: tempTeamAssignment.id,
            builderSourceIdUsed: {
              assignmentId: tempTeamAssignment.id,
              aggregationSnapshotId: clonedSnapshot.id,
            },
            verificationStatus: clonedVerification.status,
          },
          positivePaths: {
            assignmentSourceStatus: assignmentBuilt.inputSnapshot.teamSignals.sourceStatus,
            snapshotSourceStatus: snapshotBuilt.inputSnapshot.teamSignals.sourceStatus,
          },
          negativeChecks: {
            wrongCandidateSourceStatus: wrongCandidateBuilt.inputSnapshot.candidateSignals.sourceStatus,
            missingTeamSourceStatus: missingTeamBuilt.inputSnapshot.teamSignals.sourceStatus,
            partialSnapshotSourceStatus: partialTeamBuilt.inputSnapshot.teamSignals.sourceStatus,
          },
          privacyScan: {
            forbiddenKeysAbsent: true,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await safeDeleteByIds(supabase, "team_fit_reports", cleanup.reportIds);
    await safeDeleteByIds(
      supabase,
      "team_assessment_aggregation_snapshots",
      cleanup.snapshotIds,
    );
    await safeDeleteByIds(supabase, "team_assessment_assignments", cleanup.assignmentIds);
    await safeDeleteByIds(supabase, "teams", cleanup.teamIds);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
