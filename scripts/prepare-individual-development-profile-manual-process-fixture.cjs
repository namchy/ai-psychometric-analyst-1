const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const FIXTURE = {
  organizationName: "IDP Manual Process Review",
  organizationSlug: "idp-manual-process-review",
  hrEmail: "idp-manual-process-hr@example.test",
  hrPassword:
    process.env.IDP_MANUAL_PROCESS_HR_PASSWORD || "IdpManualProcess123!",
  participantEmail: "idp-manual-process-candidate@example.test",
  participantName: "IDP Manual Process Candidate",
  forbiddenTokens: [
    "rawAnswers",
    "rawResponses",
    "input_snapshot",
    "report_snapshot",
    "error_message",
    "fullSnapshot",
    "rawItemText",
    "candidateFacing",
    "candidateFacingOutput",
    "fitScore",
    "hireRecommendation",
    "noHireRecommendation",
  ],
  requiredTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
};

function getAppUrl() {
  return (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}

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
      resolveJsonModule: true,
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

function assertNoForbiddenTokens(value, label) {
  const serialized = JSON.stringify(value);

  for (const token of FIXTURE.forbiddenTokens) {
    assert.equal(
      serialized.includes(`"${token}"`) || serialized.includes(token),
      false,
      `${label} must not contain forbidden token ${token}.`,
    );
  }
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
        role: "hr_admin",
        smoke_fixture: "individual_development_profile_manual_process_review",
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
      role: "hr_admin",
      smoke_fixture: "individual_development_profile_manual_process_review",
    },
  });

  if (error || !data?.user?.id) {
    throw new Error(`Failed to create auth user ${input.email}: ${error?.message ?? "unknown error"}`);
  }

  return data.user;
}

async function ensureOrganization(supabase, input) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("slug", input.organizationSlug)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load fixture organization: ${error.message}`);
  }

  if (data?.[0]?.id) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("organizations")
      .update({
        name: input.organizationName,
        status: "active",
      })
      .eq("id", data[0].id)
      .select("id, name, slug, status")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(`Failed to update fixture organization: ${updateError?.message ?? "unknown error"}`);
    }

    return updatedRows[0];
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("organizations")
    .insert({
      name: input.organizationName,
      slug: input.organizationSlug,
      status: "active",
    })
    .select("id, name, slug, status")
    .limit(1);

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(`Failed to create fixture organization: ${insertError?.message ?? "unknown error"}`);
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
    throw new Error(`Failed to load fixture organization membership: ${error.message}`);
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
      throw new Error(`Failed to update fixture organization membership: ${updateError?.message ?? "unknown error"}`);
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
    throw new Error(`Failed to create fixture organization membership: ${insertError?.message ?? "unknown error"}`);
  }

  return insertedRows[0];
}

async function safeDeleteByIds(supabase, table, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return;
  }

  const { error } = await supabase.from(table).delete().in("id", ids);

  if (error) {
    throw new Error(`Failed to delete ${table}: ${error.message}`);
  }
}

async function safeDeleteByAttemptIds(supabase, table, attemptIds) {
  if (!Array.isArray(attemptIds) || attemptIds.length === 0) {
    return;
  }

  const { error } = await supabase.from(table).delete().in("attempt_id", attemptIds);

  if (error) {
    throw new Error(`Failed to delete ${table} by attempt ids: ${error.message}`);
  }
}

async function cleanupParticipantFixture(supabase, input) {
  const { data: participantRows, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("email", input.participantEmail);

  if (participantError) {
    throw new Error(`Failed to load existing fixture participants: ${participantError.message}`);
  }

  const participantIds = (participantRows ?? []).map((row) => row.id).filter(isNonEmptyString);

  if (participantIds.length === 0) {
    return;
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("assessment_assignments")
    .select("id")
    .eq("organization_id", input.organizationId)
    .in("participant_id", participantIds);

  if (assignmentError) {
    throw new Error(`Failed to load existing fixture assignments: ${assignmentError.message}`);
  }

  const assignmentIds = (assignmentRows ?? []).map((row) => row.id).filter(isNonEmptyString);

  let attemptIds = [];

  if (assignmentIds.length > 0) {
    const { data: linkedAttemptRows, error: linkedAttemptError } = await supabase
      .from("assessment_assignment_attempts")
      .select("attempt_id")
      .in("assessment_assignment_id", assignmentIds);

    if (linkedAttemptError) {
      throw new Error(`Failed to load existing linked attempts: ${linkedAttemptError.message}`);
    }

    attemptIds = (linkedAttemptRows ?? [])
      .map((row) => row.attempt_id)
      .filter(isNonEmptyString);

    const {
      data: reportRows,
      error: reportRowsError,
    } = await supabase
      .from("assessment_reports")
      .select("id")
      .in("assessment_assignment_id", assignmentIds);

    if (reportRowsError) {
      throw new Error(`Failed to load existing assessment_reports: ${reportRowsError.message}`);
    }

    await safeDeleteByIds(
      supabase,
      "assessment_reports",
      (reportRows ?? []).map((row) => row.id).filter(isNonEmptyString),
    );

    const { error: deleteLinksError } = await supabase
      .from("assessment_assignment_attempts")
      .delete()
      .in("assessment_assignment_id", assignmentIds);

    if (deleteLinksError) {
      throw new Error(`Failed to delete assessment_assignment_attempts: ${deleteLinksError.message}`);
    }
  }

  if (attemptIds.length > 0) {
    const { data: responseRows, error: responseError } = await supabase
      .from("responses")
      .select("id")
      .in("attempt_id", attemptIds);

    if (responseError) {
      throw new Error(`Failed to load existing fixture responses: ${responseError.message}`);
    }

    const responseIds = (responseRows ?? []).map((row) => row.id).filter(isNonEmptyString);

    if (responseIds.length > 0) {
      const { error: selectionError } = await supabase
        .from("response_selections")
        .delete()
        .in("response_id", responseIds);

      if (selectionError) {
        throw new Error(`Failed to delete response selections: ${selectionError.message}`);
      }
    }

    await safeDeleteByAttemptIds(supabase, "responses", attemptIds);
    await safeDeleteByAttemptIds(supabase, "dimension_scores", attemptIds);
    await safeDeleteByIds(supabase, "attempts", attemptIds);
  }

  if (assignmentIds.length > 0) {
    await safeDeleteByIds(supabase, "assessment_assignments", assignmentIds);
  }

  await safeDeleteByIds(supabase, "participants", participantIds);
}

async function deleteOrganizationIfEmpty(supabase, organizationId) {
  const { count: participantCount, error: participantError } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (participantError) {
    throw new Error(`Failed to count organization participants: ${participantError.message}`);
  }

  if ((participantCount ?? 0) > 0) {
    return;
  }

  const { count: membershipCount, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (membershipError) {
    throw new Error(`Failed to count organization memberships: ${membershipError.message}`);
  }

  if ((membershipCount ?? 0) > 0) {
    return;
  }

  const { error: deleteOrganizationError } = await supabase
    .from("organizations")
    .delete()
    .eq("id", organizationId);

  if (deleteOrganizationError) {
    throw new Error(`Failed to delete empty fixture organization: ${deleteOrganizationError.message}`);
  }
}

async function insertParticipant(supabase, organizationId, participantInput) {
  const { data, error } = await supabase
    .from("participants")
    .insert({
      organization_id: organizationId,
      user_id: null,
      email: participantInput.email,
      full_name: participantInput.fullName,
      participant_type: "candidate",
      status: "active",
      addressing_form: "feminine",
    })
    .select("id, full_name, email, addressing_form")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create fixture participant: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

async function insertCompletedAssignment(supabase, input) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("assessment_assignments")
    .insert({
      organization_id: input.organizationId,
      participant_id: input.participantId,
      assignment_type: "standard_battery",
      status: "completed",
      locale: "bs",
      created_by_user_id: input.createdByUserId ?? null,
      completed_at: now,
      metadata: {
        fixtureToken: input.fixtureToken,
        lane: "idp_manual_process_browser_review",
      },
    })
    .select("id, organization_id, participant_id, assignment_type, status, locale, created_at")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create fixture assessment assignment: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

async function loadActiveTests(supabase) {
  const { data, error } = await supabase
    .from("tests")
    .select("id, slug, status, is_active")
    .in("slug", FIXTURE.requiredTestSlugs)
    .eq("is_active", true)
    .order("slug", { ascending: true });

  if (error) {
    throw new Error(`Failed to load standard battery tests: ${error.message}`);
  }

  const testsBySlug = new Map((data ?? []).map((row) => [row.slug, row]));

  for (const slug of FIXTURE.requiredTestSlugs) {
    if (!testsBySlug.has(slug)) {
      throw new Error(`Missing active test fixture dependency for ${slug}.`);
    }
  }

  return testsBySlug;
}

async function loadRequiredQuestionsWithOptions(supabase, testId) {
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, question_type, is_required, question_order")
    .eq("test_id", testId)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (questionsError) {
    throw new Error(`Failed to load questions for test ${testId}: ${questionsError.message}`);
  }

  const requiredQuestions = (questions ?? []).filter((question) => question.is_required);

  if (requiredQuestions.length === 0) {
    throw new Error(`Test ${testId} has no required questions for manual process fixture.`);
  }

  const nonTextQuestionIds = requiredQuestions
    .filter((question) => question.question_type !== "text")
    .map((question) => question.id);

  const { data: answerOptions, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("id, question_id, option_order")
    .in("question_id", nonTextQuestionIds)
    .order("question_id", { ascending: true })
    .order("option_order", { ascending: true });

  if (answerOptionsError) {
    throw new Error(`Failed to load answer options for test ${testId}: ${answerOptionsError.message}`);
  }

  const answerOptionsByQuestionId = (answerOptions ?? []).reduce((grouped, option) => {
    const questionOptions = grouped.get(option.question_id) ?? [];
    questionOptions.push(option);
    grouped.set(option.question_id, questionOptions);
    return grouped;
  }, new Map());

  return {
    requiredQuestions,
    answerOptionsByQuestionId,
  };
}

async function insertAnswerForQuestion(supabase, input) {
  if (input.question.question_type === "text") {
    const { error } = await supabase.from("responses").insert({
      attempt_id: input.attemptId,
      question_id: input.question.id,
      response_kind: "text",
      text_value: `Manual process fixture response for ${input.question.code}`,
    });

    if (error) {
      throw new Error(`Failed to insert text response for ${input.question.code}: ${error.message}`);
    }

    return;
  }

  const options = input.answerOptionsByQuestionId.get(input.question.id) ?? [];
  const selectedOption = options[input.optionIndex % Math.max(options.length, 1)] ?? options[0];

  if (!selectedOption) {
    throw new Error(`Missing answer option for ${input.question.code}.`);
  }

  if (input.question.question_type === "single_choice") {
    const { error } = await supabase.from("responses").insert({
      attempt_id: input.attemptId,
      question_id: input.question.id,
      response_kind: "single_choice",
      answer_option_id: selectedOption.id,
    });

    if (error) {
      throw new Error(`Failed to insert single choice response for ${input.question.code}: ${error.message}`);
    }

    return;
  }

  const { data: responseRow, error: responseError } = await supabase
    .from("responses")
    .insert({
      attempt_id: input.attemptId,
      question_id: input.question.id,
      response_kind: "multiple_choice",
    })
    .select("id")
    .single();

  if (responseError || !responseRow?.id) {
    throw new Error(`Failed to insert multiple choice response for ${input.question.code}: ${responseError?.message ?? "unknown error"}`);
  }

  const { error: selectionError } = await supabase.from("response_selections").insert({
    response_id: responseRow.id,
    question_id: input.question.id,
    answer_option_id: selectedOption.id,
  });

  if (selectionError) {
    throw new Error(`Failed to insert multiple choice selection for ${input.question.code}: ${selectionError.message}`);
  }
}

async function createCompletedAttemptWithPersistedResults(supabase, input, deps) {
  const { requiredQuestions, answerOptionsByQuestionId } = await loadRequiredQuestionsWithOptions(
    supabase,
    input.test.id,
  );

  const now = new Date().toISOString();
  const { data: attemptRow, error: attemptError } = await supabase
    .from("attempts")
    .insert({
      test_id: input.test.id,
      user_id: null,
      organization_id: input.organizationId,
      participant_id: input.participantId,
      locale: "bs",
      addressing_form_snapshot: input.addressingFormSnapshot ?? "feminine",
      status: "completed",
      started_at: now,
      completed_at: now,
    })
    .select("id, test_id, participant_id, organization_id, status, completed_at")
    .single();

  if (attemptError || !attemptRow?.id) {
    throw new Error(`Failed to create completed attempt for ${input.test.slug}: ${attemptError?.message ?? "unknown error"}`);
  }

  let questionIndex = 0;

  for (const question of requiredQuestions) {
    await insertAnswerForQuestion(supabase, {
      attemptId: attemptRow.id,
      question,
      answerOptionsByQuestionId,
      optionIndex: (input.answerSeedOffset + questionIndex) % 7,
    });
    questionIndex += 1;
  }

  const results = await deps.persistCompletedAssessmentResults(input.test.id, attemptRow.id);

  if (!results) {
    throw new Error(`Deterministic results were not produced for ${input.test.slug}.`);
  }

  return {
    id: attemptRow.id,
    test_id: input.test.id,
    test_slug: input.test.slug,
    results,
    answeredQuestionCount: requiredQuestions.length,
  };
}

async function prepareCoreFixture(options = {}) {
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return buildSkipResult("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", {
      fixtureType: "idp_manual_process_browser_review",
    });
  }

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const { persistCompletedAssessmentResults } = require("../lib/assessment/scoring.ts");
  const {
    buildAssignmentAttemptLinks,
  } = require("../lib/assessment/assignments.ts");
  const {
    buildIndividualDevelopmentProfileInputSnapshot,
  } = require("../lib/assessment/individual-development-profile-input.ts");
  const {
    loadIndividualDevelopmentProfileDisplay,
  } = require("../lib/assessment/individual-development-profile-display.ts");
  const {
    listIndividualDevelopmentProfileReportEntries,
  } = require("../lib/assessment/individual-development-profile-report-list.ts");
  const {
    queueIndividualDevelopmentProfileAssessmentReport,
  } = require("../lib/assessment/individual-development-profile-lifecycle.ts");

  const supabase = createSupabaseAdminClient();
  const token = options.token ?? crypto.randomUUID().slice(0, 8);
  const stable = options.stable !== false;
  const organizationSlug = stable
    ? FIXTURE.organizationSlug
    : `idp-manual-process-${token}`;
  const organizationName = stable
    ? FIXTURE.organizationName
    : `IDP Manual Process ${token}`;
  const participantEmail = stable
    ? FIXTURE.participantEmail
    : `idp-manual-process-${token}@example.test`;
  const participantName = stable
    ? FIXTURE.participantName
    : `IDP Manual Process Candidate ${token}`;
  const ensureHrLogin = options.ensureHrLogin !== false;

  let hrUser = null;
  let membership = null;

  if (ensureHrLogin) {
    hrUser = await ensureAuthUser(supabase, {
      email: stable ? FIXTURE.hrEmail : `idp-manual-process-hr-${token}@example.test`,
      password: stable ? FIXTURE.hrPassword : FIXTURE.hrPassword,
    });
  }

  const organization = await ensureOrganization(supabase, {
    organizationSlug,
    organizationName,
  });

  if (ensureHrLogin && hrUser?.id) {
    membership = await ensureOrganizationMembership(supabase, {
      organizationId: organization.id,
      userId: hrUser.id,
    });
  }

  if (stable) {
    await cleanupParticipantFixture(supabase, {
      organizationId: organization.id,
      participantEmail,
    });
  }

  const participant = await insertParticipant(supabase, organization.id, {
    email: participantEmail,
    fullName: participantName,
  });

  const assignment = await insertCompletedAssignment(supabase, {
    organizationId: organization.id,
    participantId: participant.id,
    createdByUserId: hrUser?.id ?? null,
    fixtureToken: token,
  });

  const testsBySlug = await loadActiveTests(supabase);
  const attemptPlans = [
    { slug: "ipip-neo-120-v1", answerSeedOffset: 1 },
    { slug: "safran_v1", answerSeedOffset: 2 },
    { slug: "mwms_v1", answerSeedOffset: 3 },
  ];

  const linkedAttempts = [];

  for (const plan of attemptPlans) {
    const linkedAttempt = await createCompletedAttemptWithPersistedResults(
      supabase,
      {
        test: testsBySlug.get(plan.slug),
        organizationId: organization.id,
        participantId: participant.id,
        addressingFormSnapshot: participant.addressing_form ?? "feminine",
        answerSeedOffset: plan.answerSeedOffset,
      },
      {
        persistCompletedAssessmentResults,
      },
    );
    linkedAttempts.push(linkedAttempt);
  }

  const attemptLinks = buildAssignmentAttemptLinks({
    assignmentId: assignment.id,
    attempts: linkedAttempts.map((attempt) => ({
      id: attempt.id,
      test_id: attempt.test_id,
      test_slug: attempt.test_slug,
    })),
  });

  const { error: linkError } = await supabase
    .from("assessment_assignment_attempts")
    .insert(attemptLinks);

  if (linkError) {
    throw new Error(`Failed to link assessment attempts to assignment: ${linkError.message}`);
  }

  const inputResult = await buildIndividualDevelopmentProfileInputSnapshot({
    assessmentAssignmentId: assignment.id,
    organizationId: organization.id,
    participantId: participant.id,
    locale: "bs",
  });

  assert.equal(inputResult.ok, true, inputResult.ok ? "" : inputResult.details);

  const inputSnapshot = inputResult.inputSnapshot;
  assert.equal(inputSnapshot.sourceSignals.personality.sourceStatus, "available");
  assert.equal(inputSnapshot.sourceSignals.motivation.sourceStatus, "available");
  assert.equal(inputSnapshot.sourceSignals.problemSolving.sourceStatus, "available");
  assert.equal(inputSnapshot.sourceSignals.composite.sourceStatus, "available");
  assertNoForbiddenTokens(inputSnapshot, "IDP manual-process input snapshot");

  const queueResult = await queueIndividualDevelopmentProfileAssessmentReport({
    assessmentAssignmentId: assignment.id,
    organizationId: organization.id,
    participantId: participant.id,
    requestedByUserId: hrUser?.id ?? null,
  });

  assert.equal(queueResult.ok, true, queueResult.ok ? "" : queueResult.details);
  assert.equal(queueResult.action, "queued");
  assert.equal(queueResult.report?.report_status, "queued");
  assert.equal(isNonEmptyString(queueResult.report?.id), true);

  const entries = await listIndividualDevelopmentProfileReportEntries({
    organizationId: organization.id,
    participantId: participant.id,
  });

  const queuedEntry = entries.find((entry) => entry.id === queueResult.report.id) ?? null;
  assert(queuedEntry, "Queued IDP entry must be visible in participant reports list.");
  assert.equal(queuedEntry.status, "queued");
  assertNoForbiddenTokens(entries, "IDP manual-process list entries");

  const queuedDisplay = await loadIndividualDevelopmentProfileDisplay({
    assessmentReportId: queueResult.report.id,
    organizationId: organization.id,
  });

  assert.equal(queuedDisplay.ok, true);
  assert.equal(queuedDisplay.status, "queued");

  return {
    ok: true,
    skipped: false,
    fixtureType: "idp_manual_process_browser_review",
    hrLogin: hrUser
      ? {
          email: hrUser.email ?? (stable ? FIXTURE.hrEmail : null),
          password: stable ? FIXTURE.hrPassword : FIXTURE.hrPassword,
          membershipRole: membership?.role ?? null,
        }
      : null,
    fixture: {
      organizationId: organization.id,
      organizationSlug: organization.slug,
      participantId: participant.id,
      participantEmail: participant.email,
      assessmentAssignmentId: assignment.id,
      queuedAssessmentReportId: queueResult.report.id,
      linkedAttemptIds: linkedAttempts.map((attempt) => attempt.id),
      linkedAttemptTestSlugs: linkedAttempts.map((attempt) => attempt.test_slug),
    },
    diagnostics: {
      sourceStatuses: {
        personality: inputSnapshot.sourceSignals.personality.sourceStatus,
        motivation: inputSnapshot.sourceSignals.motivation.sourceStatus,
        problemSolving: inputSnapshot.sourceSignals.problemSolving.sourceStatus,
        composite: inputSnapshot.sourceSignals.composite.sourceStatus,
      },
      answeredQuestionCounts: Object.fromEntries(
        linkedAttempts.map((attempt) => [attempt.test_slug, attempt.answeredQuestionCount]),
      ),
      linkedAttemptCoverage: linkedAttempts.map((attempt) => ({
        attemptId: attempt.id,
        testSlug: attempt.test_slug,
      })),
    },
    urls: {
      participantReportsRelative: `/dashboard/participants/${participant.id}/reports`,
      participantReportsAbsolute: `${getAppUrl()}/dashboard/participants/${participant.id}/reports`,
      queuedReportRelative: `/dashboard/individual-development-profile-reports/${queueResult.report.id}`,
      queuedReportAbsolute: `${getAppUrl()}/dashboard/individual-development-profile-reports/${queueResult.report.id}`,
    },
    manualReviewChecklist: [
      `Login kao HR fixture user: ${hrUser?.email ?? "n/a"}`,
      `Otvori participant reports URL: /dashboard/participants/${participant.id}/reports`,
      "Na queued IDP kartici klikni 'Pripremi individualni razvojni profil'.",
      "Potvrdi da nakon akcije kartica više nije queued.",
      "Potvrdi da se pojavi 'SPREMNO'.",
      "Potvrdi da se pojavi CTA 'Otvori individualni razvojni profil'.",
      "Klikni 'Otvori individualni razvojni profil'.",
      `Očekivani dedicated IDP route nakon obrade: /dashboard/individual-development-profile-reports/${queueResult.report.id}`,
      "Potvrdi da dedicated route prikazuje 'Individualni razvojni profil' ili odgovarajući HR-facing naslov.",
      "Potvrdi da report izgleda kao HR/development guidance, ne kao candidate report.",
      "Potvrdi da nema input_snapshot.",
      "Potvrdi da nema report_snapshot.",
      "Potvrdi da nema error_message.",
      "Potvrdi da nema raw JSON.",
      "Potvrdi da nema OpenAI/provider tehničkog copy-ja.",
      "Potvrdi da nema numeric fit score-a.",
      "Potvrdi da nema hire/no-hire jezika.",
      "Potvrdi da nema dijagnoza.",
      "Potvrdi da nema candidate-facing 'ti' outputa.",
      "Potvrdi da nema raw answers.",
      "Potvrdi da nema raw item texta.",
      "Potvrdi da nema scoring keys.",
      "Potvrdi da nema full upstream snapshot dumpa.",
      "Potvrdi da view route ne generiše novi report.",
      "Potvrdi da nema retry/reset CTA-a.",
    ],
    cleanupContext: {
      stable,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      participantEmail,
      participantId: participant.id,
      assessmentAssignmentId: assignment.id,
      attemptIds: linkedAttempts.map((attempt) => attempt.id),
      assessmentReportId: queueResult.report.id,
      deleteOrganizationIfEmpty: !stable,
    },
  };
}

async function cleanupIndividualDevelopmentProfileManualProcessFixture(context) {
  if (!context || !isNonEmptyString(context.organizationId) || !isNonEmptyString(context.participantEmail)) {
    return;
  }

  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const supabase = createSupabaseAdminClient();

  await cleanupParticipantFixture(supabase, {
    organizationId: context.organizationId,
    participantEmail: context.participantEmail,
  });

  if (context.deleteOrganizationIfEmpty) {
    await deleteOrganizationIfEmpty(supabase, context.organizationId);
  }
}

async function prepareIndividualDevelopmentProfileManualProcessFixture(options = {}) {
  return prepareCoreFixture(options);
}

async function main() {
  const result = await prepareIndividualDevelopmentProfileManualProcessFixture({
    stable: true,
    ensureHrLogin: true,
  });

  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  prepareIndividualDevelopmentProfileManualProcessFixture,
  cleanupIndividualDevelopmentProfileManualProcessFixture,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? `IDP manual process fixture script failed: ${error.message}`
        : `IDP manual process fixture script failed: ${String(error)}`,
    );
    process.exit(1);
  });
}
