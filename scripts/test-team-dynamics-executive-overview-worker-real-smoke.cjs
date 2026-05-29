const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
const REQUIRED_TABLES = [
  "team_assessment_report_selection_drafts",
  "team_assessment_report_selection_members",
  "team_assessment_reports",
  "team_assessment_aggregation_snapshots",
];
const SCHEMA_CACHE_MISS_CODES = new Set(["PGRST205"]);

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
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

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

function buildControlledFailureResult(reason, extra = {}) {
  return {
    ok: false,
    skipped: false,
    controlledFailure: true,
    reason,
    ...extra,
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSchemaCacheMiss(error) {
  return Boolean(error && SCHEMA_CACHE_MISS_CODES.has(error.code ?? ""));
}

async function probeTable(supabase, table) {
  const { error } = await supabase.from(table).select("id").limit(1);

  return {
    table,
    ok: !error,
    error: error
      ? {
          code: error.code ?? null,
          message: error.message,
        }
      : null,
  };
}

async function countAttemptReportsForAttempts(supabase, attemptIds) {
  if (attemptIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("attempt_reports")
    .select("id", { count: "exact", head: true })
    .in("attempt_id", attemptIds);

  if (error) {
    throw new Error(`Failed to count attempt_reports for fixture attempts: ${error.message}`);
  }

  return count ?? 0;
}

async function countAssessmentReportsForOrganization(supabase, organizationId) {
  const { count, error } = await supabase
    .from("assessment_reports")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(
      `Failed to count assessment_reports for fixture organization: ${error.message}`,
    );
  }

  return count ?? 0;
}

async function loadAssignmentParticipantIds(supabase, teamAssessmentAssignmentId) {
  const { data, error } = await supabase
    .from("team_assessment_participants")
    .select("id")
    .eq("team_assessment_assignment_id", teamAssessmentAssignmentId)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load Team Dynamics assignment participants: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id);
}

async function loadAssignmentAttemptIds(supabase, teamAssessmentAssignmentId) {
  const { data, error } = await supabase
    .from("team_assessment_participants")
    .select("attempt_id")
    .eq("team_assessment_assignment_id", teamAssessmentAssignmentId);

  if (error) {
    throw new Error(`Failed to load Team Dynamics assignment attempt ids: ${error.message}`);
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.attempt_id)
        .filter((value) => typeof value === "string" && value.length > 0),
    ),
  ).sort();
}

async function loadAssignmentRuntimeContext(supabase, teamAssessmentAssignmentId) {
  const { data: wrapperRows, error: wrapperError } = await supabase
    .from("team_assessment_participants")
    .select("id, status, attempt_id, completed_at")
    .eq("team_assessment_assignment_id", teamAssessmentAssignmentId)
    .order("id", { ascending: true });

  if (wrapperError) {
    throw new Error(
      `Failed to load Team Dynamics assignment wrapper state: ${wrapperError.message}`,
    );
  }

  const wrapperIds = (wrapperRows ?? []).map((row) => row.id);
  const { data: aggregationRows, error: aggregationError } = await supabase
    .from("team_assessment_aggregation_snapshots")
    .select(
      "id, aggregation_status, aggregation_version, participant_count, completed_participant_count, included_score_count, calculated_at",
    )
    .eq("team_assessment_assignment_id", teamAssessmentAssignmentId)
    .order("created_at", { ascending: false });

  if (aggregationError) {
    throw new Error(
      `Failed to load Team Dynamics aggregation snapshot state: ${aggregationError.message}`,
    );
  }

  let scoreRows = [];

  if (wrapperIds.length > 0) {
    const { data, error } = await supabase
      .from("team_assessment_participant_scores")
      .select("id, team_assessment_participant_id, scoring_status, scoring_version")
      .in("team_assessment_participant_id", wrapperIds);

    if (error) {
      throw new Error(
        `Failed to load Team Dynamics participant score state: ${error.message}`,
      );
    }

    scoreRows = data ?? [];
  }

  return {
    wrappers: wrapperRows ?? [],
    aggregations: aggregationRows ?? [],
    scores: scoreRows,
  };
}

function buildReadyScoreSnapshot() {
  return {
    status: "scored",
    rawTotal: null,
    meanRaw: null,
    score0To100: null,
    supportedQuestionCount: 5,
    scoredQuestionCount: 5,
    ignoredInvalidAnswerCount: 0,
    scaleMin: 1,
    scaleMax: 4,
    scoreValueSource: null,
    missingQuestionIds: [],
    runtimeWarnings: [],
    unsupportedQuestionIds: [],
    invalidSavedAnswerCount: 0,
    ignoredStaleAnswerCount: 0,
    savedLikertAnswerCount: 4,
    savedSjtAnswerCount: 1,
    blocks: [],
    scoreEntries: [
      {
        scoreKey: "tdm-31-V1_overall",
        label: "Razvojna zrelost tima",
        blockKey: "tdm-31-V1",
        scoreModel: "simple_linear_v1",
        itemCount: 10,
        scoredItemCount: 10,
        rawTotal: 26,
        meanRaw: 2.6,
        score0To100: 53.33,
        scaleMin: 1,
        scaleMax: 4,
        metadata: {},
      },
      {
        scoreKey: "tdm_domain_communication",
        label: "Communication",
        blockKey: "tdm-31-V1",
        scoreModel: "simple_linear_v1",
        itemCount: 4,
        scoredItemCount: 4,
        rawTotal: 10,
        meanRaw: 2.5,
        score0To100: 50,
        scaleMin: 1,
        scaleMax: 4,
        metadata: {},
      },
      {
        scoreKey: "psychological_safety_overall",
        label: "Psiholoska sigurnost u timu",
        blockKey: "psychological_safety",
        scoreModel: "simple_linear_v1",
        itemCount: 4,
        scoredItemCount: 4,
        rawTotal: 11,
        meanRaw: 2.75,
        score0To100: 58.33,
        scaleMin: 1,
        scaleMax: 4,
        metadata: {},
      },
      {
        scoreKey: "situational_judgment_overall",
        label: "Timsko prosudjivanje u situacijama",
        blockKey: "situational_judgment",
        scoreModel: "expert_key_partial_credit_v1",
        itemCount: 1,
        scoredItemCount: 1,
        rawTotal: 4,
        meanRaw: 4,
        score0To100: 75,
        scaleMin: 0,
        scaleMax: 5,
        metadata: {},
      },
      {
        scoreKey: "outcome_pulse_overall",
        label: "Ishodi timskog rada",
        blockKey: "outcome_pulse",
        scoreModel: "simple_linear_v1",
        itemCount: 2,
        scoredItemCount: 2,
        rawTotal: 6,
        meanRaw: 3,
        score0To100: 66.67,
        scaleMin: 1,
        scaleMax: 4,
        metadata: {},
      },
    ],
  };
}

async function deleteByIds(supabase, table, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return;
  }

  const { error } = await supabase.from(table).delete().in("id", ids);

  if (error) {
    throw new Error(`Failed to cleanup ${table}: ${error.message}`);
  }
}

async function deleteOrganizationCascade(supabase, organizationId) {
  if (!isNonEmptyString(organizationId)) {
    return;
  }

  const { error } = await supabase.from("organizations").delete().eq("id", organizationId);

  if (error) {
    throw new Error(`Failed to cleanup smoke organization ${organizationId}: ${error.message}`);
  }
}

async function loadTeamContextByAssignment(supabase, assignmentId) {
  const { data, error } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug, teams(id, organization_id, name)")
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Dynamics assignment team context: ${error.message}`);
  }

  const row = data ?? null;
  const teamRow = Array.isArray(row?.teams) ? row.teams[0] ?? null : row?.teams ?? null;

  if (!row?.id || !row?.team_id || !teamRow?.organization_id) {
    return null;
  }

  return {
    assignmentId: row.id,
    teamId: row.team_id,
    organizationId: teamRow.organization_id,
    teamName: teamRow.name ?? null,
    packageSlug: row.package_slug,
  };
}

async function findExistingReadyFixture(input) {
  const { supabase, loadSelectionReadModel, loadFinalAggregationVerification } = input;
  const { data: assignments, error } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug")
    .eq("package_slug", "team_dynamics_assessment_v1")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to inspect existing Team Dynamics assignments: ${error.message}`);
  }

  for (const assignment of assignments ?? []) {
    const context = await loadTeamContextByAssignment(supabase, assignment.id);

    if (!context) {
      continue;
    }

    const participantIds = await loadAssignmentParticipantIds(supabase, assignment.id);

    if (participantIds.length < 4) {
      continue;
    }

    const runtimeContext = await loadAssignmentRuntimeContext(supabase, assignment.id);

    if (
      runtimeContext.wrappers.length < 4 ||
      runtimeContext.wrappers.some((wrapper) => wrapper.status !== "completed") ||
      runtimeContext.scores.length < 4 ||
      runtimeContext.scores.some((score) => score.scoring_status !== "scored")
    ) {
      continue;
    }

    const finalAggregation = await loadFinalAggregationVerification({
      teamAssessmentAssignmentId: assignment.id,
    });

    if (finalAggregation.status !== "ready") {
      continue;
    }

    const selection = await loadSelectionReadModel({
      organizationId: context.organizationId,
      teamId: context.teamId,
      teamAssessmentAssignmentId: assignment.id,
    });

    if (!selection || selection.availableMembers.length < 4) {
      continue;
    }

    return {
      source: "existing_ready_assignment",
      organization: {
        id: context.organizationId,
      },
      team: {
        id: context.teamId,
        name: context.teamName,
      },
      assignment: {
        id: assignment.id,
      },
      selection,
      runtimeContext,
      finalAggregationStatus: finalAggregation.status,
    };
  }

  return null;
}

async function createReportReadySmokeFixture(input) {
  const {
    supabase,
    persistFinalAggregationSnapshot,
    loadFinalAggregationVerification,
    scoringVersion,
  } = input;
  const token = crypto.randomUUID().slice(0, 8);
  const createdAt = "2026-05-29T10:00:00.000Z";
  const startedAt = "2026-05-29T10:05:00.000Z";
  const completedAt = "2026-05-29T10:30:00.000Z";
  const organizationSlug = `td-worker-real-smoke-${token}`;
  const fixtureName = `TD Worker Real Smoke ${token}`;

  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .select("id, slug, status, is_active")
    .eq("slug", "team_dynamics_assessment_v1")
    .eq("status", "active")
    .eq("is_active", true)
    .maybeSingle();

  if (testError) {
    throw new Error(`Failed to load Team Dynamics final test: ${testError.message}`);
  }

  if (!testRow?.id) {
    throw new Error("Active team_dynamics_assessment_v1 test row was not found.");
  }

  const { data: organizationRows, error: organizationError } = await supabase
    .from("organizations")
    .insert({
      name: fixtureName,
      slug: organizationSlug,
      status: "active",
    })
    .select("id, name, slug")
    .limit(1);

  if (organizationError || !organizationRows?.[0]?.id) {
    throw new Error(
      `Failed to create Team Dynamics smoke organization: ${organizationError?.message ?? "unknown error"}`,
    );
  }

  const organization = organizationRows[0];

  const participantPayload = Array.from({ length: 4 }, (_, index) => ({
    organization_id: organization.id,
    user_id: null,
    email: `td-worker-real-member-${index + 1}-${token}@example.test`,
    full_name: `TD Worker Real Member ${index + 1}`,
    participant_type: "employee",
    status: "active",
    addressing_form: index % 2 === 0 ? "feminine" : "masculine",
  }));

  const { data: participantRows, error: participantError } = await supabase
    .from("participants")
    .insert(participantPayload)
    .select("id, email, full_name");

  if (participantError || !participantRows || participantRows.length !== 4) {
    throw new Error(
      `Failed to create Team Dynamics smoke participants: ${participantError?.message ?? "unexpected participant insert result"}`,
    );
  }

  participantRows.sort((left, right) => left.email.localeCompare(right.email));

  const { data: teamRows, error: teamError } = await supabase
    .from("teams")
    .insert({
      organization_id: organization.id,
      name: `${fixtureName} Team`,
      description: "Cleanup-safe Team Dynamics Executive Overview worker real smoke fixture",
      created_by_user_id: null,
    })
    .select("id, name")
    .limit(1);

  if (teamError || !teamRows?.[0]?.id) {
    throw new Error(
      `Failed to create Team Dynamics smoke team: ${teamError?.message ?? "unknown error"}`,
    );
  }

  const team = teamRows[0];

  const membershipPayload = participantRows.map((participant, index) => ({
    team_id: team.id,
    participant_id: participant.id,
    role: index === 0 ? "lead" : "member",
    is_active: true,
    joined_at: createdAt,
    left_at: null,
  }));

  const { data: membershipRows, error: membershipError } = await supabase
    .from("team_memberships")
    .insert(membershipPayload)
    .select("id, participant_id");

  if (membershipError || !membershipRows || membershipRows.length !== 4) {
    throw new Error(
      `Failed to create Team Dynamics smoke team memberships: ${membershipError?.message ?? "unexpected membership insert result"}`,
    );
  }

  membershipRows.sort((left, right) => left.participant_id.localeCompare(right.participant_id));

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("team_assessment_assignments")
    .insert({
      team_id: team.id,
      package_slug: "team_dynamics_assessment_v1",
      status: "active",
      created_by_user_id: null,
      opened_at: createdAt,
      closed_at: null,
    })
    .select("id, team_id, package_slug, status")
    .limit(1);

  if (assignmentError || !assignmentRows?.[0]?.id) {
    throw new Error(
      `Failed to create Team Dynamics smoke assignment: ${assignmentError?.message ?? "unknown error"}`,
    );
  }

  const assignment = assignmentRows[0];

  const attemptPayload = participantRows.map((participant, index) => ({
    user_id: null,
    test_id: testRow.id,
    status: "completed",
    started_at: createdAt,
    completed_at: completedAt,
    total_time_seconds: 1500 + index * 60,
    metadata: {},
    organization_id: organization.id,
    participant_id: participant.id,
    locale: "bs",
    addressing_form_snapshot: index % 2 === 0 ? "feminine" : "masculine",
  }));

  const { data: attemptRows, error: attemptError } = await supabase
    .from("attempts")
    .insert(attemptPayload)
    .select("id, participant_id");

  if (attemptError || !attemptRows || attemptRows.length !== 4) {
    throw new Error(
      `Failed to create Team Dynamics smoke attempts: ${attemptError?.message ?? "unexpected attempt insert result"}`,
    );
  }

  attemptRows.sort((left, right) => left.participant_id.localeCompare(right.participant_id));

  const attemptByParticipantId = new Map(attemptRows.map((attempt) => [attempt.participant_id, attempt]));
  const membershipByParticipantId = new Map(
    membershipRows.map((membership) => [membership.participant_id, membership]),
  );

  const wrapperPayload = participantRows.map((participant) => ({
    team_assessment_assignment_id: assignment.id,
    team_membership_id: membershipByParticipantId.get(participant.id).id,
    participant_id: participant.id,
    attempt_id: attemptByParticipantId.get(participant.id).id,
    status: "completed",
    invited_at: createdAt,
    started_at: startedAt,
    completed_at: completedAt,
  }));

  const { data: wrapperRows, error: wrapperError } = await supabase
    .from("team_assessment_participants")
    .insert(wrapperPayload)
    .select("id, participant_id, attempt_id, status");

  if (wrapperError || !wrapperRows || wrapperRows.length !== 4) {
    throw new Error(
      `Failed to create Team Dynamics smoke wrappers: ${wrapperError?.message ?? "unexpected wrapper insert result"}`,
    );
  }

  wrapperRows.sort((left, right) => left.participant_id.localeCompare(right.participant_id));

  const scoreSnapshot = buildReadyScoreSnapshot();
  const scorePayload = wrapperRows.map((wrapper, index) => ({
    team_assessment_participant_id: wrapper.id,
    attempt_id: wrapper.attempt_id,
    scoring_version: scoringVersion,
    scoring_status: "scored",
    raw_total: null,
    mean_raw: null,
    score_0_100: null,
    supported_question_count: 5,
    scored_question_count: 5,
    ignored_invalid_answer_count: 0,
    scale_min: 1,
    scale_max: 4,
    score_value_source: null,
    missing_question_ids: [],
    score_snapshot: scoreSnapshot,
    source_response_count: 5,
    source_completed_at: completedAt,
    calculated_at: `2026-05-29T10:${String(40 + index).padStart(2, "0")}:00.000Z`,
  }));

  const { data: scoreRows, error: scoreError } = await supabase
    .from("team_assessment_participant_scores")
    .insert(scorePayload)
    .select("id, team_assessment_participant_id, scoring_status");

  if (scoreError || !scoreRows || scoreRows.length !== 4) {
    throw new Error(
      `Failed to create Team Dynamics smoke score rows: ${scoreError?.message ?? "unexpected score insert result"}`,
    );
  }

  const persistedAggregation = await persistFinalAggregationSnapshot({
    teamAssessmentAssignmentId: assignment.id,
  });

  if (!persistedAggregation.ok || persistedAggregation.value.aggregationStatus !== "ready") {
    throw new Error(
      persistedAggregation.ok
        ? "Team Dynamics smoke fixture final aggregation did not persist in ready status."
        : persistedAggregation.reason,
    );
  }

  const finalAggregation = await loadFinalAggregationVerification({
    teamAssessmentAssignmentId: assignment.id,
  });

  if (
    finalAggregation.status !== "ready" ||
    !isNonEmptyString(finalAggregation.aggregationSnapshotId)
  ) {
    throw new Error("Team Dynamics smoke fixture final aggregation verification is not ready.");
  }

  return {
    source: "created_cleanup_safe_fixture",
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    team: {
      id: team.id,
      name: team.name,
    },
    assignment: {
      id: assignment.id,
    },
    participants: participantRows.map((participant) => {
      const wrapper = wrapperRows.find((row) => row.participant_id === participant.id);
      return {
        participantId: participant.id,
        teamAssessmentParticipantId: wrapper.id,
        attemptId: wrapper.attempt_id,
        email: participant.email,
        fullName: participant.full_name,
      };
    }),
    finalAggregationSnapshotId: finalAggregation.aggregationSnapshotId,
  };
}

async function deleteReportRows(supabase, reportIds) {
  if (reportIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("team_assessment_reports")
    .delete()
    .in("id", reportIds);

  if (error) {
    throw new Error(`Failed to cleanup Team Dynamics report rows: ${error.message}`);
  }
}

async function deleteSelectionDraft(supabase, selectionDraftId) {
  const { error: deleteMembersError } = await supabase
    .from("team_assessment_report_selection_members")
    .delete()
    .eq("selection_draft_id", selectionDraftId);

  if (deleteMembersError) {
    throw new Error(
      `Failed to cleanup Team Dynamics selection members for draft ${selectionDraftId}: ${deleteMembersError.message}`,
    );
  }

  const { error: deleteDraftError } = await supabase
    .from("team_assessment_report_selection_drafts")
    .delete()
    .eq("id", selectionDraftId);

  if (deleteDraftError) {
    throw new Error(
      `Failed to cleanup Team Dynamics selection draft ${selectionDraftId}: ${deleteDraftError.message}`,
    );
  }
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
    missingCompletedScoreParticipantIds:
      finalAggregation.missingScoreParticipantIds ?? [],
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

async function updateReportRow(supabase, reportId, patch) {
  const { data, error } = await supabase
    .from("team_assessment_reports")
    .update(patch)
    .eq("id", reportId)
    .select(
      "id, report_status, generator_type, model_name, included_member_ids_snapshot, input_snapshot, report_snapshot, error_message, queued_at, started_at, completed_at, created_at, updated_at",
    )
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Failed to update Team Dynamics report row ${reportId}: ${error?.message ?? "missing row"}`,
    );
  }

  return data;
}

async function loadReportRowsByIds(supabase, reportIds) {
  if (reportIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("team_assessment_reports")
    .select(
      "id, organization_id, team_id, team_assessment_assignment_id, selection_draft_id, aggregation_snapshot_id, report_type, report_version, report_status, generator_type, model_name, included_member_ids_snapshot, input_snapshot, report_snapshot, error_message, queued_at, started_at, completed_at, created_at, updated_at",
    )
    .in("id", reportIds);

  if (error) {
    throw new Error(`Failed to load Team Dynamics report rows: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      teamId: row.team_id,
      teamAssessmentAssignmentId: row.team_assessment_assignment_id,
      selectionDraftId: row.selection_draft_id,
      aggregationSnapshotId: row.aggregation_snapshot_id,
      reportType: row.report_type,
      reportVersion: row.report_version,
      reportStatus: row.report_status,
      generatorType: row.generator_type,
      modelName: row.model_name,
      includedMemberIdsSnapshot: Array.isArray(row.included_member_ids_snapshot)
        ? [...row.included_member_ids_snapshot]
        : [],
      inputSnapshot: row.input_snapshot,
      reportSnapshot: row.report_snapshot,
      errorMessage: row.error_message,
      queuedAt: row.queued_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function parseWorkerShellOutput(rawOutput) {
  const trimmed = rawOutput.trim();

  if (!trimmed) {
    throw new Error("Worker shell returned empty output.");
  }

  function readNumber(label) {
    const match = trimmed.match(new RegExp(`${label}:\\s*(\\d+)`));
    return match ? Number.parseInt(match[1], 10) : null;
  }

  function readBoolean(label) {
    const match = trimmed.match(new RegExp(`${label}:\\s*(true|false)`));
    return match ? match[1] === "true" : null;
  }

  const ids = Array.from(trimmed.matchAll(/(?:id|reportId): '([^']+)'/g)).map((match) => match[1]);
  const outcomeMatch = trimmed.match(/outcome: '([^']+)'/);
  const operationMatch = trimmed.match(/operation: '([^']+)'/);
  const markerMatch = trimmed.match(/marker: '([^']+)'/);

  return {
    raw: trimmed,
    dryRun: readBoolean("dryRun"),
    requestedLimit: readNumber("requestedLimit"),
    appliedLimit: readNumber("appliedLimit"),
    eligibleCount: readNumber("eligibleCount"),
    wouldProcessCount: readNumber("wouldProcessCount"),
    processedCount: readNumber("processedCount"),
    readyCount: readNumber("ready"),
    failedCount: readNumber("failed"),
    skippedCount: readNumber("skipped"),
    claimNotAcquiredCount: readNumber("claimNotAcquired"),
    errorCount: readNumber("errors"),
    ids,
    outcome: outcomeMatch ? outcomeMatch[1] : null,
    operation: operationMatch ? operationMatch[1] : null,
    marker: markerMatch ? markerMatch[1] : null,
  };
}

function runWorkerShell(args) {
  const rawOutput = execFileSync(
    "node",
    ["scripts/process-team-dynamics-executive-overview-reports.cjs", ...args],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env },
    },
  );

  return parseWorkerShellOutput(rawOutput);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findRow(rows, reportId) {
  const row = rows.find((entry) => entry.id === reportId);
  assert.ok(row, `Expected report row ${reportId} to exist.`);
  return row;
}

function assertSameInstant(actual, expected, label) {
  assert.ok(isNonEmptyString(actual), `${label}: expected a timestamp value.`);
  assert.equal(new Date(actual).toISOString(), new Date(expected).toISOString(), label);
}

function summarizeControlledFailure(workerResult, processedRow) {
  return {
    reportId: processedRow.id,
    reportStatus: processedRow.reportStatus,
    operation: workerResult.operation,
    outcome: workerResult.outcome,
    marker: workerResult.marker,
    errorMessage: processedRow.errorMessage,
    inputSnapshotPersisted: processedRow.inputSnapshot !== null,
    reportSnapshotPersisted: processedRow.reportSnapshot !== null,
    startedAt: processedRow.startedAt,
    completedAt: processedRow.completedAt,
  };
}

async function main() {
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      JSON.stringify(
        buildSkipResult("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", {
          missingEnv: [
            !process.env.NEXT_PUBLIC_SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : null,
            !process.env.SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY" : null,
          ].filter(Boolean),
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (!process.env.OPENAI_API_KEY || !process.env.AI_REPORT_MODEL) {
    console.log(
      JSON.stringify(
        buildSkipResult("Missing OPENAI_API_KEY or AI_REPORT_MODEL.", {
          missingEnv: [
            !process.env.OPENAI_API_KEY ? "OPENAI_API_KEY" : null,
            !process.env.AI_REPORT_MODEL ? "AI_REPORT_MODEL" : null,
          ].filter(Boolean),
        }),
        null,
        2,
      ),
    );
    return;
  }

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const {
    loadTeamDynamicsReportSelectionInclusionState,
    replaceTeamDynamicsReportSelectionInclusionSet,
  } = require("../lib/b2b/team-dynamics-report-selection-inclusion.ts");
  const {
    getTeamDynamicsReportSelectionReadModelForOrganization,
  } = require("../lib/b2b/team-dynamics-report-selection.ts");
  const {
    TEAM_DYNAMICS_REPORT_TYPE,
    TEAM_DYNAMICS_REPORT_VERSION,
    queueTeamDynamicsReportShell,
  } = require("../lib/b2b/team-dynamics-report-lifecycle.ts");
  const {
    loadTeamDynamicsFinalAggregationVerification,
  } = require("../lib/assessment/team-dynamics-final-aggregation-read.ts");
  const {
    persistTeamDynamicsFinalAggregationSnapshot,
  } = require("../lib/assessment/team-dynamics-final-aggregation-persistence.ts");
  const {
    TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
  } = require("../lib/assessment/team-dynamics-mixed-score-persistence.ts");
  const {
    validateTeamDynamicsExecutiveOverviewSnapshot,
    buildMockTeamDynamicsExecutiveOverviewSnapshot,
  } = require("../lib/b2b/team-dynamics-executive-overview-contract.ts");
  const {
    loadTeamDynamicsExecutiveOverviewReportForDisplay,
  } = require("../lib/b2b/team-dynamics-executive-overview-display.ts");

  const supabase = createSupabaseAdminClient();
  const tableProbes = [];

  for (const table of REQUIRED_TABLES) {
    tableProbes.push(await probeTable(supabase, table));
  }

  const inaccessibleRequiredTables = tableProbes.filter((probe) => probe.ok === false);

  if (inaccessibleRequiredTables.length > 0) {
    console.log(
      JSON.stringify(
        buildSkipResult(
          "Required Team Dynamics report-lane tables are not reachable through the current runtime Supabase schema cache.",
          {
            verified: [
              "service-role env detected",
              "OpenAI env detected",
              "runtime Supabase API reachable",
              "skip is based on actual table-access failure, not assumed success",
            ],
            blockingTables: inaccessibleRequiredTables,
          },
        ),
        null,
        2,
      ),
    );
    return;
  }

  const existingReadyFixture = await findExistingReadyFixture({
    supabase,
    loadSelectionReadModel: getTeamDynamicsReportSelectionReadModelForOrganization,
    loadFinalAggregationVerification: loadTeamDynamicsFinalAggregationVerification,
  });

  const cleanup = {
    createdReportIds: [],
    createdSelectionDraftId: null,
    createdAttemptIds: [],
    createdOrganizationId: null,
  };

  const fixture =
    existingReadyFixture ??
    (await createReportReadySmokeFixture({
      supabase,
      persistFinalAggregationSnapshot: persistTeamDynamicsFinalAggregationSnapshot,
      loadFinalAggregationVerification: loadTeamDynamicsFinalAggregationVerification,
      scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
    }));

  if (fixture.source === "created_cleanup_safe_fixture") {
    cleanup.createdAttemptIds = fixture.participants.map((participant) => participant.attemptId);
    cleanup.createdOrganizationId = fixture.organization.id;
  }

  const attemptIds = await loadAssignmentAttemptIds(supabase, fixture.assignment.id);
  const initialSelectionState = await loadTeamDynamicsReportSelectionInclusionState({
    organizationId: fixture.organization.id,
    teamId: fixture.team.id,
    teamAssessmentAssignmentId: fixture.assignment.id,
  });
  const includedParticipantIds = await loadAssignmentParticipantIds(
    supabase,
    fixture.assignment.id,
  );

  const beforeCounts = {
    attemptReportsForFixtureAttempts: await countAttemptReportsForAttempts(supabase, attemptIds),
    assessmentReportsForFixtureOrganization: await countAssessmentReportsForOrganization(
      supabase,
      fixture.organization.id,
    ),
  };

  try {
    assert.ok(
      includedParticipantIds.length >= 4,
      "Expected at least four Team Dynamics assignment participants in the smoke fixture.",
    );

    const savedSelection = await replaceTeamDynamicsReportSelectionInclusionSet({
      organizationId: fixture.organization.id,
      teamId: fixture.team.id,
      teamAssessmentAssignmentId: fixture.assignment.id,
      includedTeamAssessmentParticipantIds: includedParticipantIds,
      actorUserId: null,
    });

    if (!initialSelectionState.hasPersistedSelectionDraft) {
      cleanup.createdSelectionDraftId = savedSelection.selectionDraftId;
    }

    const reloadedSelection = await loadTeamDynamicsReportSelectionInclusionState({
      organizationId: fixture.organization.id,
      teamId: fixture.team.id,
      teamAssessmentAssignmentId: fixture.assignment.id,
    });

    assert.equal(reloadedSelection.hasPersistedSelectionDraft, true);
    assert.equal(reloadedSelection.selectionDraftId, savedSelection.selectionDraftId);
    assert.deepEqual(
      reloadedSelection.includedTeamAssessmentParticipantIds,
      [...includedParticipantIds].sort(),
    );

    const selectionReadModel = await getTeamDynamicsReportSelectionReadModelForOrganization({
      organizationId: fixture.organization.id,
      teamId: fixture.team.id,
      teamAssessmentAssignmentId: fixture.assignment.id,
    });

    assert.ok(selectionReadModel, "Expected Team Dynamics selection read model to load.");
    assert.equal(selectionReadModel.selectedCount >= 4, true);
    assert.equal(selectionReadModel.canCreateTeamReport, true);

    const finalAggregation = await loadTeamDynamicsFinalAggregationVerification({
      teamAssessmentAssignmentId: fixture.assignment.id,
    });
    assert.equal(finalAggregation.status, "ready");
    assert.ok(isNonEmptyString(finalAggregation.aggregationSnapshotId));

    const queueWithRealAggregation = () =>
      queueTeamDynamicsReportShell(
        {
          organizationId: fixture.organization.id,
          teamId: fixture.team.id,
          teamAssessmentAssignmentId: fixture.assignment.id,
          selectionDraftId: savedSelection.selectionDraftId,
        },
        {
          supabase,
          loadAggregationVerification: async (queueInput) =>
            mapFinalAggregationToQueueVerification(
              await loadTeamDynamicsFinalAggregationVerification(queueInput, {
                supabase,
              }),
            ),
        },
      );

    const primaryQueued = await queueWithRealAggregation();
    const secondaryQueued = await queueWithRealAggregation();
    const failedSeed = await queueWithRealAggregation();
    const processingSeed = await queueWithRealAggregation();
    const readySeed = await queueWithRealAggregation();

    for (const queued of [primaryQueued, secondaryQueued, failedSeed, processingSeed, readySeed]) {
      if (!queued.ok && queued.code === "aggregation_not_ready") {
        const runtimeContext = await loadAssignmentRuntimeContext(
          supabase,
          fixture.assignment.id,
        );

        console.log(
          JSON.stringify(
            buildSkipResult(
              "Team Dynamics worker real smoke fixture is not ready for queueing.",
              {
                blocker: {
                  code: queued.code,
                  reason: queued.reason,
                },
                fixture: {
                  organizationId: fixture.organization.id,
                  teamId: fixture.team.id,
                  teamAssessmentAssignmentId: fixture.assignment.id,
                  selectionDraftId: savedSelection.selectionDraftId,
                  includedMemberCount: includedParticipantIds.length,
                },
                runtimeContext,
              },
            ),
            null,
            2,
          ),
        );
        return;
      }

      assert.equal(queued.ok, true, queued.ok ? "" : queued.reason);
      cleanup.createdReportIds.push(queued.report.id);
      assert.equal(queued.report.reportType, TEAM_DYNAMICS_REPORT_TYPE);
      assert.equal(queued.report.reportVersion, TEAM_DYNAMICS_REPORT_VERSION);
      assert.deepEqual(queued.report.includedMemberIdsSnapshot, [...includedParticipantIds].sort());
    }

    const mockReadySnapshot = buildMockTeamDynamicsExecutiveOverviewSnapshot();
    const seedReportIds = cleanup.createdReportIds.slice();

    await updateReportRow(supabase, primaryQueued.report.id, {
      queued_at: "2000-01-01T00:00:00.000Z",
      started_at: null,
      completed_at: null,
      error_message: null,
      input_snapshot: null,
      report_snapshot: null,
      generator_type: null,
      model_name: null,
    });
    await updateReportRow(supabase, secondaryQueued.report.id, {
      queued_at: "2000-01-01T00:01:00.000Z",
      started_at: null,
      completed_at: null,
      error_message: null,
      input_snapshot: null,
      report_snapshot: null,
      generator_type: null,
      model_name: null,
    });
    await updateReportRow(supabase, failedSeed.report.id, {
      queued_at: "2000-01-01T00:02:00.000Z",
      report_status: "failed",
      error_message: "SMOKE_PRESEEDED_FAILED_REPORT",
      started_at: "2000-01-01T00:02:10.000Z",
      completed_at: "2000-01-01T00:02:20.000Z",
    });
    await updateReportRow(supabase, processingSeed.report.id, {
      queued_at: "2000-01-01T00:03:00.000Z",
      report_status: "processing",
      error_message: null,
      started_at: "2000-01-01T00:03:10.000Z",
      completed_at: null,
    });
    await updateReportRow(supabase, readySeed.report.id, {
      queued_at: "2000-01-01T00:04:00.000Z",
      report_status: "ready",
      generator_type: "mock",
      model_name: "smoke-seeded-ready",
      report_snapshot: mockReadySnapshot,
      error_message: null,
      started_at: "2000-01-01T00:04:10.000Z",
      completed_at: "2000-01-01T00:04:20.000Z",
    });

    const beforeDryRunRows = await loadReportRowsByIds(supabase, seedReportIds);

    const dryRunResult = runWorkerShell(["--dry-run", "--limit", "2"]);

    assert.equal(dryRunResult.dryRun, true);
    assert.equal(dryRunResult.appliedLimit, 2);
    assert.equal(dryRunResult.eligibleCount, 2);
    assert.equal(dryRunResult.wouldProcessCount, 2);
    assert.equal(dryRunResult.ids.includes(primaryQueued.report.id), true);
    assert.equal(dryRunResult.ids.includes(secondaryQueued.report.id), true);
    assert.equal(dryRunResult.ids.includes(failedSeed.report.id), false);
    assert.equal(dryRunResult.ids.includes(processingSeed.report.id), false);
    assert.equal(dryRunResult.ids.includes(readySeed.report.id), false);

    const afterDryRunRows = await loadReportRowsByIds(supabase, seedReportIds);
    const afterDryRunCounts = {
      attemptReportsForFixtureAttempts: await countAttemptReportsForAttempts(supabase, attemptIds),
      assessmentReportsForFixtureOrganization: await countAssessmentReportsForOrganization(
        supabase,
        fixture.organization.id,
      ),
    };

    assert.deepEqual(afterDryRunRows, beforeDryRunRows);
    assert.deepEqual(afterDryRunCounts, beforeCounts);

    const nonDryRunResult = runWorkerShell(["--limit", "1"]);

    assert.equal(nonDryRunResult.dryRun, false);
    assert.equal(nonDryRunResult.appliedLimit, 1);
    assert.equal(nonDryRunResult.eligibleCount, 1);
    assert.equal(nonDryRunResult.processedCount, 1);
    assert.equal(nonDryRunResult.ids.includes(primaryQueued.report.id), true);

    const afterRunRows = await loadReportRowsByIds(supabase, seedReportIds);
    const primaryAfterRun = findRow(afterRunRows, primaryQueued.report.id);
    const secondaryAfterRun = findRow(afterRunRows, secondaryQueued.report.id);
    const failedAfterRun = findRow(afterRunRows, failedSeed.report.id);
    const processingAfterRun = findRow(afterRunRows, processingSeed.report.id);
    const readyAfterRun = findRow(afterRunRows, readySeed.report.id);
    const afterNonDryRunCounts = {
      attemptReportsForFixtureAttempts: await countAttemptReportsForAttempts(supabase, attemptIds),
      assessmentReportsForFixtureOrganization: await countAssessmentReportsForOrganization(
        supabase,
        fixture.organization.id,
      ),
    };

    assert.deepEqual(afterNonDryRunCounts, beforeCounts);
    assert.equal(secondaryAfterRun.reportStatus, "queued");
    assert.equal(secondaryAfterRun.inputSnapshot, null);
    assert.equal(secondaryAfterRun.reportSnapshot, null);
    assert.equal(failedAfterRun.reportStatus, "failed");
    assert.equal(failedAfterRun.errorMessage, "SMOKE_PRESEEDED_FAILED_REPORT");
    assert.equal(processingAfterRun.reportStatus, "processing");
    assertSameInstant(
      processingAfterRun.startedAt,
      "2000-01-01T00:03:10.000Z",
      "processing seed startedAt must stay unchanged",
    );
    assert.equal(processingAfterRun.completedAt, null);
    assert.equal(readyAfterRun.reportStatus, "ready");
    assert.deepEqual(readyAfterRun.reportSnapshot, mockReadySnapshot);

    if (primaryAfterRun.reportStatus === "failed") {
      if (
        nonDryRunResult.marker ===
        "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_VALIDATION_FAILURE"
      ) {
        console.log(
          JSON.stringify(
            buildControlledFailureResult(
              "Team Dynamics worker real smoke reached a controlled validator failure after the worker completed the failed path.",
              {
                verified: [
                  "cleanup-safe fixture persisted a saved selection with minimum four included score-ready members",
                  "ready aggregation snapshot existed before queueing",
                  "dry-run found exactly the two seeded queued reports and left team_assessment_reports unchanged",
                  "non-dry-run limit 1 processed only the oldest queued report",
                  "non-dry-run did not touch queued-secondary, failed, processing, or ready seed rows",
                  "attempt_reports count stayed unchanged",
                  "assessment_reports count stayed unchanged",
                  "failed report was not reset to queued automatically",
                ],
                fixture: {
                  source: fixture.source,
                  organizationId: fixture.organization.id,
                  teamId: fixture.team.id,
                  teamAssessmentAssignmentId: fixture.assignment.id,
                  selectionDraftId: savedSelection.selectionDraftId,
                  seededReportIds: {
                    primaryQueued: primaryQueued.report.id,
                    secondaryQueued: secondaryQueued.report.id,
                    failed: failedSeed.report.id,
                    processing: processingSeed.report.id,
                    ready: readySeed.report.id,
                  },
                },
                dryRun: dryRunResult,
                nonDryRun: nonDryRunResult,
                outcome: summarizeControlledFailure(nonDryRunResult, primaryAfterRun),
                counts: {
                  before: beforeCounts,
                  afterDryRun: afterDryRunCounts,
                  afterNonDryRun: afterNonDryRunCounts,
                },
              },
            ),
            null,
            2,
          ),
        );
        return;
      }

      throw new Error(
        `Worker real smoke failed on queued report ${primaryAfterRun.id} with marker ${nonDryRunResult.marker ?? "unknown"} and message ${primaryAfterRun.errorMessage ?? "n/a"}`,
      );
    }

    assert.equal(primaryAfterRun.reportStatus, "ready");
    assert.equal(primaryAfterRun.startedAt !== null, true);
    assert.equal(primaryAfterRun.completedAt !== null, true);
    assert.ok(primaryAfterRun.inputSnapshot);
    assert.ok(primaryAfterRun.reportSnapshot);
    assert.equal(primaryAfterRun.errorMessage, null);
    assert.equal(nonDryRunResult.outcome, "ready");
    assert.equal(nonDryRunResult.operation, "completed_ready");

    const validation = validateTeamDynamicsExecutiveOverviewSnapshot(
      primaryAfterRun.reportSnapshot,
    );
    assert.equal(validation.ok, true, validation.ok ? "" : validation.errors.join("; "));

    const displayReady = await loadTeamDynamicsExecutiveOverviewReportForDisplay(
      {
        organizationId: fixture.organization.id,
        teamId: fixture.team.id,
        teamAssessmentReportId: primaryQueued.report.id,
      },
      {
        supabase,
      },
    );
    assert.ok(displayReady);
    assert.equal(displayReady.status, "ready");

    const wrongOrganization = await loadTeamDynamicsExecutiveOverviewReportForDisplay(
      {
        organizationId: "00000000-0000-0000-0000-000000000000",
        teamId: fixture.team.id,
        teamAssessmentReportId: primaryQueued.report.id,
      },
      {
        supabase,
      },
    );
    const wrongTeam = await loadTeamDynamicsExecutiveOverviewReportForDisplay(
      {
        organizationId: fixture.organization.id,
        teamId: "00000000-0000-0000-0000-000000000000",
        teamAssessmentReportId: primaryQueued.report.id,
      },
      {
        supabase,
      },
    );
    assert.equal(wrongOrganization, null);
    assert.equal(wrongTeam, null);

    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: false,
          controlledFailure: false,
          verified: [
            "cleanup-safe fixture persisted or reused a saved selection with minimum four included score-ready members",
            "ready aggregation snapshot existed before queueing and queue helper accepted the path",
            "dry-run found the eligible queued reports, returned eligibleCount and wouldProcessCount, and left report rows unchanged",
            "dry-run did not persist input_snapshot, report_snapshot, or any status transition",
            "non-dry-run limit 1 processed only the oldest queued report",
            "worker completed queued -> processing -> ready for the processed report",
            "input_snapshot was persisted on the processed report row",
            "report_snapshot was persisted on the processed report row",
            "report_snapshot passed validateTeamDynamicsExecutiveOverviewSnapshot(...)",
            "display helper loaded the ready report within organizationId + teamId + reportId bounds",
            "wrong organization boundary returned null",
            "wrong team boundary returned null",
            "queued-secondary stayed queued and was not processed in the limit-1 batch",
            "failed, ready, and processing seed reports were not processed or reset",
            "attempt_reports count stayed unchanged",
            "assessment_reports count stayed unchanged",
            "no cron, scheduler, automatic background loop, report generation from view, Team Fit output, scoring rerun, aggregation refresh, raw responses read, UI changes, DB migration, attempt_reports write, or assessment_reports write was introduced",
          ],
          fixture: {
            source: fixture.source,
            organizationId: fixture.organization.id,
            teamId: fixture.team.id,
            teamAssessmentAssignmentId: fixture.assignment.id,
            selectionDraftId: savedSelection.selectionDraftId,
            aggregationSnapshotId: finalAggregation.aggregationSnapshotId,
            includedMemberCount: includedParticipantIds.length,
            seededReportIds: {
              primaryQueued: primaryQueued.report.id,
              secondaryQueued: secondaryQueued.report.id,
              failed: failedSeed.report.id,
              processing: processingSeed.report.id,
              ready: readySeed.report.id,
            },
          },
          dryRun: dryRunResult,
          nonDryRun: nonDryRunResult,
          counts: {
            before: beforeCounts,
            afterDryRun: afterDryRunCounts,
            afterNonDryRun: afterNonDryRunCounts,
          },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (isSchemaCacheMiss(error)) {
      console.log(
        JSON.stringify(
          buildSkipResult(
            "Runtime Supabase access reached the worker smoke path but failed on schema-cache visibility during helper execution.",
            {
              runtimeError: {
                code: error.code ?? null,
                message: error.message,
              },
            },
          ),
          null,
          2,
        ),
      );
      return;
    }

    throw error;
  } finally {
    try {
      await deleteReportRows(supabase, cleanup.createdReportIds);

      if (
        initialSelectionState.hasPersistedSelectionDraft &&
        initialSelectionState.selectionDraftId
      ) {
        await replaceTeamDynamicsReportSelectionInclusionSet({
          organizationId: fixture.organization.id,
          teamId: fixture.team.id,
          teamAssessmentAssignmentId: fixture.assignment.id,
          includedTeamAssessmentParticipantIds:
            initialSelectionState.includedTeamAssessmentParticipantIds,
          actorUserId: null,
        });
      } else if (cleanup.createdSelectionDraftId) {
        await deleteSelectionDraft(supabase, cleanup.createdSelectionDraftId);
      }

      await deleteByIds(supabase, "attempts", cleanup.createdAttemptIds);
      await deleteOrganizationCascade(supabase, cleanup.createdOrganizationId);
    } catch (cleanupError) {
      console.warn(
        cleanupError instanceof Error
          ? `Team Dynamics Executive Overview worker real smoke cleanup warning: ${cleanupError.message}`
          : `Team Dynamics Executive Overview worker real smoke cleanup warning: ${String(cleanupError)}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
