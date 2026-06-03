const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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
const FIXTURE = {
  organizationName: "TD Executive Overview Visual Review",
  organizationSlug: "td-executive-overview-visual-review",
  teamName: "TD Executive Overview Visual Review Team",
  teamDescription: "Dev-only Team Dynamics Executive Overview visual review fixture",
  hrEmail: "td-executive-overview-hr@example.test",
  hrPassword: process.env.TEAM_DYNAMICS_SMOKE_PASSWORD || "TdExecutiveOverviewVisual123!",
};

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

function isSchemaCacheMiss(error) {
  return Boolean(error && SCHEMA_CACHE_MISS_CODES.has(error.code ?? ""));
}

function getAppUrl() {
  return (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
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
    throw new Error(`Failed to count assessment_reports for fixture organization: ${error.message}`);
  }

  return count ?? 0;
}

async function listAuthUsersByEmails(supabase, emails) {
  const targetEmails = new Set(emails.map((email) => email.toLowerCase()));
  const usersByEmail = new Map();
  let page = 1;

  while (targetEmails.size > usersByEmail.size && page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    for (const user of data.users) {
      const email = user.email?.toLowerCase();

      if (email && targetEmails.has(email)) {
        usersByEmail.set(email, user);
      }
    }

    if (data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return usersByEmail;
}

async function ensureAuthUser(supabase, input) {
  const existingUsers = await listAuthUsersByEmails(supabase, [input.email]);
  const existingUser = existingUsers.get(input.email.toLowerCase()) ?? null;

  if (existingUser?.id) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      password: input.password,
      user_metadata: {
        ...(existingUser.user_metadata ?? {}),
        role: input.role,
        smoke_fixture: "team_dynamics_executive_overview_visual",
      },
    });

    if (error || !data?.user?.id) {
      throw new Error(`Failed to update auth user ${input.email}: ${error?.message ?? "unknown error"}`);
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: input.role,
      smoke_fixture: "team_dynamics_executive_overview_visual",
    },
  });

  if (error || !data?.user?.id) {
    throw new Error(`Failed to create auth user ${input.email}: ${error?.message ?? "unknown error"}`);
  }

  return data.user;
}

async function ensureOrganization(supabase) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("slug", FIXTURE.organizationSlug)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load visual fixture organization: ${error.message}`);
  }

  if (data?.[0]?.id) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("organizations")
      .update({
        name: FIXTURE.organizationName,
        status: "active",
      })
      .eq("id", data[0].id)
      .select("id, name, slug, status")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(`Failed to update visual fixture organization: ${updateError?.message ?? "unknown error"}`);
    }

    return updatedRows[0];
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("organizations")
    .insert({
      name: FIXTURE.organizationName,
      slug: FIXTURE.organizationSlug,
      status: "active",
    })
    .select("id, name, slug, status")
    .limit(1);

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(`Failed to create visual fixture organization: ${insertError?.message ?? "unknown error"}`);
  }

  return insertedRows[0];
}

async function ensureOrganizationMembership(supabase, input) {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("id, organization_id, user_id, role, status")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load visual fixture organization membership: ${error.message}`);
  }

  if (data?.[0]?.id) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("organization_memberships")
      .update({
        role: "hr_admin",
        status: "active",
      })
      .eq("id", data[0].id)
      .select("id, organization_id, user_id, role, status")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(`Failed to update visual fixture organization membership: ${updateError?.message ?? "unknown error"}`);
    }

    return updatedRows[0];
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("organization_memberships")
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      role: "hr_admin",
      status: "active",
    })
    .select("id, organization_id, user_id, role, status")
    .limit(1);

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(`Failed to create visual fixture organization membership: ${insertError?.message ?? "unknown error"}`);
  }

  return insertedRows[0];
}

async function ensureTeam(supabase, input) {
  const { data, error } = await supabase
    .from("teams")
    .select("id, organization_id, name, description, archived_at")
    .eq("organization_id", input.organizationId)
    .eq("name", FIXTURE.teamName)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load visual fixture team: ${error.message}`);
  }

  if (data?.[0]?.id) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("teams")
      .update({
        description: FIXTURE.teamDescription,
        created_by_user_id: input.createdByUserId,
        archived_at: null,
      })
      .eq("id", data[0].id)
      .select("id, organization_id, name, description, archived_at")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(`Failed to update visual fixture team: ${updateError?.message ?? "unknown error"}`);
    }

    return updatedRows[0];
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("teams")
    .insert({
      organization_id: input.organizationId,
      name: FIXTURE.teamName,
      description: FIXTURE.teamDescription,
      created_by_user_id: input.createdByUserId,
    })
    .select("id, organization_id, name, description, archived_at")
    .limit(1);

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(`Failed to create visual fixture team: ${insertError?.message ?? "unknown error"}`);
  }

  return insertedRows[0];
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
    throw new Error(`Failed to load Team Dynamics assignment wrapper state: ${wrapperError.message}`);
  }

  const wrapperIds = (wrapperRows ?? []).map((row) => row.id);
  let scoreRows = [];

  if (wrapperIds.length > 0) {
    const { data, error } = await supabase
      .from("team_assessment_participant_scores")
      .select("id, team_assessment_participant_id, scoring_status, scoring_version")
      .in("team_assessment_participant_id", wrapperIds);

    if (error) {
      throw new Error(`Failed to load Team Dynamics participant score state: ${error.message}`);
    }

    scoreRows = data ?? [];
  }

  return {
    wrappers: wrapperRows ?? [],
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

async function findExistingReadyAssignmentForTeam(input) {
  const { supabase, teamId, loadSelectionReadModel, loadFinalAggregationVerification } = input;
  const { data: assignments, error } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug")
    .eq("team_id", teamId)
    .eq("package_slug", "team_dynamics_assessment_v1")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to inspect existing Team Dynamics assignments for visual fixture: ${error.message}`);
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
      organizationId: context.organizationId,
      teamId: context.teamId,
      teamName: context.teamName,
      assignmentId: assignment.id,
    };
  }

  return null;
}

async function createReportReadyAssignmentFixture(input) {
  const {
    supabase,
    organizationId,
    teamId,
    persistFinalAggregationSnapshot,
    loadFinalAggregationVerification,
    scoringVersion,
  } = input;
  const token = crypto.randomUUID().slice(0, 8);
  const createdAt = "2026-05-30T10:00:00.000Z";
  const startedAt = "2026-05-30T10:05:00.000Z";
  const completedAt = "2026-05-30T10:30:00.000Z";

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

  const participantPayload = Array.from({ length: 4 }, (_, index) => ({
    organization_id: organizationId,
    user_id: null,
    email: `td-executive-overview-visual-member-${index + 1}-${token}@example.test`,
    full_name: `TD Executive Overview Visual Member ${index + 1}`,
    participant_type: "employee",
    status: "active",
    addressing_form: index % 2 === 0 ? "feminine" : "masculine",
  }));

  const { data: participantRows, error: participantError } = await supabase
    .from("participants")
    .insert(participantPayload)
    .select("id, email, full_name");

  if (participantError || !participantRows || participantRows.length !== 4) {
    throw new Error(`Failed to create visual fixture participants: ${participantError?.message ?? "unexpected participant insert result"}`);
  }

  participantRows.sort((left, right) => left.email.localeCompare(right.email));

  const membershipPayload = participantRows.map((participant, index) => ({
    team_id: teamId,
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
    throw new Error(`Failed to create visual fixture team memberships: ${membershipError?.message ?? "unexpected membership insert result"}`);
  }

  membershipRows.sort((left, right) => left.participant_id.localeCompare(right.participant_id));

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("team_assessment_assignments")
    .insert({
      team_id: teamId,
      package_slug: "team_dynamics_assessment_v1",
      status: "active",
      created_by_user_id: null,
      opened_at: createdAt,
      closed_at: null,
    })
    .select("id, team_id, package_slug, status")
    .limit(1);

  if (assignmentError || !assignmentRows?.[0]?.id) {
    throw new Error(`Failed to create visual fixture assignment: ${assignmentError?.message ?? "unknown error"}`);
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
    organization_id: organizationId,
    participant_id: participant.id,
    locale: "bs",
    addressing_form_snapshot: index % 2 === 0 ? "feminine" : "masculine",
  }));

  const { data: attemptRows, error: attemptError } = await supabase
    .from("attempts")
    .insert(attemptPayload)
    .select("id, participant_id");

  if (attemptError || !attemptRows || attemptRows.length !== 4) {
    throw new Error(`Failed to create visual fixture attempts: ${attemptError?.message ?? "unexpected attempt insert result"}`);
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
    throw new Error(`Failed to create visual fixture wrappers: ${wrapperError?.message ?? "unexpected wrapper insert result"}`);
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
    calculated_at: `2026-05-30T10:${String(40 + index).padStart(2, "0")}:00.000Z`,
  }));

  const { data: scoreRows, error: scoreError } = await supabase
    .from("team_assessment_participant_scores")
    .insert(scorePayload)
    .select("id, team_assessment_participant_id, scoring_status");

  if (scoreError || !scoreRows || scoreRows.length !== 4) {
    throw new Error(`Failed to create visual fixture score rows: ${scoreError?.message ?? "unexpected score insert result"}`);
  }

  const persistedAggregation = await persistFinalAggregationSnapshot({
    teamAssessmentAssignmentId: assignment.id,
  });

  if (!persistedAggregation.ok || persistedAggregation.value.aggregationStatus !== "ready") {
    throw new Error(
      persistedAggregation.ok
        ? "Visual fixture final aggregation did not persist in ready status."
        : persistedAggregation.reason,
    );
  }

  const finalAggregation = await loadFinalAggregationVerification({
    teamAssessmentAssignmentId: assignment.id,
  });

  if (finalAggregation.status !== "ready" || !isNonEmptyString(finalAggregation.aggregationSnapshotId)) {
    throw new Error("Visual fixture final aggregation verification is not ready.");
  }

  return {
    assignmentId: assignment.id,
    participantIds: participantRows.map((participant) => participant.id),
    attemptIds: wrapperRows.map((wrapper) => wrapper.attempt_id),
    teamAssessmentParticipantIds: wrapperRows.map((wrapper) => wrapper.id),
  };
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

async function main() {
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      JSON.stringify(
        buildSkipResult("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", {
          verified: ["script wiring only"],
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
    processTeamDynamicsExecutiveOverviewMock,
  } = require("../lib/b2b/team-dynamics-report-lifecycle.ts");
  const {
    validateTeamDynamicsExecutiveOverviewSnapshot,
  } = require("../lib/b2b/team-dynamics-executive-overview-contract.ts");
  const {
    loadTeamDynamicsExecutiveOverviewReportForDisplay,
  } = require("../lib/b2b/team-dynamics-executive-overview-display.ts");
  const {
    loadTeamDynamicsFinalAggregationVerification,
  } = require("../lib/assessment/team-dynamics-final-aggregation-read.ts");
  const {
    TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
  } = require("../lib/assessment/team-dynamics-mixed-score-persistence.ts");
  const {
    persistTeamDynamicsFinalAggregationSnapshot,
  } = require("../lib/assessment/team-dynamics-final-aggregation-persistence.ts");

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

  const hrUser = await ensureAuthUser(supabase, {
    email: FIXTURE.hrEmail,
    password: FIXTURE.hrPassword,
    role: "hr_admin",
  });
  const organization = await ensureOrganization(supabase);
  const membership = await ensureOrganizationMembership(supabase, {
    organizationId: organization.id,
    userId: hrUser.id,
  });
  const team = await ensureTeam(supabase, {
    organizationId: organization.id,
    createdByUserId: hrUser.id,
  });

  let assignmentFixture = await findExistingReadyAssignmentForTeam({
    supabase,
    teamId: team.id,
    loadSelectionReadModel: getTeamDynamicsReportSelectionReadModelForOrganization,
    loadFinalAggregationVerification: loadTeamDynamicsFinalAggregationVerification,
  });

  if (!assignmentFixture) {
    assignmentFixture = {
      organizationId: organization.id,
      teamId: team.id,
      teamName: team.name,
      ...(await createReportReadyAssignmentFixture({
        supabase,
        organizationId: organization.id,
        teamId: team.id,
        persistFinalAggregationSnapshot: persistTeamDynamicsFinalAggregationSnapshot,
        loadFinalAggregationVerification: loadTeamDynamicsFinalAggregationVerification,
        scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
      })),
    };
  }

  const attemptIds = await loadAssignmentAttemptIds(supabase, assignmentFixture.assignmentId);
  const initialSelectionState = await loadTeamDynamicsReportSelectionInclusionState({
    organizationId: organization.id,
    teamId: team.id,
    teamAssessmentAssignmentId: assignmentFixture.assignmentId,
  });
  const includedParticipantIds = await loadAssignmentParticipantIds(
    supabase,
    assignmentFixture.assignmentId,
  );

  const beforeCounts = {
    attemptReportsForFixtureAttempts: await countAttemptReportsForAttempts(supabase, attemptIds),
    assessmentReportsForFixtureOrganization: await countAssessmentReportsForOrganization(
      supabase,
      organization.id,
    ),
  };

  try {
    assert.ok(
      includedParticipantIds.length >= 4,
      "Expected at least four Team Dynamics assignment participants in the visual fixture.",
    );

    const savedSelection = await replaceTeamDynamicsReportSelectionInclusionSet({
      organizationId: organization.id,
      teamId: team.id,
      teamAssessmentAssignmentId: assignmentFixture.assignmentId,
      includedTeamAssessmentParticipantIds: includedParticipantIds,
      actorUserId: hrUser.id,
    });

    const reloadedSelection = await loadTeamDynamicsReportSelectionInclusionState({
      organizationId: organization.id,
      teamId: team.id,
      teamAssessmentAssignmentId: assignmentFixture.assignmentId,
    });

    assert.equal(reloadedSelection.hasPersistedSelectionDraft, true);
    assert.equal(reloadedSelection.selectionDraftId, savedSelection.selectionDraftId);
    assert.deepEqual(
      reloadedSelection.includedTeamAssessmentParticipantIds,
      [...includedParticipantIds].sort(),
    );

    const selectionReadModel = await getTeamDynamicsReportSelectionReadModelForOrganization({
      organizationId: organization.id,
      teamId: team.id,
      teamAssessmentAssignmentId: assignmentFixture.assignmentId,
    });

    assert.ok(selectionReadModel, "Expected Team Dynamics selection read model to load.");
    assert.equal(selectionReadModel.selectedCount >= 4, true);
    assert.equal(selectionReadModel.canCreateTeamReport, true);

    const queued = await queueTeamDynamicsReportShell({
      organizationId: organization.id,
      teamId: team.id,
      teamAssessmentAssignmentId: assignmentFixture.assignmentId,
      selectionDraftId: savedSelection.selectionDraftId,
    }, {
      supabase,
      loadAggregationVerification: async (queueInput) =>
        mapFinalAggregationToQueueVerification(
          await loadTeamDynamicsFinalAggregationVerification(queueInput, {
            supabase,
          }),
        ),
    });

    assert.equal(queued.ok, true, queued.ok ? "" : queued.reason);
    assert.equal(queued.report.reportType, TEAM_DYNAMICS_REPORT_TYPE);
    assert.equal(queued.report.reportVersion, TEAM_DYNAMICS_REPORT_VERSION);
    assert.deepEqual(queued.report.includedMemberIdsSnapshot, [...includedParticipantIds].sort());

    const processed = await processTeamDynamicsExecutiveOverviewMock({
      organizationId: organization.id,
      teamAssessmentReportId: queued.report.id,
    });

    assert.equal(processed.ok, true, processed.ok ? "" : processed.reason);
    assert.equal(processed.finalStatus, "ready");
    assert.equal(processed.report.reportStatus, "ready");
    assert.equal(processed.report.reportType, TEAM_DYNAMICS_REPORT_TYPE);
    assert.equal(processed.report.reportVersion, TEAM_DYNAMICS_REPORT_VERSION);
    assert.ok(processed.report.reportSnapshot);

    const validation = validateTeamDynamicsExecutiveOverviewSnapshot(
      processed.report.reportSnapshot,
    );
    assert.equal(validation.ok, true, validation.ok ? "" : validation.errors.join("; "));

    const displayReady = await loadTeamDynamicsExecutiveOverviewReportForDisplay({
      organizationId: organization.id,
      teamId: team.id,
      teamAssessmentReportId: queued.report.id,
    });

    assert.ok(displayReady);
    assert.equal(displayReady.status, "ready");
    assert.equal(displayReady.report.id, queued.report.id);

    const afterCounts = {
      attemptReportsForFixtureAttempts: await countAttemptReportsForAttempts(supabase, attemptIds),
      assessmentReportsForFixtureOrganization: await countAssessmentReportsForOrganization(
        supabase,
        organization.id,
      ),
    };

    assert.deepEqual(afterCounts, beforeCounts);

    const output = {
      ok: true,
      skipped: false,
      fixtureType: "dev_only_visual_review",
      verified: [
        "final Team Dynamics assignment has at least four included completed members",
        "saved selection draft persisted with four included members",
        "queued team_assessment_reports row persisted with report_type, report_version, and included_member_ids_snapshot",
        "mock-safe processor completed queued -> processing -> ready",
        "report_snapshot exists and passed validateTeamDynamicsExecutiveOverviewSnapshot(...)",
        "display helper loaded the ready report",
        "attempt_reports row count for fixture attempts stayed unchanged",
        "assessment_reports row count for fixture organization stayed unchanged",
      ],
      hrLogin: {
        email: FIXTURE.hrEmail,
        password: FIXTURE.hrPassword,
        membershipRole: membership.role,
      },
      fixture: {
        organizationId: organization.id,
        organizationSlug: organization.slug,
        teamId: team.id,
        teamAssessmentAssignmentId: assignmentFixture.assignmentId,
        selectionDraftId: reloadedSelection.selectionDraftId,
        teamAssessmentReportId: queued.report.id,
        reportStatus: processed.report.reportStatus,
        reportType: processed.report.reportType,
        reportVersion: processed.report.reportVersion,
        url: `${getAppUrl()}/dashboard/teams/${team.id}/reports/${queued.report.id}`,
      },
      cleanupNote: {
        automaticCleanup: false,
        message:
          "Fixture remains in the dev DB for manual browser review. No standalone cleanup helper was added in this task.",
        manualGuidance: [
          `Preferred: rerun this script to reuse the same visual-review organization/team when possible.`,
          `Manual cleanup, if needed: remove fixture report/selection rows and fixture attempts, then remove organization slug ${organization.slug}.`,
        ],
      },
      counts: {
        before: beforeCounts,
        after: afterCounts,
      },
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      typeof error.message === "string" &&
      (error.message.includes("schema cache") || error.message.includes("PGRST205"))
    ) {
      console.log(
        JSON.stringify(
          buildSkipResult(
            "Runtime Supabase access reached the report lane but failed on schema-cache visibility during helper execution.",
            {
              verified: [
                "fixture bootstrap path ran",
                "skip is based on actual helper/runtime failure",
              ],
              runtimeError: {
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
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? `Team Dynamics Executive Overview visual fixture script failed: ${error.message}`
      : `Team Dynamics Executive Overview visual fixture script failed: ${String(error)}`,
  );
  process.exit(1);
});
