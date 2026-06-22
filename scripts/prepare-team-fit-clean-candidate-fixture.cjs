const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_TEAM_FIT_CLEAN_CANDIDATE_FIXTURE_WRITE";
const TARGET_ORGANIZATION_ID_ENV = "TARGET_ORGANIZATION_ID";
const TARGET_PARTICIPANT_ID_ENV = "TARGET_PARTICIPANT_ID";
const TARGET_TEAM_AGGREGATION_SNAPSHOT_ID_ENV = "TARGET_TEAM_AGGREGATION_SNAPSHOT_ID";

const EXPECTED_TARGETS = {
  organizationId: "d4508f7a-bc88-4870-8e90-d6487aa8ec3a",
  participantId: "38a5d1e4-ee4e-4b1b-9bb3-050e1bfb93bf",
  teamAggregationSnapshotId: "01716095-a273-4eb0-a14c-5facd90a7532",
};

const REQUIRED_TEST_SLUGS = ["ipip-neo-120-v1", "safran_v1", "mwms_v1"];

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

function installTypeScriptRuntime() {
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
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeEnvString(value) {
  return isNonEmptyString(value) ? value.trim() : null;
}

function getTargetInputs(env = process.env) {
  return {
    organizationId: normalizeEnvString(env[TARGET_ORGANIZATION_ID_ENV]),
    participantId: normalizeEnvString(env[TARGET_PARTICIPANT_ID_ENV]),
    teamAggregationSnapshotId: normalizeEnvString(env[TARGET_TEAM_AGGREGATION_SNAPSHOT_ID_ENV]),
  };
}

function buildBaseArtifact(input = {}) {
  return {
    metadata: {
      script: "prepare_team_fit_clean_candidate_fixture_v1",
      devOnly: true,
      dryRun: input.dryRun ?? true,
      writeModeConfirmed: input.writeModeConfirmed ?? false,
      databaseWrites: false,
      openAiCalled: false,
      teamFitProviderCalled: false,
      teamFitReportGenerated: false,
      reportGenerated: false,
      reportRegenerated: false,
      teamFitReportsTouched: false,
      teamDynamicsAggregationChanged: false,
      workerOrSchedulerRun: false,
      uiOrRendererChanged: false,
      migrationOrSchemaChanged: false,
      compositeHrRuntimeChanged: false,
    },
    inputs: {
      organizationId: input.organizationId ?? null,
      participantId: input.participantId ?? null,
      teamAggregationSnapshotId: input.teamAggregationSnapshotId ?? null,
      requiredTestSlugs: [...REQUIRED_TEST_SLUGS],
    },
    status: input.status ?? "not_started",
    assessmentAssignmentId: null,
    createdAttemptIds: [],
    reused: false,
    blockers: [],
    findings: [],
    nextReadOnlyInspectorCommand: null,
  };
}

function buildInspectorCommand(input) {
  return [
    "CONFIRM_TEAM_FIT_DB_SOURCE_AUDIT=true",
    `TEAM_FIT_CANDIDATE_ASSESSMENT_ASSIGNMENT_ID=${input.assessmentAssignmentId}`,
    `TEAM_FIT_TEAM_AGGREGATION_SNAPSHOT_ID=${input.teamAggregationSnapshotId}`,
    "node --env-file=.env.local scripts/inspect-team-fit-db-sources.cjs",
  ].join(" \\\n");
}

function validateConfirmedTargetInputs(env = process.env) {
  const inputs = getTargetInputs(env);
  const missing = [];
  const mismatches = [];

  for (const [key, envName] of [
    ["organizationId", TARGET_ORGANIZATION_ID_ENV],
    ["participantId", TARGET_PARTICIPANT_ID_ENV],
    ["teamAggregationSnapshotId", TARGET_TEAM_AGGREGATION_SNAPSHOT_ID_ENV],
  ]) {
    if (!inputs[key]) {
      missing.push(envName);
    } else if (inputs[key] !== EXPECTED_TARGETS[key]) {
      mismatches.push({
        env: envName,
        expected: EXPECTED_TARGETS[key],
        received: inputs[key],
      });
    }
  }

  return {
    ok: missing.length === 0 && mismatches.length === 0,
    inputs,
    missing,
    mismatches,
  };
}

function buildConfirmationRequiredArtifact(env = process.env) {
  const inputs = getTargetInputs(env);
  const artifact = buildBaseArtifact({
    ...inputs,
    dryRun: true,
    writeModeConfirmed: false,
    status: "confirmation_required",
  });

  artifact.blockers.push(`${CONFIRM_ENV}=true is required before any DB write path can run.`);
  artifact.findings.push({
    severity: "info",
    category: "dry_run",
    message: "Default mode is no-write and does not prepare fixture data.",
  });

  return artifact;
}

function buildInvalidTargetArtifact(validation) {
  const artifact = buildBaseArtifact({
    ...validation.inputs,
    dryRun: true,
    writeModeConfirmed: true,
    status: "confirmation_required",
  });

  if (validation.missing.length > 0) {
    artifact.blockers.push("missing_target_env");
    artifact.findings.push({
      severity: "blocker",
      category: "target_env",
      message: "Confirmed mode requires explicit target env vars.",
      missing: validation.missing,
    });
  }

  if (validation.mismatches.length > 0) {
    artifact.blockers.push("target_env_mismatch");
    artifact.findings.push({
      severity: "blocker",
      category: "target_env",
      message: "Target env vars do not match the approved clean fixture context.",
      mismatches: validation.mismatches,
    });
  }

  return artifact;
}

async function loadTargetParticipant(supabase, input) {
  const { data, error } = await supabase
    .from("participants")
    .select("id, organization_id, full_name, email, user_id, addressing_form")
    .eq("id", input.participantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load target participant: ${error.message}`);
  }

  if (!data) {
    return {
      ok: false,
      reason: "target_participant_not_found",
    };
  }

  if (data.organization_id !== input.organizationId) {
    return {
      ok: false,
      reason: "target_participant_organization_mismatch",
      participant: data,
    };
  }

  return {
    ok: true,
    participant: data,
  };
}

async function loadAndVerifyTeamAggregation(supabase, input, deps) {
  const { data: snapshot, error: snapshotError } = await supabase
    .from("team_assessment_aggregation_snapshots")
    .select(
      "id, team_assessment_assignment_id, team_id, aggregation_version, aggregation_status, participant_count, completed_participant_count, included_score_count, missing_completed_score_participant_ids, aggregation_snapshot",
    )
    .eq("id", input.teamAggregationSnapshotId)
    .maybeSingle();

  if (snapshotError) {
    throw new Error(`Failed to load Team Dynamics aggregation snapshot: ${snapshotError.message}`);
  }

  if (!snapshot) {
    return {
      ok: false,
      reason: "team_aggregation_snapshot_not_found",
    };
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, organization_id, name")
    .eq("id", snapshot.team_id)
    .maybeSingle();

  if (teamError) {
    throw new Error(`Failed to load Team Dynamics snapshot team: ${teamError.message}`);
  }

  if (!team) {
    return {
      ok: false,
      reason: "team_for_aggregation_snapshot_not_found",
      snapshot,
    };
  }

  if (team.organization_id !== input.organizationId) {
    return {
      ok: false,
      reason: "team_organization_mismatch",
      snapshot,
      team,
    };
  }

  const verification = await deps.loadTeamDynamicsFinalAggregationVerification({
    teamAssessmentAssignmentId: snapshot.team_assessment_assignment_id,
    aggregationVersion: snapshot.aggregation_version,
  });

  const missingCompletedScoreCount = Array.isArray(snapshot.missing_completed_score_participant_ids)
    ? snapshot.missing_completed_score_participant_ids.length
    : 0;
  const rowLooksReady =
    snapshot.aggregation_status === "ready" &&
    snapshot.participant_count === snapshot.completed_participant_count &&
    snapshot.included_score_count > 0 &&
    missingCompletedScoreCount === 0 &&
    snapshot.aggregation_snapshot !== null;
  const verificationLooksReady =
    verification.status === "ready" &&
    verification.incompleteMemberCount === 0 &&
    verification.missingScoreCount === 0 &&
    verification.invalidScoreCount === 0;

  if (!rowLooksReady || !verificationLooksReady) {
    return {
      ok: false,
      reason: "team_aggregation_not_ready_full_coverage",
      snapshot: {
        id: snapshot.id,
        aggregationStatus: snapshot.aggregation_status,
        participantCount: snapshot.participant_count,
        completedParticipantCount: snapshot.completed_participant_count,
        includedScoreCount: snapshot.included_score_count,
        missingCompletedScoreCount,
        aggregationSnapshotPresent: snapshot.aggregation_snapshot !== null,
      },
      verification: {
        status: verification.status,
        incompleteMemberCount: verification.incompleteMemberCount,
        missingScoreCount: verification.missingScoreCount,
        invalidScoreCount: verification.invalidScoreCount,
        reason: verification.reason,
      },
    };
  }

  return {
    ok: true,
    snapshot,
    team,
    verification,
  };
}

async function loadAssignmentsForTarget(supabase, input) {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, assignment_type, status, locale, created_at, completed_at")
    .eq("organization_id", input.organizationId)
    .eq("participant_id", input.participantId)
    .eq("assignment_type", "standard_battery")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load target assessment assignments: ${error.message}`);
  }

  return data ?? [];
}

function hasCompleteRequiredCompositeCoverage(snapshot) {
  const coverage = snapshot?.coverage ?? {};
  const completed = new Set(Array.isArray(coverage.completedTestSlugs) ? coverage.completedTestSlugs : []);

  return (
    coverage.requiredCount === REQUIRED_TEST_SLUGS.length &&
    coverage.completedCount === REQUIRED_TEST_SLUGS.length &&
    Array.isArray(coverage.missingTestSlugs) &&
    coverage.missingTestSlugs.length === 0 &&
    REQUIRED_TEST_SLUGS.every((slug) => completed.has(slug))
  );
}

async function findReusableAssignment(input) {
  for (const assignment of input.assignments) {
    try {
      const snapshot = await input.deps.buildCompositeHrInputSnapshot({
        assessmentAssignmentId: assignment.id,
        organizationId: input.organizationId,
        participantId: input.participantId,
        locale: assignment.locale ?? "bs",
      });

      if (hasCompleteRequiredCompositeCoverage(snapshot)) {
        return {
          assignment,
          snapshot,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function loadExistingRequiredAttempts(supabase, input) {
  const { data: tests, error: testsError } = await supabase
    .from("tests")
    .select("id, slug")
    .in("slug", REQUIRED_TEST_SLUGS);

  if (testsError) {
    throw new Error(`Failed to load required test ids: ${testsError.message}`);
  }

  const requiredTestIds = (tests ?? []).map((test) => test.id);

  if (requiredTestIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("attempts")
    .select("id, test_id, status, completed_at, tests(slug)")
    .eq("organization_id", input.organizationId)
    .eq("participant_id", input.participantId)
    .in("test_id", requiredTestIds)
    .in("status", ["in_progress", "completed"]);

  if (error) {
    throw new Error(`Failed to load existing target attempts: ${error.message}`);
  }

  return data ?? [];
}

async function loadActiveRequiredTests(supabase) {
  const { data, error } = await supabase
    .from("tests")
    .select("id, slug, status, is_active")
    .in("slug", REQUIRED_TEST_SLUGS)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to load required standard battery tests: ${error.message}`);
  }

  const testsBySlug = new Map((data ?? []).map((row) => [row.slug, row]));
  const missing = REQUIRED_TEST_SLUGS.filter((slug) => {
    const row = testsBySlug.get(slug);
    return !row || row.status !== "active" || row.is_active !== true;
  });

  if (missing.length > 0) {
    return {
      ok: false,
      reason: "required_tests_not_active",
      missing,
    };
  }

  return {
    ok: true,
    testsBySlug,
  };
}

async function loadRequiredQuestionsWithOptions(supabase, testId) {
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, question_type, is_required, question_order")
    .eq("test_id", testId)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (questionsError) {
    throw new Error(`Failed to load active questions for test ${testId}: ${questionsError.message}`);
  }

  const requiredQuestions = (questions ?? []).filter((question) => question.is_required);

  if (requiredQuestions.length === 0) {
    throw new Error(`Test ${testId} has no active required questions.`);
  }

  const optionQuestionIds = requiredQuestions
    .filter((question) => question.question_type !== "text")
    .map((question) => question.id);

  const answerOptionsByQuestionId = new Map();

  if (optionQuestionIds.length > 0) {
    const { data: answerOptions, error: answerOptionsError } = await supabase
      .from("answer_options")
      .select("id, question_id, option_order")
      .in("question_id", optionQuestionIds)
      .order("question_id", { ascending: true })
      .order("option_order", { ascending: true });

    if (answerOptionsError) {
      throw new Error(`Failed to load answer options for test ${testId}: ${answerOptionsError.message}`);
    }

    for (const option of answerOptions ?? []) {
      const options = answerOptionsByQuestionId.get(option.question_id) ?? [];
      options.push(option);
      answerOptionsByQuestionId.set(option.question_id, options);
    }
  }

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
      text_value: `Team Fit clean fixture response for ${input.question.code}`,
    });

    if (error) {
      throw new Error(`Failed to insert text response for ${input.question.code}: ${error.message}`);
    }

    return;
  }

  const options = input.answerOptionsByQuestionId.get(input.question.id) ?? [];
  const selectedOption = options[input.optionIndex % Math.max(options.length, 1)] ?? options[0];

  if (!selectedOption) {
    throw new Error(`Missing answer option for required question ${input.question.code}.`);
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
    throw new Error(
      `Failed to insert multiple choice response for ${input.question.code}: ${responseError?.message ?? "unknown error"}`,
    );
  }

  const { error: selectionError } = await supabase.from("response_selections").insert({
    response_id: responseRow.id,
    question_id: input.question.id,
    answer_option_id: selectedOption.id,
  });

  if (selectionError) {
    throw new Error(`Failed to insert response selection for ${input.question.code}: ${selectionError.message}`);
  }
}

async function createCompletedAttemptWithResults(supabase, input, deps) {
  const { requiredQuestions, answerOptionsByQuestionId } = await loadRequiredQuestionsWithOptions(
    supabase,
    input.test.id,
  );
  const now = new Date().toISOString();
  const { data: attempt, error: attemptError } = await supabase
    .from("attempts")
    .insert({
      test_id: input.test.id,
      user_id: input.participant.user_id ?? null,
      organization_id: input.organizationId,
      participant_id: input.participant.id,
      locale: "bs",
      addressing_form_snapshot: input.participant.addressing_form ?? "neutral",
      status: "completed",
      started_at: now,
      completed_at: now,
    })
    .select("id, test_id, status, completed_at")
    .single();

  if (attemptError || !attempt?.id) {
    throw new Error(`Failed to create completed attempt for ${input.test.slug}: ${attemptError?.message ?? "unknown error"}`);
  }

  let questionIndex = 0;

  for (const question of requiredQuestions) {
    await insertAnswerForQuestion(supabase, {
      attemptId: attempt.id,
      question,
      answerOptionsByQuestionId,
      optionIndex: input.answerSeedOffset + questionIndex,
    });
    questionIndex += 1;
  }

  const results = await deps.persistCompletedAssessmentResults(input.test.id, attempt.id);

  if (!results) {
    throw new Error(`Deterministic results were not produced for ${input.test.slug}.`);
  }

  return {
    id: attempt.id,
    test_id: input.test.id,
    test_slug: input.test.slug,
    answeredQuestionCount: requiredQuestions.length,
  };
}

async function cleanupCreatedRows(supabase, input) {
  if (input.assignmentId) {
    await supabase
      .from("assessment_assignment_attempts")
      .delete()
      .eq("assessment_assignment_id", input.assignmentId);
  }

  if (input.attemptIds.length > 0) {
    const { data: responses } = await supabase
      .from("responses")
      .select("id")
      .in("attempt_id", input.attemptIds);
    const responseIds = (responses ?? []).map((row) => row.id).filter(isNonEmptyString);

    if (responseIds.length > 0) {
      await supabase.from("response_selections").delete().in("response_id", responseIds);
    }

    await supabase.from("dimension_scores").delete().in("attempt_id", input.attemptIds);
    await supabase.from("responses").delete().in("attempt_id", input.attemptIds);
    await supabase.from("attempts").delete().in("id", input.attemptIds);
  }

  if (input.assignmentId) {
    await supabase.from("assessment_assignments").delete().eq("id", input.assignmentId);
  }
}

async function createCandidateFixture(supabase, input, deps) {
  const testsResult = await loadActiveRequiredTests(supabase);

  if (!testsResult.ok) {
    return {
      ok: false,
      reason: testsResult.reason,
      missing: testsResult.missing,
    };
  }

  const assignment = await deps.createStandardAssessmentAssignment({
    organizationId: input.organizationId,
    participantId: input.participant.id,
    locale: "bs",
    createdByUserId: null,
    metadata: {
      fixture: "team_fit_clean_candidate_source",
      teamAggregationSnapshotId: input.teamAggregationSnapshotId,
      devOnly: true,
    },
  });
  const createdAttemptIds = [];

  try {
    const attempts = [];

    for (const [index, slug] of REQUIRED_TEST_SLUGS.entries()) {
      const attempt = await createCompletedAttemptWithResults(
        supabase,
        {
          organizationId: input.organizationId,
          participant: input.participant,
          test: testsResult.testsBySlug.get(slug),
          answerSeedOffset: index + 1,
        },
        deps,
      );
      attempts.push(attempt);
      createdAttemptIds.push(attempt.id);
    }

    const links = deps.buildAssignmentAttemptLinks({
      assignmentId: assignment.id,
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        test_id: attempt.test_id,
        test_slug: attempt.test_slug,
      })),
    }).map((link) => ({
      ...link,
      required_for_team_fit: true,
      metadata: {
        ...(link.metadata ?? {}),
        fixture: "team_fit_clean_candidate_source",
      },
    }));

    await deps.createAssignmentAttemptLinks(links);

    const completedAt = new Date().toISOString();
    const { error: assignmentUpdateError } = await supabase
      .from("assessment_assignments")
      .update({
        status: "completed",
        completed_at: completedAt,
      })
      .eq("id", assignment.id)
      .eq("status", "active");

    if (assignmentUpdateError) {
      throw new Error(`Failed to mark assessment assignment completed: ${assignmentUpdateError.message}`);
    }

    const compositeSnapshot = await deps.buildCompositeHrInputSnapshot({
      assessmentAssignmentId: assignment.id,
      organizationId: input.organizationId,
      participantId: input.participant.id,
      locale: "bs",
    });

    if (!hasCompleteRequiredCompositeCoverage(compositeSnapshot)) {
      throw new Error("Created assignment did not produce complete Composite HR input coverage.");
    }

    return {
      ok: true,
      assignment,
      createdAttemptIds,
      compositeSnapshot,
    };
  } catch (error) {
    await cleanupCreatedRows(supabase, {
      assignmentId: assignment.id,
      attemptIds: createdAttemptIds,
    });
    throw error;
  }
}

async function runConfirmedWrite(input) {
  installTypeScriptRuntime();

  const { createSupabaseAdminClient } = require(path.join(projectRoot, "lib", "supabase", "admin.ts"));
  const {
    buildCompositeHrInputSnapshot,
  } = require(path.join(projectRoot, "lib", "assessment", "composite-input.ts"));
  const {
    persistCompletedAssessmentResults,
  } = require(path.join(projectRoot, "lib", "assessment", "scoring.ts"));
  const {
    buildAssignmentAttemptLinks,
    createAssignmentAttemptLinks,
    createStandardAssessmentAssignment,
  } = require(path.join(projectRoot, "lib", "assessment", "assignments.ts"));
  const {
    loadTeamDynamicsFinalAggregationVerification,
  } = require(path.join(projectRoot, "lib", "assessment", "team-dynamics-final-aggregation-read.ts"));

  const deps = {
    buildAssignmentAttemptLinks,
    buildCompositeHrInputSnapshot,
    createAssignmentAttemptLinks,
    createStandardAssessmentAssignment,
    loadTeamDynamicsFinalAggregationVerification,
    persistCompletedAssessmentResults,
  };
  const supabase = createSupabaseAdminClient();
  const artifact = buildBaseArtifact({
    ...input,
    dryRun: false,
    writeModeConfirmed: true,
    status: "running",
  });

  const participantResult = await loadTargetParticipant(supabase, input);

  if (!participantResult.ok) {
    artifact.status = "blocked";
    artifact.blockers.push(participantResult.reason);
    artifact.findings.push({
      severity: "blocker",
      category: "target_participant",
      message: participantResult.reason,
    });
    return artifact;
  }

  const teamResult = await loadAndVerifyTeamAggregation(supabase, input, deps);

  if (!teamResult.ok) {
    artifact.status = "blocked";
    artifact.blockers.push(teamResult.reason);
    artifact.findings.push({
      severity: "blocker",
      category: "team_source",
      message: teamResult.reason,
      details: teamResult.snapshot ?? null,
    });
    return artifact;
  }

  const assignments = await loadAssignmentsForTarget(supabase, input);
  const reusable = await findReusableAssignment({
    assignments,
    organizationId: input.organizationId,
    participantId: input.participantId,
    deps,
  });

  if (reusable) {
    artifact.status = "reused_existing_candidate_source";
    artifact.reused = true;
    artifact.assessmentAssignmentId = reusable.assignment.id;
    artifact.nextReadOnlyInspectorCommand = buildInspectorCommand({
      assessmentAssignmentId: reusable.assignment.id,
      teamAggregationSnapshotId: input.teamAggregationSnapshotId,
    });
    artifact.findings.push({
      severity: "info",
      category: "candidate_source",
      message: "Existing assessment assignment already resolves to complete Composite HR input.",
    });
    return artifact;
  }

  if (assignments.length > 0) {
    artifact.status = "blocked_partial_or_incomplete_fixture_exists";
    artifact.blockers.push("partial_or_incomplete_assessment_assignment_exists");
    artifact.findings.push({
      severity: "blocker",
      category: "candidate_source",
      message: "Existing standard_battery assignment rows were found, but none resolves to complete Composite HR input. Operator review is required before creating another assignment.",
      assignmentIds: assignments.map((assignment) => assignment.id),
    });
    return artifact;
  }

  const existingAttempts = await loadExistingRequiredAttempts(supabase, input);

  if (existingAttempts.length > 0) {
    artifact.status = "blocked_existing_unlinked_attempts";
    artifact.blockers.push("existing_unlinked_required_attempts_require_operator_review");
    artifact.findings.push({
      severity: "blocker",
      category: "candidate_source",
      message: "Required test attempts already exist for this participant without a reusable assignment. Operator review is required before writing a fixture.",
      attemptIds: existingAttempts.map((attempt) => attempt.id),
    });
    return artifact;
  }

  const created = await createCandidateFixture(
    supabase,
    {
      organizationId: input.organizationId,
      participant: participantResult.participant,
      teamAggregationSnapshotId: input.teamAggregationSnapshotId,
    },
    deps,
  );

  if (!created.ok) {
    artifact.status = "blocked_no_safe_fixture_write_path";
    artifact.blockers.push(created.reason);
    artifact.findings.push({
      severity: "blocker",
      category: "candidate_source",
      message: created.reason,
      details: created,
    });
    return artifact;
  }

  artifact.status = "prepared_candidate_source";
  artifact.metadata.databaseWrites = true;
  artifact.assessmentAssignmentId = created.assignment.id;
  artifact.createdAttemptIds = [...created.createdAttemptIds];
  artifact.nextReadOnlyInspectorCommand = buildInspectorCommand({
    assessmentAssignmentId: created.assignment.id,
    teamAggregationSnapshotId: input.teamAggregationSnapshotId,
  });
  artifact.findings.push({
    severity: "info",
    category: "candidate_source",
    message: "Prepared completed standard battery assignment with linked IPIP, SAFRAN and MWMS attempts.",
    coverage: created.compositeSnapshot.coverage,
  });

  return artifact;
}

async function prepareTeamFitCleanCandidateFixture({ env = process.env, stdout = process.stdout } = {}) {
  if (env[CONFIRM_ENV] !== "true") {
    const artifact = buildConfirmationRequiredArtifact(env);
    stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  const validation = validateConfirmedTargetInputs(env);

  if (!validation.ok) {
    const artifact = buildInvalidTargetArtifact(validation);
    stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  const artifact = await runConfirmedWrite(validation.inputs);
  stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

module.exports = {
  CONFIRM_ENV,
  EXPECTED_TARGETS,
  REQUIRED_TEST_SLUGS,
  TARGET_ORGANIZATION_ID_ENV,
  TARGET_PARTICIPANT_ID_ENV,
  TARGET_TEAM_AGGREGATION_SNAPSHOT_ID_ENV,
  buildBaseArtifact,
  buildConfirmationRequiredArtifact,
  getTargetInputs,
  prepareTeamFitCleanCandidateFixture,
  validateConfirmedTargetInputs,
};

if (require.main === module) {
  prepareTeamFitCleanCandidateFixture().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
