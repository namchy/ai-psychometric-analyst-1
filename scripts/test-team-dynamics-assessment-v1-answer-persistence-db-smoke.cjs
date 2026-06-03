const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { pathToFileURL } = require("node:url");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const migrationPath = path.join(
  projectRoot,
  "supabase",
  "migrations",
  "20260527094919_add_best_worst_response_storage.sql",
);
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

function getManualMigrationInstruction() {
  const sql = fs.readFileSync(migrationPath, "utf8").trim();
  return [
    "Runtime DB is missing the best_worst storage migration.",
    "",
    "Apply this SQL in Supabase SQL Editor against the runtime project before rerunning the DB smoke:",
    "",
    sql,
  ].join("\n");
}

function extractTestsRelation(attemptRow) {
  return Array.isArray(attemptRow.tests) ? attemptRow.tests[0] ?? null : attemptRow.tests ?? null;
}

async function expectRuntimeSchemaSupport(supabase) {
  const selectionRoleProbe = await supabase
    .from("response_selections")
    .select("selection_role")
    .limit(1);

  if (selectionRoleProbe.error) {
    throw new Error(
      [
        `Runtime schema check failed: ${selectionRoleProbe.error.message}`,
        getManualMigrationInstruction(),
      ].join("\n\n"),
    );
  }
}

async function clearSmokeResponses(supabase, attemptId, questionIds) {
  const { data: rows, error: selectError } = await supabase
    .from("responses")
    .select("id, question_id")
    .eq("attempt_id", attemptId)
    .in("question_id", questionIds);

  if (selectError) {
    throw new Error(`Failed to inspect existing smoke responses: ${selectError.message}`);
  }

  const responseIds = [...new Set((rows ?? []).map((row) => row.id))];

  if (responseIds.length > 0) {
    const { error: deleteSelectionsError } = await supabase
      .from("response_selections")
      .delete()
      .in("response_id", responseIds);

    if (deleteSelectionsError) {
      throw new Error(
        `Failed to cleanup existing smoke response selections: ${deleteSelectionsError.message}`,
      );
    }
  }

  const { error: deleteResponsesError } = await supabase
    .from("responses")
    .delete()
    .eq("attempt_id", attemptId)
    .in("question_id", questionIds);

  if (deleteResponsesError) {
    throw new Error(`Failed to cleanup existing smoke responses: ${deleteResponsesError.message}`);
  }
}

async function loadResponseRows(supabase, attemptId, questionId) {
  const { data, error } = await supabase
    .from("responses")
    .select("id, attempt_id, question_id, response_kind, answer_option_id, text_value")
    .eq("attempt_id", attemptId)
    .eq("question_id", questionId);

  if (error) {
    throw new Error(`Failed to load persisted response rows: ${error.message}`);
  }

  return data ?? [];
}

async function loadResponseSelections(supabase, responseId) {
  const { data, error } = await supabase
    .from("response_selections")
    .select("response_id, question_id, answer_option_id, selection_role")
    .eq("response_id", responseId);

  if (error) {
    throw new Error(`Failed to load persisted response selections: ${error.message}`);
  }

  return data ?? [];
}

async function loadOptionalCount(supabase, table, filters = []) {
  const query = supabase.from(table).select("*", { count: "exact", head: true });

  let chained = query;
  for (const [column, value] of filters) {
    chained = chained.eq(column, value);
  }

  const { count, error } = await chained;

  if (!error) {
    return count ?? 0;
  }

  if (["42P01", "PGRST205"].includes(error.code ?? "")) {
    return null;
  }

  throw new Error(`Failed to inspect optional table ${table}: ${error.message}`);
}

async function main() {
  const {
    createAdminSupabaseClient,
    loadLocalEnvFile,
  } = await import(
    pathToFileURL(path.join(projectRoot, "scripts", "import-assessment-package.mjs")).href
  );

  await loadLocalEnvFile();

  const {
    ensureTeamDynamicsAssessmentV1SmokeFixture,
    TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
  } = require("./create-team-dynamics-assessment-v1-smoke-fixture.cjs");
  const {
    loadTeamAssessmentExecutionContext,
    loadTeamAssessmentRunHandoff,
    resolveTeamAssessmentExecutionShellState,
  } = require("../lib/assessment/team-assessment-execution.ts");
  const {
    validateTeamDynamicsMixedAnswerPayload,
  } = require("../lib/assessment/team-dynamics-mixed-answer-payload-validator.ts");
  const {
    persistValidatedTeamDynamicsMixedAnswer,
  } = require("../lib/assessment/team-dynamics-mixed-answer-persistence.ts");

  const supabase = createAdminSupabaseClient();
  await expectRuntimeSchemaSupport(supabase);

  const fixture = await ensureTeamDynamicsAssessmentV1SmokeFixture();
  const smokeParticipant = fixture.participants[0];
  const contextResult = await loadTeamAssessmentExecutionContext({
    teamAssessmentParticipantId: smokeParticipant.teamAssessmentParticipantId,
    userId: smokeParticipant.userId,
  });

  assert.equal(contextResult.ok, true, "Expected smoke wrapper execution context to load.");
  assert.equal(contextResult.context.packageSlug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  assert.equal(contextResult.context.test.slug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  assert.equal(contextResult.context.test.isActive, true);
  assert.equal(contextResult.context.attemptStatus, "in_progress");
  assert.equal(contextResult.context.wrapperStatus, "invited");

  const shellState = resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: contextResult.context.wrapperStatus,
  });
  const handoff = await loadTeamAssessmentRunHandoff({
    context: contextResult.context,
    shellState,
  });

  assert.equal(handoff.mixedRuntimeHandoff?.testSlug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  const runtimeHandoff = handoff.mixedRuntimeHandoff;

  if (!runtimeHandoff) {
    throw new Error("Mixed runtime handoff was not available for DB-backed smoke.");
  }

  const likertItem = runtimeHandoff.items.find(
    (item) => item.responseFormat === "single_select_likert" && item.options.length >= 2,
  );
  const sjtItem = runtimeHandoff.items.find(
    (item) => item.responseFormat === "best_worst" && item.options.length >= 3,
  );

  if (!likertItem || !sjtItem) {
    throw new Error("Unable to locate required Likert and SJT items in mixed runtime handoff.");
  }

  const likertOptionA = likertItem.options[0]?.optionId;
  const likertOptionB = likertItem.options[1]?.optionId;
  const sjtBestA = sjtItem.options[0]?.optionId;
  const sjtWorstA = sjtItem.options[1]?.optionId;
  const sjtBestB = sjtItem.options[2]?.optionId;
  const invalidOptionId = likertItem.options[0]?.optionId;

  assert.ok(likertOptionA && likertOptionB && sjtBestA && sjtWorstA && sjtBestB && invalidOptionId);

  await clearSmokeResponses(supabase, contextResult.context.attemptId, [
    likertItem.questionId,
    sjtItem.questionId,
  ]);

  const beforeAttemptStatus = contextResult.context.attemptStatus;
  const beforeWrapperStatus = contextResult.context.wrapperStatus;
  const beforeScoreCount = await loadOptionalCount(
    supabase,
    "team_assessment_participant_scores",
    [["team_assessment_participant_id", smokeParticipant.teamAssessmentParticipantId]],
  );
  const beforeAggregationCount = await loadOptionalCount(
    supabase,
    "team_assessment_aggregation_snapshots",
    [["team_assessment_assignment_id", contextResult.context.teamAssessmentAssignmentId]],
  );
  const beforeAttemptReportsCount = await loadOptionalCount(
    supabase,
    "attempt_reports",
    [["attempt_id", contextResult.context.attemptId]],
  );
  const beforeAssessmentReportsCount = await loadOptionalCount(
    supabase,
    "assessment_reports",
    [["assessment_assignment_id", contextResult.context.teamAssessmentAssignmentId]],
  );

  const likertPayloadA = {
    teamAssessmentParticipantId: smokeParticipant.teamAssessmentParticipantId,
    questionId: likertItem.questionId,
    responseFormat: "single_select_likert",
    optionId: likertOptionA,
    locale: contextResult.context.locale,
  };
  const likertPayloadB = {
    ...likertPayloadA,
    optionId: likertOptionB,
  };

  const likertSaved = await persistValidatedTeamDynamicsMixedAnswer({
    userId: smokeParticipant.userId,
    payload: likertPayloadA,
  });
  assert.equal(likertSaved.ok, true);
  assert.equal(likertSaved.status, "saved");

  const likertRowsAfterSave = await loadResponseRows(
    supabase,
    contextResult.context.attemptId,
    likertItem.questionId,
  );
  assert.equal(likertRowsAfterSave.length, 1);
  assert.equal(likertRowsAfterSave[0].response_kind, "single_choice");
  assert.equal(likertRowsAfterSave[0].answer_option_id, likertOptionA);

  const likertUnchanged = await persistValidatedTeamDynamicsMixedAnswer({
    userId: smokeParticipant.userId,
    payload: likertPayloadA,
  });
  assert.equal(likertUnchanged.ok, true);
  assert.equal(likertUnchanged.status, "unchanged");
  const likertRowsAfterUnchanged = await loadResponseRows(
    supabase,
    contextResult.context.attemptId,
    likertItem.questionId,
  );
  assert.equal(likertRowsAfterUnchanged.length, 1);

  const likertOverwritten = await persistValidatedTeamDynamicsMixedAnswer({
    userId: smokeParticipant.userId,
    payload: likertPayloadB,
  });
  assert.equal(likertOverwritten.ok, true);
  assert.equal(likertOverwritten.status, "overwritten");
  const likertRowsAfterOverwrite = await loadResponseRows(
    supabase,
    contextResult.context.attemptId,
    likertItem.questionId,
  );
  assert.equal(likertRowsAfterOverwrite.length, 1);
  assert.equal(likertRowsAfterOverwrite[0].answer_option_id, likertOptionB);

  const sjtPayloadA = {
    teamAssessmentParticipantId: smokeParticipant.teamAssessmentParticipantId,
    questionId: sjtItem.questionId,
    responseFormat: "best_worst",
    bestOptionId: sjtBestA,
    worstOptionId: sjtWorstA,
    locale: contextResult.context.locale,
  };
  const sjtPayloadB = {
    ...sjtPayloadA,
    bestOptionId: sjtBestB,
  };

  const sjtSaved = await persistValidatedTeamDynamicsMixedAnswer({
    userId: smokeParticipant.userId,
    payload: sjtPayloadA,
  });
  assert.equal(sjtSaved.ok, true);
  assert.equal(sjtSaved.status, "saved");

  const sjtRowsAfterSave = await loadResponseRows(
    supabase,
    contextResult.context.attemptId,
    sjtItem.questionId,
  );
  assert.equal(sjtRowsAfterSave.length, 1);
  assert.equal(sjtRowsAfterSave[0].response_kind, "best_worst");
  assert.equal(sjtRowsAfterSave[0].answer_option_id, null);
  assert.equal(sjtRowsAfterSave[0].text_value, null);

  const sjtSelectionsAfterSave = await loadResponseSelections(
    supabase,
    sjtRowsAfterSave[0].id,
  );
  assert.equal(sjtSelectionsAfterSave.length, 2);
  const bestSelectionAfterSave = sjtSelectionsAfterSave.find(
    (selection) => selection.selection_role === "best",
  );
  const worstSelectionAfterSave = sjtSelectionsAfterSave.find(
    (selection) => selection.selection_role === "worst",
  );
  assert.equal(bestSelectionAfterSave?.answer_option_id, sjtBestA);
  assert.equal(worstSelectionAfterSave?.answer_option_id, sjtWorstA);

  const duplicateRoleInsert = await supabase
    .from("response_selections")
    .insert({
      response_id: sjtRowsAfterSave[0].id,
      question_id: sjtItem.questionId,
      answer_option_id: sjtBestB,
      selection_role: "best",
    });
  assert.ok(
    duplicateRoleInsert.error,
    "Expected runtime DB to reject duplicate best role for the same response.",
  );

  const sjtUnchanged = await persistValidatedTeamDynamicsMixedAnswer({
    userId: smokeParticipant.userId,
    payload: sjtPayloadA,
  });
  assert.equal(sjtUnchanged.ok, true);
  assert.equal(sjtUnchanged.status, "unchanged");
  const sjtRowsAfterUnchanged = await loadResponseRows(
    supabase,
    contextResult.context.attemptId,
    sjtItem.questionId,
  );
  assert.equal(sjtRowsAfterUnchanged.length, 1);
  const sjtSelectionsAfterUnchanged = await loadResponseSelections(
    supabase,
    sjtRowsAfterUnchanged[0].id,
  );
  assert.equal(sjtSelectionsAfterUnchanged.length, 2);

  const sjtOverwritten = await persistValidatedTeamDynamicsMixedAnswer({
    userId: smokeParticipant.userId,
    payload: sjtPayloadB,
  });
  assert.equal(sjtOverwritten.ok, true);
  assert.equal(sjtOverwritten.status, "overwritten");
  const sjtRowsAfterOverwrite = await loadResponseRows(
    supabase,
    contextResult.context.attemptId,
    sjtItem.questionId,
  );
  assert.equal(sjtRowsAfterOverwrite.length, 1);
  const sjtSelectionsAfterOverwrite = await loadResponseSelections(
    supabase,
    sjtRowsAfterOverwrite[0].id,
  );
  assert.equal(sjtSelectionsAfterOverwrite.length, 2);
  assert.equal(
    sjtSelectionsAfterOverwrite.find((selection) => selection.selection_role === "best")
      ?.answer_option_id,
    sjtBestB,
  );
  assert.equal(
    sjtSelectionsAfterOverwrite.find((selection) => selection.selection_role === "worst")
      ?.answer_option_id,
    sjtWorstA,
  );

  const snapshotBeforeInvalid = JSON.stringify({
    likertRows: likertRowsAfterOverwrite,
    sjtRows: sjtRowsAfterOverwrite,
    sjtSelections: sjtSelectionsAfterOverwrite,
  });

  const sameOptionValidation = await validateTeamDynamicsMixedAnswerPayload({
    userId: smokeParticipant.userId,
    payload: {
      teamAssessmentParticipantId: smokeParticipant.teamAssessmentParticipantId,
      questionId: sjtItem.questionId,
      responseFormat: "best_worst",
      bestOptionId: sjtBestA,
      worstOptionId: sjtBestA,
      locale: contextResult.context.locale,
    },
  });
  assert.equal(sameOptionValidation.ok, false);

  const invalidOptionValidation = await validateTeamDynamicsMixedAnswerPayload({
    userId: smokeParticipant.userId,
    payload: {
      teamAssessmentParticipantId: smokeParticipant.teamAssessmentParticipantId,
      questionId: sjtItem.questionId,
      responseFormat: "best_worst",
      bestOptionId: invalidOptionId,
      worstOptionId: sjtWorstA,
      locale: contextResult.context.locale,
    },
  });
  assert.equal(invalidOptionValidation.ok, false);

  const snapshotAfterInvalid = JSON.stringify({
    likertRows: await loadResponseRows(
      supabase,
      contextResult.context.attemptId,
      likertItem.questionId,
    ),
    sjtRows: await loadResponseRows(
      supabase,
      contextResult.context.attemptId,
      sjtItem.questionId,
    ),
    sjtSelections: await loadResponseSelections(
      supabase,
      sjtRowsAfterOverwrite[0].id,
    ),
  });
  assert.equal(snapshotAfterInvalid.includes(likertOptionB), true);
  assert.equal(snapshotAfterInvalid.includes(sjtBestB), true);
  assert.equal(snapshotBeforeInvalid, snapshotAfterInvalid);

  const { data: attemptAfterData, error: attemptAfterError } = await supabase
    .from("attempts")
    .select("id, status, tests(slug, scoring_method, status, is_active)")
    .eq("id", contextResult.context.attemptId)
    .maybeSingle();

  if (attemptAfterError || !attemptAfterData) {
    throw new Error(
      `Failed to reload smoke attempt after persistence smoke: ${attemptAfterError?.message ?? "unknown error"}`,
    );
  }

  const { data: wrapperAfterData, error: wrapperAfterError } = await supabase
    .from("team_assessment_participants")
    .select("id, status, attempt_id")
    .eq("id", smokeParticipant.teamAssessmentParticipantId)
    .maybeSingle();

  if (wrapperAfterError || !wrapperAfterData) {
    throw new Error(
      `Failed to reload smoke wrapper after persistence smoke: ${wrapperAfterError?.message ?? "unknown error"}`,
    );
  }

  assert.equal(attemptAfterData.status, beforeAttemptStatus);
  assert.equal(wrapperAfterData.status, beforeWrapperStatus);
  assert.equal(extractTestsRelation(attemptAfterData)?.slug, TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);
  assert.equal(extractTestsRelation(attemptAfterData)?.scoring_method, "mixed_v1");

  const afterScoreCount = await loadOptionalCount(
    supabase,
    "team_assessment_participant_scores",
    [["team_assessment_participant_id", smokeParticipant.teamAssessmentParticipantId]],
  );
  const afterAggregationCount = await loadOptionalCount(
    supabase,
    "team_assessment_aggregation_snapshots",
    [["team_assessment_assignment_id", contextResult.context.teamAssessmentAssignmentId]],
  );
  const afterAttemptReportsCount = await loadOptionalCount(
    supabase,
    "attempt_reports",
    [["attempt_id", contextResult.context.attemptId]],
  );
  const afterAssessmentReportsCount = await loadOptionalCount(
    supabase,
    "assessment_reports",
    [["assessment_assignment_id", contextResult.context.teamAssessmentAssignmentId]],
  );

  assert.equal(afterScoreCount, beforeScoreCount);
  assert.equal(afterAggregationCount, beforeAggregationCount);
  assert.equal(afterAttemptReportsCount, beforeAttemptReportsCount);
  assert.equal(afterAssessmentReportsCount, beforeAssessmentReportsCount);

  console.log("Team Dynamics assessment v1 answer persistence DB smoke tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
