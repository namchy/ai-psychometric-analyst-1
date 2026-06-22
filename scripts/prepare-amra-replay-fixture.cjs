const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_AMRA_REPLAY_FIXTURE_WRITE";
const SOURCE_PARTICIPANT_ID_ENV = "SOURCE_PARTICIPANT_ID";
const SOURCE_ASSESSMENT_ASSIGNMENT_ID_ENV = "SOURCE_ASSESSMENT_ASSIGNMENT_ID";
const TARGET_ORGANIZATION_ID_ENV = "TARGET_ORGANIZATION_ID";
const TARGET_REPLAY_EMAIL_ENV = "TARGET_REPLAY_EMAIL";
const TARGET_REPLAY_FULL_NAME_ENV = "TARGET_REPLAY_FULL_NAME";

const EXPECTED_INPUTS = {
  sourceParticipantId: "9b742094-53dc-4de5-87a5-174c5491e4dd",
  sourceAssessmentAssignmentId: "16943547-ef84-4fc4-a3d2-11801b1f1869",
  targetOrganizationId: "5d93f3a1-3765-4ec4-b668-c0d1228a8445",
  targetReplayEmail: "amra.new1@example.test",
  targetReplayFullName: "Amra Replay Fixture 1",
};

const REQUIRED_TEST_SLUGS = ["ipip-neo-120-v1", "safran_v1", "mwms_v1"];
const SCRIPT_NAME = "prepare_amra_replay_fixture_v1";
const FIXTURE_MARKER = "amra_replay_fixture_v1";

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

function getOperatorInputs(env = process.env) {
  return {
    sourceParticipantId: normalizeEnvString(env[SOURCE_PARTICIPANT_ID_ENV]),
    sourceAssessmentAssignmentId: normalizeEnvString(env[SOURCE_ASSESSMENT_ASSIGNMENT_ID_ENV]),
    targetOrganizationId: normalizeEnvString(env[TARGET_ORGANIZATION_ID_ENV]),
    targetReplayEmail: normalizeEnvString(env[TARGET_REPLAY_EMAIL_ENV]),
    targetReplayFullName: normalizeEnvString(env[TARGET_REPLAY_FULL_NAME_ENV]),
  };
}

function buildBaseArtifact(input = {}) {
  return {
    metadata: {
      script: SCRIPT_NAME,
      devOnly: true,
      dryRun: input.dryRun ?? true,
      writeModeConfirmed: input.writeModeConfirmed ?? false,
      databaseWrites: false,
      openAiCalled: false,
      reportsGenerated: false,
      reportGenerated: false,
      reportRegenerated: false,
      oldReportsCopied: false,
      oldInputSnapshotsCopied: false,
      oldReportSnapshotsCopied: false,
      originalParticipantTouched: false,
      hrReportProviderCalled: false,
      compositeHrProviderCalled: false,
      teamFitProviderCalled: false,
      teamFitReportsTouched: false,
      workerOrSchedulerRun: false,
      uiOrRendererChanged: false,
      migrationOrSchemaChanged: false,
      supabaseRepairOrDbPushOrReset: false,
      smallAiReviewerIntroduced: false,
      appLevelQualityGradingIntroduced: false,
    },
    inputs: {
      sourceParticipantId: input.sourceParticipantId ?? null,
      sourceAssessmentAssignmentId: input.sourceAssessmentAssignmentId ?? null,
      targetOrganizationId: input.targetOrganizationId ?? null,
      targetReplayEmail: input.targetReplayEmail ?? null,
      targetReplayFullName: input.targetReplayFullName ?? null,
      requiredTestSlugs: [...REQUIRED_TEST_SLUGS],
    },
    status: input.status ?? "not_started",
    targetParticipantId: null,
    targetAssessmentAssignmentId: null,
    targetAttemptIdsByTestSlug: {},
    responsesClonedCountByTestSlug: {},
    scoringPersistedByTestSlug: {},
    reused: false,
    blockers: [],
    findings: [],
    nextReadOnlyAuditSql: null,
  };
}

function buildReadOnlyAuditSql(input) {
  const email = String(input.targetReplayEmail).replace(/'/g, "''");
  return [
    "select",
    "  p.id as participant_id,",
    "  p.organization_id,",
    "  p.email,",
    "  aa.id as assessment_assignment_id,",
    "  aa.status as assignment_status,",
    "  count(distinct aaa.attempt_id) as linked_attempt_count,",
    "  jsonb_object_agg(t.slug, jsonb_build_object(",
    "    'attempt_id', a.id,",
    "    'attempt_status', a.status,",
    "    'completed_at', a.completed_at,",
    "    'response_count', response_counts.response_count,",
    "    'dimension_score_count', score_counts.dimension_score_count",
    "  ) order by t.slug) as attempts_by_slug",
    "from public.participants p",
    "join public.assessment_assignments aa on aa.participant_id = p.id",
    "join public.assessment_assignment_attempts aaa on aaa.assessment_assignment_id = aa.id",
    "join public.attempts a on a.id = aaa.attempt_id",
    "join public.tests t on t.id = a.test_id",
    "left join lateral (",
    "  select count(*)::int as response_count",
    "  from public.responses r",
    "  where r.attempt_id = a.id",
    ") response_counts on true",
    "left join lateral (",
    "  select count(*)::int as dimension_score_count",
    "  from public.dimension_scores ds",
    "  where ds.attempt_id = a.id",
    ") score_counts on true",
    `where p.organization_id = '${input.targetOrganizationId}'`,
    `  and lower(p.email) = lower('${email}')`,
    "  and aa.assignment_type = 'standard_battery'",
    "  and coalesce(aa.metadata->>'fixture', '') = 'amra_replay_fixture_v1'",
    "group by p.id, p.organization_id, p.email, aa.id, aa.status",
    "order by aa.created_at desc;",
  ].join("\n");
}

function validateConfirmedInputs(env = process.env) {
  const inputs = getOperatorInputs(env);
  const missing = [];
  const mismatches = [];

  for (const [key, envName] of [
    ["sourceParticipantId", SOURCE_PARTICIPANT_ID_ENV],
    ["sourceAssessmentAssignmentId", SOURCE_ASSESSMENT_ASSIGNMENT_ID_ENV],
    ["targetOrganizationId", TARGET_ORGANIZATION_ID_ENV],
    ["targetReplayEmail", TARGET_REPLAY_EMAIL_ENV],
    ["targetReplayFullName", TARGET_REPLAY_FULL_NAME_ENV],
  ]) {
    if (!inputs[key]) {
      missing.push(envName);
    } else if (inputs[key] !== EXPECTED_INPUTS[key]) {
      mismatches.push({
        env: envName,
        expected: EXPECTED_INPUTS[key],
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
  const inputs = getOperatorInputs(env);
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
    message: "Default mode is no-write and does not read or mutate DB state.",
  });

  return artifact;
}

function buildInvalidInputArtifact(validation) {
  const artifact = buildBaseArtifact({
    ...validation.inputs,
    dryRun: true,
    writeModeConfirmed: true,
    status: "confirmation_required",
  });

  if (validation.missing.length > 0) {
    artifact.blockers.push("missing_required_env");
    artifact.findings.push({
      severity: "blocker",
      category: "operator_env",
      message: "Confirmed mode requires explicit source and target env vars.",
      missing: validation.missing,
    });
  }

  if (validation.mismatches.length > 0) {
    artifact.blockers.push("operator_env_mismatch");
    artifact.findings.push({
      severity: "blocker",
      category: "operator_env",
      message: "Source/target env vars do not match the approved Amra replay fixture context.",
      mismatches: validation.mismatches,
    });
  }

  return artifact;
}

function isFixtureMetadata(metadata) {
  return metadata && typeof metadata === "object" && metadata.fixture === FIXTURE_MARKER;
}

async function loadSourceParticipant(supabase, input) {
  const { data, error } = await supabase
    .from("participants")
    .select("id, organization_id, user_id, email, full_name, participant_type, status, addressing_form")
    .eq("id", input.sourceParticipantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load source participant: ${error.message}`);
  }

  if (!data) {
    return { ok: false, reason: "source_participant_not_found" };
  }

  if (data.organization_id !== input.targetOrganizationId) {
    return {
      ok: false,
      reason: "source_participant_organization_mismatch",
      participant: data,
    };
  }

  return { ok: true, participant: data };
}

async function loadSourceAssignment(supabase, input) {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, assignment_type, status, locale, completed_at, metadata")
    .eq("id", input.sourceAssessmentAssignmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load source assessment assignment: ${error.message}`);
  }

  if (!data) {
    return { ok: false, reason: "source_assessment_assignment_not_found" };
  }

  if (data.participant_id !== input.sourceParticipantId) {
    return {
      ok: false,
      reason: "source_assignment_participant_mismatch",
      assignment: data,
    };
  }

  if (data.organization_id !== input.targetOrganizationId) {
    return {
      ok: false,
      reason: "source_assignment_organization_mismatch",
      assignment: data,
    };
  }

  if (data.assignment_type !== "standard_battery") {
    return {
      ok: false,
      reason: "source_assignment_not_standard_battery",
      assignment: data,
    };
  }

  return { ok: true, assignment: data };
}

async function loadSourceLinkedAttempts(supabase, input) {
  const { data, error } = await supabase
    .from("assessment_assignment_attempts")
    .select(
      "assessment_assignment_id, attempt_id, test_id, test_slug, attempts(id, test_id, organization_id, participant_id, user_id, locale, addressing_form_snapshot, status, started_at, completed_at)",
    )
    .eq("assessment_assignment_id", input.sourceAssessmentAssignmentId)
    .in("test_slug", REQUIRED_TEST_SLUGS);

  if (error) {
    throw new Error(`Failed to load source assignment attempts: ${error.message}`);
  }

  const attemptsBySlug = new Map();
  const missing = [];
  const invalid = [];

  for (const row of data ?? []) {
    const attempt = row.attempts;
    if (!attempt) {
      invalid.push({ testSlug: row.test_slug, reason: "linked_attempt_missing" });
      continue;
    }

    if (attempt.organization_id !== input.targetOrganizationId) {
      invalid.push({ testSlug: row.test_slug, attemptId: attempt.id, reason: "attempt_organization_mismatch" });
      continue;
    }

    if (attempt.participant_id !== input.sourceParticipantId) {
      invalid.push({ testSlug: row.test_slug, attemptId: attempt.id, reason: "attempt_participant_mismatch" });
      continue;
    }

    if (attempt.status !== "completed" || !attempt.completed_at) {
      invalid.push({ testSlug: row.test_slug, attemptId: attempt.id, reason: "attempt_not_completed" });
      continue;
    }

    attemptsBySlug.set(row.test_slug, {
      id: attempt.id,
      test_id: row.test_id,
      test_slug: row.test_slug,
      locale: attempt.locale ?? "bs",
      addressing_form_snapshot: attempt.addressing_form_snapshot ?? null,
      started_at: attempt.started_at,
      completed_at: attempt.completed_at,
    });
  }

  for (const slug of REQUIRED_TEST_SLUGS) {
    if (!attemptsBySlug.has(slug)) {
      missing.push(slug);
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    return {
      ok: false,
      reason: "source_required_attempts_not_ready",
      missing,
      invalid,
    };
  }

  return { ok: true, attemptsBySlug };
}

async function loadRawResponsesForAttempt(supabase, attemptId) {
  const { data: responses, error: responsesError } = await supabase
    .from("responses")
    .select("id, question_id, response_kind, answer_option_id, text_value")
    .eq("attempt_id", attemptId)
    .order("question_id", { ascending: true });

  if (responsesError) {
    throw new Error(`Failed to load raw responses for source attempt ${attemptId}: ${responsesError.message}`);
  }

  const rows = responses ?? [];
  if (rows.length === 0) {
    return {
      ok: false,
      reason: "source_attempt_has_no_raw_responses",
      responses: [],
      selectionsByResponseId: new Map(),
    };
  }

  const responseIds = rows.map((row) => row.id);
  const { data: selections, error: selectionsError } = await supabase
    .from("response_selections")
    .select("response_id, question_id, answer_option_id, selection_role")
    .in("response_id", responseIds);

  if (selectionsError) {
    throw new Error(`Failed to load response selections for source attempt ${attemptId}: ${selectionsError.message}`);
  }

  const selectionsByResponseId = new Map();
  for (const selection of selections ?? []) {
    const grouped = selectionsByResponseId.get(selection.response_id) ?? [];
    grouped.push(selection);
    selectionsByResponseId.set(selection.response_id, grouped);
  }

  for (const response of rows) {
    if (!["single_choice", "multiple_choice", "text", "best_worst"].includes(response.response_kind)) {
      return {
        ok: false,
        reason: "unsupported_response_kind",
        response,
        responses: rows,
        selectionsByResponseId,
      };
    }

    if (
      (response.response_kind === "multiple_choice" || response.response_kind === "best_worst") &&
      (selectionsByResponseId.get(response.id) ?? []).length === 0
    ) {
      return {
        ok: false,
        reason: "selection_response_missing_selections",
        response,
        responses: rows,
        selectionsByResponseId,
      };
    }
  }

  return {
    ok: true,
    responses: rows,
    selectionsByResponseId,
  };
}

async function loadAllSourceResponses(supabase, attemptsBySlug) {
  const sourceResponsesBySlug = new Map();
  const missing = [];

  for (const [slug, attempt] of attemptsBySlug.entries()) {
    const result = await loadRawResponsesForAttempt(supabase, attempt.id);

    if (!result.ok) {
      missing.push({
        testSlug: slug,
        attemptId: attempt.id,
        reason: result.reason,
      });
      continue;
    }

    sourceResponsesBySlug.set(slug, result);
  }

  if (missing.length > 0) {
    return {
      ok: false,
      reason: "source_raw_responses_not_ready",
      missing,
    };
  }

  return {
    ok: true,
    sourceResponsesBySlug,
  };
}

async function findOrCreateTargetParticipant(supabase, input, sourceParticipant) {
  const { data: existing, error: existingError } = await supabase
    .from("participants")
    .select("id, organization_id, user_id, email, full_name, participant_type, status, addressing_form")
    .eq("organization_id", input.targetOrganizationId)
    .ilike("email", input.targetReplayEmail)
    .order("created_at", { ascending: true })
    .limit(1);

  if (existingError) {
    throw new Error(`Failed to load target replay participant: ${existingError.message}`);
  }

  if ((existing ?? []).length > 0) {
    const participant = existing[0];
    if (participant.organization_id !== input.targetOrganizationId) {
      return {
        ok: false,
        reason: "target_replay_participant_organization_mismatch",
        participant,
      };
    }

    return {
      ok: true,
      participant,
      created: false,
    };
  }

  const { data: created, error: createError } = await supabase
    .from("participants")
    .insert({
      organization_id: input.targetOrganizationId,
      user_id: null,
      email: input.targetReplayEmail,
      full_name: input.targetReplayFullName,
      participant_type: "candidate",
      status: "active",
      addressing_form: sourceParticipant.addressing_form ?? null,
    })
    .select("id, organization_id, user_id, email, full_name, participant_type, status, addressing_form")
    .single();

  if (createError || !created) {
    throw new Error(`Failed to create target replay participant: ${createError?.message ?? "unknown error"}`);
  }

  return {
    ok: true,
    participant: created,
    created: true,
  };
}

async function loadTargetAssignments(supabase, input) {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, assignment_type, status, locale, completed_at, created_at, metadata")
    .eq("organization_id", input.targetOrganizationId)
    .eq("participant_id", input.targetParticipantId)
    .eq("assignment_type", "standard_battery")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load target replay assignments: ${error.message}`);
  }

  return data ?? [];
}

async function loadAssignmentAttemptsBySlug(supabase, assignmentId) {
  const { data, error } = await supabase
    .from("assessment_assignment_attempts")
    .select(
      "attempt_id, test_id, test_slug, attempts(id, test_id, organization_id, participant_id, status, completed_at, metadata)",
    )
    .eq("assessment_assignment_id", assignmentId)
    .in("test_slug", REQUIRED_TEST_SLUGS);

  if (error) {
    throw new Error(`Failed to load replay assignment attempts: ${error.message}`);
  }

  const attemptsBySlug = new Map();
  for (const row of data ?? []) {
    if (row.attempts) {
      attemptsBySlug.set(row.test_slug, {
        id: row.attempts.id,
        test_id: row.test_id,
        test_slug: row.test_slug,
        status: row.attempts.status,
        completed_at: row.attempts.completed_at,
        metadata: row.attempts.metadata ?? {},
      });
    }
  }

  return attemptsBySlug;
}

async function findReusableReplayAssignment(supabase, input, assignments) {
  for (const assignment of assignments) {
    if (!isFixtureMetadata(assignment.metadata)) {
      continue;
    }

    if (
      assignment.metadata.sourceParticipantId !== input.sourceParticipantId ||
      assignment.metadata.sourceAssessmentAssignmentId !== input.sourceAssessmentAssignmentId
    ) {
      continue;
    }

    const attemptsBySlug = await loadAssignmentAttemptsBySlug(supabase, assignment.id);
    const missing = REQUIRED_TEST_SLUGS.filter((slug) => !attemptsBySlug.has(slug));
    const incomplete = [...attemptsBySlug.values()].filter(
      (attempt) => attempt.status !== "completed" || !attempt.completed_at,
    );

    if (missing.length > 0 || incomplete.length > 0) {
      return {
        ok: false,
        reason: "partial_replay_fixture_assignment_exists",
        assignment,
        missing,
        incomplete,
      };
    }

    return {
      ok: true,
      assignment,
      attemptsBySlug,
    };
  }

  return null;
}

async function loadExistingTargetAttempts(supabase, input) {
  const { data: tests, error: testsError } = await supabase
    .from("tests")
    .select("id, slug")
    .in("slug", REQUIRED_TEST_SLUGS);

  if (testsError) {
    throw new Error(`Failed to load required tests: ${testsError.message}`);
  }

  const testIds = (tests ?? []).map((test) => test.id);
  if (testIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("attempts")
    .select("id, test_id, status, completed_at, metadata, tests(slug)")
    .eq("organization_id", input.targetOrganizationId)
    .eq("participant_id", input.targetParticipantId)
    .in("test_id", testIds)
    .in("status", ["in_progress", "completed"]);

  if (error) {
    throw new Error(`Failed to load existing target replay attempts: ${error.message}`);
  }

  return data ?? [];
}

async function createReplayAssignment(supabase, input, deps) {
  return deps.createStandardAssessmentAssignment({
    organizationId: input.targetOrganizationId,
    participantId: input.targetParticipant.id,
    locale: "bs",
    createdByUserId: null,
    metadata: {
      fixture: FIXTURE_MARKER,
      devOnly: true,
      sourceParticipantId: input.sourceParticipantId,
      sourceAssessmentAssignmentId: input.sourceAssessmentAssignmentId,
      sourceAttemptIdsByTestSlug: Object.fromEntries(
        [...input.sourceAttemptsBySlug.entries()].map(([slug, attempt]) => [slug, attempt.id]),
      ),
    },
  });
}

async function cloneRawResponsesToAttempt(supabase, input) {
  let clonedResponses = 0;
  let clonedSelections = 0;

  for (const response of input.sourceResponses.responses) {
    const { data: insertedResponse, error: responseError } = await supabase
      .from("responses")
      .insert({
        attempt_id: input.targetAttemptId,
        question_id: response.question_id,
        response_kind: response.response_kind,
        answer_option_id: response.response_kind === "single_choice" ? response.answer_option_id : null,
        text_value: response.response_kind === "text" ? response.text_value : null,
      })
      .select("id")
      .single();

    if (responseError || !insertedResponse?.id) {
      throw new Error(`Failed to clone raw response ${response.id}: ${responseError?.message ?? "unknown error"}`);
    }

    clonedResponses += 1;

    const selections = input.sourceResponses.selectionsByResponseId.get(response.id) ?? [];
    if (selections.length === 0) {
      continue;
    }

    const { error: selectionError } = await supabase.from("response_selections").insert(
      selections.map((selection) => ({
        response_id: insertedResponse.id,
        question_id: selection.question_id,
        answer_option_id: selection.answer_option_id,
        selection_role: selection.selection_role ?? null,
      })),
    );

    if (selectionError) {
      throw new Error(`Failed to clone response selections for response ${response.id}: ${selectionError.message}`);
    }

    clonedSelections += selections.length;
  }

  return { clonedResponses, clonedSelections };
}

async function createTargetAttemptFromSource(supabase, input, deps) {
  const now = new Date().toISOString();
  const { data: attempt, error: attemptError } = await supabase
    .from("attempts")
    .insert({
      test_id: input.sourceAttempt.test_id,
      user_id: input.targetParticipant.user_id ?? null,
      organization_id: input.targetOrganizationId,
      participant_id: input.targetParticipant.id,
      locale: input.sourceAttempt.locale ?? "bs",
      addressing_form_snapshot:
        input.sourceAttempt.addressing_form_snapshot ??
        input.targetParticipant.addressing_form ??
        null,
      status: "completed",
      started_at: now,
      completed_at: now,
      metadata: {
        fixture: FIXTURE_MARKER,
        devOnly: true,
        sourceParticipantId: input.sourceParticipantId,
        sourceAssessmentAssignmentId: input.sourceAssessmentAssignmentId,
        sourceAttemptId: input.sourceAttempt.id,
        testSlug: input.sourceAttempt.test_slug,
      },
    })
    .select("id, test_id, participant_id, organization_id, status, completed_at")
    .single();

  if (attemptError || !attempt?.id) {
    throw new Error(`Failed to create target replay attempt for ${input.sourceAttempt.test_slug}: ${attemptError?.message ?? "unknown error"}`);
  }

  const cloneResult = await cloneRawResponsesToAttempt(supabase, {
    targetAttemptId: attempt.id,
    sourceResponses: input.sourceResponses,
  });

  const results = await deps.persistCompletedAssessmentResults(input.sourceAttempt.test_id, attempt.id);

  if (!results) {
    throw new Error(`Deterministic scoring did not produce results for ${input.sourceAttempt.test_slug}.`);
  }

  return {
    id: attempt.id,
    test_id: input.sourceAttempt.test_id,
    test_slug: input.sourceAttempt.test_slug,
    clonedResponses: cloneResult.clonedResponses,
    clonedSelections: cloneResult.clonedSelections,
    scoringPersisted: true,
    scoredResponseCount: results.scoredResponseCount,
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

  if (input.createdParticipantId) {
    await supabase.from("participants").delete().eq("id", input.createdParticipantId);
  }
}

async function createReplayFixture(supabase, input, deps) {
  const assignment = await createReplayAssignment(supabase, input, deps);
  const createdAttemptIds = [];

  try {
    const createdAttempts = [];

    for (const slug of REQUIRED_TEST_SLUGS) {
      const attempt = await createTargetAttemptFromSource(
        supabase,
        {
          sourceParticipantId: input.sourceParticipantId,
          sourceAssessmentAssignmentId: input.sourceAssessmentAssignmentId,
          targetOrganizationId: input.targetOrganizationId,
          targetParticipant: input.targetParticipant,
          sourceAttempt: input.sourceAttemptsBySlug.get(slug),
          sourceResponses: input.sourceResponsesBySlug.get(slug),
        },
        deps,
      );

      createdAttempts.push(attempt);
      createdAttemptIds.push(attempt.id);
    }

    const links = deps.buildAssignmentAttemptLinks({
      assignmentId: assignment.id,
      attempts: createdAttempts.map((attempt) => ({
        id: attempt.id,
        test_id: attempt.test_id,
        test_slug: attempt.test_slug,
      })),
    }).map((link) => ({
      ...link,
      metadata: {
        ...(link.metadata ?? {}),
        fixture: FIXTURE_MARKER,
        sourceParticipantId: input.sourceParticipantId,
        sourceAssessmentAssignmentId: input.sourceAssessmentAssignmentId,
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
      throw new Error(`Failed to mark replay assignment completed: ${assignmentUpdateError.message}`);
    }

    return {
      ok: true,
      assignment,
      attempts: createdAttempts,
    };
  } catch (error) {
    await cleanupCreatedRows(supabase, {
      assignmentId: assignment.id,
      attemptIds: createdAttemptIds,
      createdParticipantId: input.createdParticipant ? input.targetParticipant.id : null,
    });
    throw error;
  }
}

async function runConfirmedWrite(input) {
  installTypeScriptRuntime();

  const { createSupabaseAdminClient } = require(path.join(projectRoot, "lib", "supabase", "admin.ts"));
  const {
    persistCompletedAssessmentResults,
  } = require(path.join(projectRoot, "lib", "assessment", "scoring.ts"));
  const {
    buildAssignmentAttemptLinks,
    createAssignmentAttemptLinks,
    createStandardAssessmentAssignment,
  } = require(path.join(projectRoot, "lib", "assessment", "assignments.ts"));

  const deps = {
    buildAssignmentAttemptLinks,
    createAssignmentAttemptLinks,
    createStandardAssessmentAssignment,
    persistCompletedAssessmentResults,
  };
  const supabase = createSupabaseAdminClient();
  const artifact = buildBaseArtifact({
    ...input,
    dryRun: false,
    writeModeConfirmed: true,
    status: "running",
  });

  const sourceParticipantResult = await loadSourceParticipant(supabase, input);
  if (!sourceParticipantResult.ok) {
    artifact.status = "blocked";
    artifact.blockers.push(sourceParticipantResult.reason);
    artifact.findings.push({
      severity: "blocker",
      category: "source_participant",
      message: sourceParticipantResult.reason,
      details: sourceParticipantResult.participant ?? null,
    });
    return artifact;
  }

  const sourceAssignmentResult = await loadSourceAssignment(supabase, input);
  if (!sourceAssignmentResult.ok) {
    artifact.status = "blocked";
    artifact.blockers.push(sourceAssignmentResult.reason);
    artifact.findings.push({
      severity: "blocker",
      category: "source_assignment",
      message: sourceAssignmentResult.reason,
      details: sourceAssignmentResult.assignment ?? null,
    });
    return artifact;
  }

  const sourceAttemptsResult = await loadSourceLinkedAttempts(supabase, input);
  if (!sourceAttemptsResult.ok) {
    artifact.status = "blocked";
    artifact.blockers.push(sourceAttemptsResult.reason);
    artifact.findings.push({
      severity: "blocker",
      category: "source_attempts",
      message: sourceAttemptsResult.reason,
      missing: sourceAttemptsResult.missing,
      invalid: sourceAttemptsResult.invalid,
    });
    return artifact;
  }

  const sourceResponsesResult = await loadAllSourceResponses(supabase, sourceAttemptsResult.attemptsBySlug);
  if (!sourceResponsesResult.ok) {
    artifact.status = "blocked_no_safe_raw_response_clone_path";
    artifact.blockers.push(sourceResponsesResult.reason);
    artifact.findings.push({
      severity: "blocker",
      category: "source_responses",
      message: "Raw source responses are not safe to clone through stable question/option/selection identifiers.",
      details: sourceResponsesResult.missing,
    });
    return artifact;
  }

  const targetParticipantResult = await findOrCreateTargetParticipant(
    supabase,
    input,
    sourceParticipantResult.participant,
  );

  if (!targetParticipantResult.ok) {
    artifact.status = "blocked";
    artifact.blockers.push(targetParticipantResult.reason);
    artifact.findings.push({
      severity: "blocker",
      category: "target_participant",
      message: targetParticipantResult.reason,
      details: targetParticipantResult.participant ?? null,
    });
    return artifact;
  }

  artifact.targetParticipantId = targetParticipantResult.participant.id;

  const targetAssignments = await loadTargetAssignments(supabase, {
    targetOrganizationId: input.targetOrganizationId,
    targetParticipantId: targetParticipantResult.participant.id,
  });
  const reusable = await findReusableReplayAssignment(
    supabase,
    {
      ...input,
      targetParticipantId: targetParticipantResult.participant.id,
    },
    targetAssignments,
  );

  if (reusable?.ok) {
    artifact.status = "reused_existing_replay_fixture";
    artifact.reused = true;
    artifact.targetAssessmentAssignmentId = reusable.assignment.id;
    artifact.targetAttemptIdsByTestSlug = Object.fromEntries(
      [...reusable.attemptsBySlug.entries()].map(([slug, attempt]) => [slug, attempt.id]),
    );
    artifact.nextReadOnlyAuditSql = buildReadOnlyAuditSql(input);
    artifact.findings.push({
      severity: "info",
      category: "target_assignment",
      message: "Existing marked Amra replay fixture assignment is complete and reusable.",
    });
    return artifact;
  }

  if (reusable && !reusable.ok) {
    artifact.status = "blocked_partial_replay_fixture_exists";
    artifact.blockers.push(reusable.reason);
    artifact.findings.push({
      severity: "blocker",
      category: "target_assignment",
      message: reusable.reason,
      assignmentId: reusable.assignment?.id ?? null,
      missing: reusable.missing ?? [],
      incomplete: reusable.incomplete ?? [],
    });
    return artifact;
  }

  const nonFixtureAssignments = targetAssignments.filter((assignment) => !isFixtureMetadata(assignment.metadata));
  if (nonFixtureAssignments.length > 0) {
    artifact.status = "blocked_existing_non_fixture_assignment_requires_operator_review";
    artifact.blockers.push("existing_non_fixture_standard_battery_assignment");
    artifact.findings.push({
      severity: "blocker",
      category: "target_assignment",
      message: "Target replay participant already has non-fixture standard_battery assignments. Operator review is required before creating another assignment.",
      assignmentIds: nonFixtureAssignments.map((assignment) => assignment.id),
    });
    return artifact;
  }

  const existingAttempts = await loadExistingTargetAttempts(supabase, {
    targetOrganizationId: input.targetOrganizationId,
    targetParticipantId: targetParticipantResult.participant.id,
  });
  const nonFixtureAttempts = existingAttempts.filter((attempt) => !isFixtureMetadata(attempt.metadata));

  if (nonFixtureAttempts.length > 0) {
    artifact.status = "blocked_existing_non_fixture_attempts_require_operator_review";
    artifact.blockers.push("existing_non_fixture_required_attempts");
    artifact.findings.push({
      severity: "blocker",
      category: "target_attempts",
      message: "Target replay participant already has non-fixture attempts for required tests. Operator review is required before writing replay data.",
      attemptIds: nonFixtureAttempts.map((attempt) => attempt.id),
    });
    return artifact;
  }

  const created = await createReplayFixture(
    supabase,
    {
      ...input,
      targetParticipant: targetParticipantResult.participant,
      createdParticipant: targetParticipantResult.created,
      sourceAttemptsBySlug: sourceAttemptsResult.attemptsBySlug,
      sourceResponsesBySlug: sourceResponsesResult.sourceResponsesBySlug,
    },
    deps,
  );

  if (!created.ok) {
    artifact.status = "blocked_no_safe_raw_response_clone_path";
    artifact.blockers.push(created.reason);
    artifact.findings.push({
      severity: "blocker",
      category: "fixture_write",
      message: created.reason,
      details: created,
    });
    return artifact;
  }

  artifact.status = "prepared_replay_fixture";
  artifact.metadata.databaseWrites = true;
  artifact.targetAssessmentAssignmentId = created.assignment.id;
  artifact.targetAttemptIdsByTestSlug = Object.fromEntries(
    created.attempts.map((attempt) => [attempt.test_slug, attempt.id]),
  );
  artifact.responsesClonedCountByTestSlug = Object.fromEntries(
    created.attempts.map((attempt) => [attempt.test_slug, attempt.clonedResponses]),
  );
  artifact.scoringPersistedByTestSlug = Object.fromEntries(
    created.attempts.map((attempt) => [attempt.test_slug, attempt.scoringPersisted]),
  );
  artifact.nextReadOnlyAuditSql = buildReadOnlyAuditSql(input);
  artifact.findings.push({
    severity: "info",
    category: "fixture_write",
    message: "Created Amra replay participant source fixture from cloned raw responses and recomputed deterministic scoring.",
  });

  return artifact;
}

async function prepareAmraReplayFixture({ env = process.env, stdout = process.stdout } = {}) {
  if (env[CONFIRM_ENV] !== "true") {
    const artifact = buildConfirmationRequiredArtifact(env);
    stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  const validation = validateConfirmedInputs(env);

  if (!validation.ok) {
    const artifact = buildInvalidInputArtifact(validation);
    stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  const artifact = await runConfirmedWrite(validation.inputs);
  stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

module.exports = {
  CONFIRM_ENV,
  EXPECTED_INPUTS,
  FIXTURE_MARKER,
  REQUIRED_TEST_SLUGS,
  SOURCE_ASSESSMENT_ASSIGNMENT_ID_ENV,
  SOURCE_PARTICIPANT_ID_ENV,
  TARGET_ORGANIZATION_ID_ENV,
  TARGET_REPLAY_EMAIL_ENV,
  TARGET_REPLAY_FULL_NAME_ENV,
  buildBaseArtifact,
  buildConfirmationRequiredArtifact,
  buildReadOnlyAuditSql,
  getOperatorInputs,
  prepareAmraReplayFixture,
  validateConfirmedInputs,
};

if (require.main === module) {
  prepareAmraReplayFixture().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
