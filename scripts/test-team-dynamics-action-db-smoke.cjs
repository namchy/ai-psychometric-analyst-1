const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const actionPath = path.join(projectRoot, "app", "actions", "team-assessments.ts");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost"]);
const TEAM_DYNAMICS_TEST_SLUG = "team_dynamics_v1_strong";

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

function compileTypeScript(module, filename) {
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
}

function buildSkipResult(reason, extra = {}) {
  return {
    ok: false,
    skipped: true,
    reason,
    ...extra,
  };
}

function hasLocalSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function isLocalSupabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return LOCAL_HOSTNAMES.has(parsed.hostname);
  } catch {
    return false;
  }
}

async function createAuthUser(supabase, input) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: input.userMetadata ?? {},
  });

  if (error || !data?.user?.id) {
    throw new Error(`Failed to create auth user ${input.email}: ${error?.message ?? "unknown error"}`);
  }

  return data.user;
}

async function safeDeleteAuthUser(supabase, userId) {
  if (!userId) {
    return;
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    console.warn(`Failed to delete auth user ${userId}: ${error.message}`);
  }
}

async function safeDeleteRows(supabase, table, filter) {
  let query = supabase.from(table).delete();
  query = filter(query);
  const { error } = await query;

  if (error) {
    console.warn(`Failed to cleanup ${table}: ${error.message}`);
  }
}

function installActionBoundaryStubs(stubs) {
  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    if (request === "@/lib/auth/session") {
      return stubs.authPath;
    }

    if (request === "@/lib/b2b/organizations") {
      return stubs.organizationsPath;
    }

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

  require.extensions[".ts"] = compileTypeScript;
}

async function main() {
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));

  if (!hasLocalSupabaseEnv()) {
    console.log(JSON.stringify(
      buildSkipResult("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in local env.", {
        tested: "script wiring only",
        skipped_target: "real local DB-backed Team Dynamics action smoke",
      }),
      null,
      2,
    ));
    return;
  }

  if (!isLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    console.log(JSON.stringify(
      buildSkipResult(
        `NEXT_PUBLIC_SUPABASE_URL is not local-only (${process.env.NEXT_PUBLIC_SUPABASE_URL}).`,
        {
          tested: "script wiring only",
          skipped_target: "remote/prod DB write is intentionally disabled",
        },
      ),
      null,
      2,
    ));
    return;
  }

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const { getTeamAssessmentDetailForOrganization } = require("../lib/b2b/team-assessment-detail.ts");
  const {
    canUseGenericCandidateAttemptCreation,
  } = require("../lib/assessment/team-dynamics.ts");
  const {
    getCandidateAssessmentAvailability,
  } = require("../lib/assessment/availability.ts");
  const {
    planPostCompletionReportJobs,
  } = require("../lib/assessment/report-capabilities.ts");

  const supabase = createSupabaseAdminClient();

  const preconditionFailure = [];
  const { data: teamDynamicsTest, error: teamDynamicsTestError } = await supabase
    .from("tests")
    .select("id, slug, status, is_active")
    .eq("slug", TEAM_DYNAMICS_TEST_SLUG)
    .maybeSingle();

  if (teamDynamicsTestError) {
    throw new Error(`Failed to load Team Dynamics test precondition: ${teamDynamicsTestError.message}`);
  }

  if (!teamDynamicsTest?.id) {
    preconditionFailure.push(`Missing test row for slug ${TEAM_DYNAMICS_TEST_SLUG}.`);
  } else if (teamDynamicsTest.status !== "active" || teamDynamicsTest.is_active !== true) {
    preconditionFailure.push(
      `Expected ${TEAM_DYNAMICS_TEST_SLUG} to be active/is_active=true, received status=${JSON.stringify(teamDynamicsTest.status)} is_active=${JSON.stringify(teamDynamicsTest.is_active)}.`,
    );
  }

  const { count: questionCount, error: questionCountError } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("test_id", teamDynamicsTest?.id ?? "00000000-0000-0000-0000-000000000000")
    .eq("is_active", true);

  if (questionCountError) {
    throw new Error(`Failed to verify Team Dynamics question precondition: ${questionCountError.message}`);
  }

  if ((questionCount ?? 0) <= 0) {
    preconditionFailure.push("Team Dynamics active question count is 0 in local DB.");
  }

  if (preconditionFailure.length > 0) {
    console.log(JSON.stringify(
      buildSkipResult(preconditionFailure.join(" "), {
        tested: "env + local Team Dynamics DB preconditions",
        skipped_target: "real local DB-backed Team Dynamics action smoke",
      }),
      null,
      2,
    ));
    return;
  }

  const token = crypto.randomUUID().slice(0, 8);
  const hrEmail = `team-dynamics-hr-${token}@example.test`;
  const participantOneEmail = `team-dynamics-member-a-${token}@example.test`;
  const participantTwoEmail = `team-dynamics-member-b-${token}@example.test`;
  const password = `TdSmoke!${token}`;

  const cleanup = {
    organizationId: null,
    teamId: null,
    participantIds: [],
    membershipIds: [],
    organizationMembershipId: null,
    authUserIds: [],
    createdAttemptIds: [],
    assignmentId: null,
  };

  try {
    const hrUser = await createAuthUser(supabase, {
      email: hrEmail,
      password,
      userMetadata: { role: "hr_admin", smoke: "team_dynamics" },
    });
    const participantOneUser = await createAuthUser(supabase, {
      email: participantOneEmail,
      password,
      userMetadata: { role: "participant", smoke: "team_dynamics" },
    });
    const participantTwoUser = await createAuthUser(supabase, {
      email: participantTwoEmail,
      password,
      userMetadata: { role: "participant", smoke: "team_dynamics" },
    });

    cleanup.authUserIds.push(hrUser.id, participantOneUser.id, participantTwoUser.id);

    const { data: organizationRow, error: organizationError } = await supabase
      .from("organizations")
      .insert({
        name: `TD Smoke Org ${token}`,
        slug: `td-smoke-org-${token}`,
        status: "active",
      })
      .select("id, name, slug, status")
      .single();

    if (organizationError || !organizationRow?.id) {
      throw new Error(`Failed to create smoke organization: ${organizationError?.message ?? "unknown error"}`);
    }

    cleanup.organizationId = organizationRow.id;

    const { data: orgMembershipRow, error: orgMembershipError } = await supabase
      .from("organization_memberships")
      .insert({
        organization_id: organizationRow.id,
        user_id: hrUser.id,
        role: "hr_admin",
        status: "active",
      })
      .select("id")
      .single();

    if (orgMembershipError || !orgMembershipRow?.id) {
      throw new Error(`Failed to create HR organization membership: ${orgMembershipError?.message ?? "unknown error"}`);
    }

    cleanup.organizationMembershipId = orgMembershipRow.id;

    const { data: participantRows, error: participantError } = await supabase
      .from("participants")
      .insert([
        {
          organization_id: organizationRow.id,
          user_id: participantOneUser.id,
          email: participantOneEmail,
          full_name: "Smoke Member A",
          participant_type: "employee",
          status: "active",
          addressing_form: "feminine",
        },
        {
          organization_id: organizationRow.id,
          user_id: participantTwoUser.id,
          email: participantTwoEmail,
          full_name: "Smoke Member B",
          participant_type: "employee",
          status: "active",
          addressing_form: "masculine",
        },
      ])
      .select("id, user_id");

    if (participantError || (participantRows?.length ?? 0) !== 2) {
      throw new Error(`Failed to create smoke participants: ${participantError?.message ?? "unknown error"}`);
    }

    cleanup.participantIds = participantRows.map((participant) => participant.id);

    const { data: teamRow, error: teamError } = await supabase
      .from("teams")
      .insert({
        organization_id: organizationRow.id,
        name: `TD Smoke Team ${token}`,
        description: "Local Team Dynamics action smoke",
        created_by_user_id: hrUser.id,
      })
      .select("id, organization_id, name")
      .single();

    if (teamError || !teamRow?.id) {
      throw new Error(`Failed to create smoke team: ${teamError?.message ?? "unknown error"}`);
    }

    cleanup.teamId = teamRow.id;

    const { data: membershipRows, error: membershipError } = await supabase
      .from("team_memberships")
      .insert([
        {
          team_id: teamRow.id,
          participant_id: participantRows[0].id,
          role: "lead",
          is_active: true,
        },
        {
          team_id: teamRow.id,
          participant_id: participantRows[1].id,
          role: "member",
          is_active: true,
        },
      ])
      .select("id");

    if (membershipError || (membershipRows?.length ?? 0) !== 2) {
      throw new Error(`Failed to create smoke team memberships: ${membershipError?.message ?? "unknown error"}`);
    }

    cleanup.membershipIds = membershipRows.map((membership) => membership.id);

    const beforeSingleTestAssessmentReports =
      (
        await supabase
          .from("assessment_reports")
          .select("id", { count: "exact", head: true })
          .eq("source_type", "single_test")
          .eq("metadata->>test_slug", TEAM_DYNAMICS_TEST_SLUG)
      ).count ?? 0;

    const tmpDir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "team-dynamics-action-db-"));
    const stubAuthPath = path.join(tmpDir, "auth-session.cjs");
    const stubOrganizationsPath = path.join(tmpDir, "organizations.cjs");

    fs.writeFileSync(
      stubAuthPath,
      `module.exports = { requireAuthenticatedUserForAction: async () => ({ id: ${JSON.stringify(hrUser.id)} }) };`,
    );
    fs.writeFileSync(
      stubOrganizationsPath,
      `module.exports = { getActiveOrganizationForUser: async () => (${JSON.stringify(organizationRow)}) };`,
    );

    installActionBoundaryStubs({
      authPath: stubAuthPath,
      organizationsPath: stubOrganizationsPath,
    });

    const { createTeamDynamicsAssessmentAction } = require(actionPath);

    const formData = new FormData();
    formData.set("teamId", teamRow.id);
    formData.set("locale", "bs");

    const firstResult = await createTeamDynamicsAssessmentAction(formData);

    assert.equal(firstResult.ok, true);
    assert.equal(firstResult.teamId, teamRow.id);
    assert.equal(firstResult.assignmentAction, "created");
    assert.equal(firstResult.participantsCreated, 2);
    assert.equal(firstResult.attemptsCreated, 2);
    assert.equal(firstResult.attemptMappingsCreated, 2);

    cleanup.assignmentId = firstResult.assignmentId;

    const { data: assignmentRows, error: assignmentReadError } = await supabase
      .from("team_assessment_assignments")
      .select("id, team_id, package_slug, status, created_by_user_id")
      .eq("team_id", teamRow.id)
      .eq("package_slug", TEAM_DYNAMICS_TEST_SLUG)
      .order("created_at", { ascending: false });

    if (assignmentReadError) {
      throw new Error(`Failed to read smoke assignments: ${assignmentReadError.message}`);
    }

    assert.equal(assignmentRows.length, 1);
    assert.equal(assignmentRows[0].id, firstResult.assignmentId);
    assert.equal(assignmentRows[0].team_id, teamRow.id);
    assert.equal(assignmentRows[0].package_slug, TEAM_DYNAMICS_TEST_SLUG);
    assert.equal(assignmentRows[0].status, "active");
    assert.equal(assignmentRows[0].created_by_user_id, hrUser.id);

    const { data: assignmentParticipantRows, error: assignmentParticipantError } = await supabase
      .from("team_assessment_participants")
      .select("id, team_assessment_assignment_id, team_membership_id, participant_id, attempt_id, status")
      .eq("team_assessment_assignment_id", firstResult.assignmentId)
      .order("id", { ascending: true });

    if (assignmentParticipantError) {
      throw new Error(`Failed to read smoke wrapper participants: ${assignmentParticipantError.message}`);
    }

    assert.equal(assignmentParticipantRows.length, 2);
    assert.equal(assignmentParticipantRows.every((row) => row.status === "invited"), true);
    assert.equal(assignmentParticipantRows.every((row) => Boolean(row.attempt_id)), true);

    cleanup.createdAttemptIds = assignmentParticipantRows
      .flatMap((row) => (row.attempt_id ? [row.attempt_id] : []));

    const { data: attemptRows, error: attemptRowsError } = await supabase
      .from("attempts")
      .select("id, test_id, user_id, organization_id, participant_id, status, locale, addressing_form_snapshot")
      .in("id", cleanup.createdAttemptIds)
      .order("id", { ascending: true });

    if (attemptRowsError) {
      throw new Error(`Failed to read smoke attempts: ${attemptRowsError.message}`);
    }

    assert.equal(attemptRows.length, 2);
    assert.equal(attemptRows.every((attempt) => attempt.test_id === teamDynamicsTest.id), true);
    assert.equal(attemptRows.every((attempt) => attempt.organization_id === organizationRow.id), true);
    assert.equal(attemptRows.every((attempt) => attempt.status === "in_progress"), true);
    assert.equal(attemptRows.every((attempt) => attempt.locale === "bs"), true);

    const secondResult = await createTeamDynamicsAssessmentAction(formData);

    assert.equal(secondResult.ok, true);
    assert.equal(secondResult.assignmentId, firstResult.assignmentId);
    assert.equal(secondResult.assignmentAction, "reused");
    assert.equal(secondResult.participantsCreated, 0);
    assert.equal(secondResult.attemptsCreated, 0);
    assert.equal(secondResult.attemptMappingsCreated, 0);

    const { count: assignmentCountAfterReuse, error: assignmentReuseCountError } = await supabase
      .from("team_assessment_assignments")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamRow.id)
      .eq("package_slug", TEAM_DYNAMICS_TEST_SLUG)
      .eq("status", "active");

    if (assignmentReuseCountError) {
      throw new Error(`Failed to count assignments after reuse check: ${assignmentReuseCountError.message}`);
    }

    assert.equal(assignmentCountAfterReuse, 1);

    const { count: wrapperParticipantCountAfterReuse, error: wrapperReuseCountError } = await supabase
      .from("team_assessment_participants")
      .select("id", { count: "exact", head: true })
      .eq("team_assessment_assignment_id", firstResult.assignmentId);

    if (wrapperReuseCountError) {
      throw new Error(`Failed to count wrapper participants after reuse check: ${wrapperReuseCountError.message}`);
    }

    assert.equal(wrapperParticipantCountAfterReuse, 2);

    assert.equal(canUseGenericCandidateAttemptCreation(TEAM_DYNAMICS_TEST_SLUG), false);
    assert.deepEqual(
      getCandidateAssessmentAvailability({
        slug: TEAM_DYNAMICS_TEST_SLUG,
        name: "Procjena timske dinamike",
        status: "active",
        isActive: true,
        hasOrganizationAccess: true,
        activeQuestionCount: 36,
      }),
      {
        catalogKey: null,
        kind: "add_on",
        canStart: true,
        requiresOrganizationAccess: true,
        reason: "add_on_available",
      },
    );

    const detail = await getTeamAssessmentDetailForOrganization({
      organizationId: organizationRow.id,
      teamId: teamRow.id,
    });

    assert.ok(detail);
    assert.equal(detail.teamId, teamRow.id);
    assert.equal(detail.activeMemberCount, 2);
    assert.ok(detail.latestAssignment);
    assert.equal(detail.latestAssignment.assignmentId, firstResult.assignmentId);
    assert.equal(detail.latestAssignment.status, "active");
    assert.equal(detail.latestAssignment.invitedCount, 2);
    assert.equal(detail.latestAssignment.completedCount, 0);
    assert.equal(detail.latestAssignment.participants.every((participant) => participant.status === "invited"), true);
    assert.equal("attemptId" in detail.latestAssignment.participants[0], false);
    assert.equal("responses" in detail.latestAssignment.participants[0], false);
    assert.equal("score" in detail.latestAssignment.participants[0], false);
    assert.equal("report" in detail.latestAssignment.participants[0], false);
    assert.equal("reportCta" in detail.latestAssignment.participants[0], false);
    assert.equal("aiReportContent" in detail.latestAssignment.participants[0], false);
    assert.equal("teamFit" in detail.latestAssignment.participants[0], false);

    const { count: attemptReportCount, error: attemptReportError } = await supabase
      .from("attempt_reports")
      .select("id", { count: "exact", head: true })
      .in("attempt_id", cleanup.createdAttemptIds);

    if (attemptReportError) {
      throw new Error(`Failed to verify attempt_reports isolation: ${attemptReportError.message}`);
    }

    assert.equal(attemptReportCount, 0);

    const { count: singleTestAssessmentReportCountAfter, error: assessmentReportAfterError } = await supabase
      .from("assessment_reports")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "single_test")
      .eq("metadata->>test_slug", TEAM_DYNAMICS_TEST_SLUG);

    if (assessmentReportAfterError) {
      throw new Error(`Failed to verify assessment_reports isolation: ${assessmentReportAfterError.message}`);
    }

    assert.equal(singleTestAssessmentReportCountAfter, beforeSingleTestAssessmentReports);

    const reportPlan = planPostCompletionReportJobs({
      testSlug: TEAM_DYNAMICS_TEST_SLUG,
      existingReports: [],
    });
    assert.deepEqual(reportPlan.jobsToEnqueue, []);
    assert.equal(reportPlan.lanes.every((lane) => lane.capability.active === false), true);

    console.log(JSON.stringify({
      ok: true,
      skipped: false,
      env: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        db: "local",
      },
      action: {
        first_call: {
          assignment_id: firstResult.assignmentId,
          assignment_action: firstResult.assignmentAction,
          participants_created: firstResult.participantsCreated,
          attempts_created: firstResult.attemptsCreated,
          attempt_mappings_created: firstResult.attemptMappingsCreated,
        },
        second_call: {
          assignment_id: secondResult.assignmentId,
          assignment_action: secondResult.assignmentAction,
          participants_created: secondResult.participantsCreated,
          attempts_created: secondResult.attemptsCreated,
          attempt_mappings_created: secondResult.attemptMappingsCreated,
        },
      },
      assertions: {
        wrapper_assignment_rows: assignmentRows.length,
        wrapper_participant_rows: assignmentParticipantRows.length,
        created_attempt_rows: attemptRows.length,
        attempt_reports_for_created_attempts: attemptReportCount,
        assessment_reports_single_test_delta:
          singleTestAssessmentReportCountAfter - beforeSingleTestAssessmentReports,
        admin_detail_safe_read: true,
        generic_candidate_entry_blocked: true,
      },
    }, null, 2));
  } catch (error) {
    if (
      error instanceof Error &&
      /fetch failed|networkerror|connect|ECONNREFUSED|Failed to create auth user|Failed to load Team Dynamics test precondition/i.test(
        error.message,
      )
    ) {
      console.log(JSON.stringify(
        buildSkipResult(error.message, {
          tested: "script wiring, local env guards, smoke precondition checks",
          skipped_target: "real local DB-backed Team Dynamics action smoke",
        }),
        null,
        2,
      ));
      return;
    }

    throw error;
  } finally {
    Module._resolveFilename = originalResolveFilename;
    require.extensions[".ts"] = compileTypeScript;

    if (hasLocalSupabaseEnv() && isLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      try {
        const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
        const supabase = createSupabaseAdminClient();

        if (cleanup.createdAttemptIds.length > 0) {
          await safeDeleteRows(supabase, "attempts", (query) => query.in("id", cleanup.createdAttemptIds));
        }

        if (cleanup.assignmentId) {
          await safeDeleteRows(
            supabase,
            "team_assessment_participants",
            (query) => query.eq("team_assessment_assignment_id", cleanup.assignmentId),
          );
          await safeDeleteRows(
            supabase,
            "team_assessment_assignments",
            (query) => query.eq("id", cleanup.assignmentId),
          );
        }

        if (cleanup.teamId) {
          await safeDeleteRows(supabase, "team_memberships", (query) => query.eq("team_id", cleanup.teamId));
          await safeDeleteRows(supabase, "teams", (query) => query.eq("id", cleanup.teamId));
        }

        if (cleanup.participantIds.length > 0) {
          await safeDeleteRows(supabase, "participants", (query) => query.in("id", cleanup.participantIds));
        }

        if (cleanup.organizationMembershipId) {
          await safeDeleteRows(supabase, "organization_memberships", (query) => query.eq("id", cleanup.organizationMembershipId));
        }

        if (cleanup.organizationId) {
          await safeDeleteRows(supabase, "organizations", (query) => query.eq("id", cleanup.organizationId));
        }

        for (const userId of cleanup.authUserIds) {
          await safeDeleteAuthUser(supabase, userId);
        }
      } catch (cleanupError) {
        console.warn(
          cleanupError instanceof Error
            ? `Team Dynamics action DB smoke cleanup warning: ${cleanupError.message}`
            : `Team Dynamics action DB smoke cleanup warning: ${String(cleanupError)}`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
