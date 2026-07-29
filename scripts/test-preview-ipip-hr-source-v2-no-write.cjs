const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const preview = require("./preview-ipip-hr-source-v2-no-write.cjs");

preview.installTypeScriptRuntime();

const {
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
} = require("../lib/assessment/ipip-neo-120-labels.ts");
const {
  buildPreparedReportGenerationInput,
} = require("../lib/assessment/report-provider-helpers.ts");
const {
  buildOpenAiStructuredRequestPayload,
  validateStructuredReport,
} = require("../lib/assessment/report-provider-openai.ts");

const { CONFIRMATION_TOKEN, EXPECTED_SHA256, TARGET } = preview;

function buildRequest() {
  const dimensions = [];

  for (const [domainIndex, domainCode] of IPIP_NEO_120_DOMAIN_ORDER.entries()) {
    for (const [facetIndex, facetCode] of IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].entries()) {
      dimensions.push({
        dimension: facetCode,
        rawScore: 4.5 - domainIndex * 0.2 - facetIndex * 0.05,
        scoredQuestionCount: 4,
      });
    }
  }

  return {
    attemptId: TARGET.attemptId,
    testId: "38cdeedc-c123-4fa8-b566-bae5389a1407",
    testSlug: TARGET.testSlug,
    audience: TARGET.audience,
    locale: TARGET.locale,
    scoringMethod: "likert_mean",
    promptVersion: TARGET.promptVersion,
    testName: "IPIP-NEO-120",
    results: {
      attemptId: TARGET.attemptId,
      scoringMethod: "likert_mean",
      dimensions,
      scoredResponseCount: 120,
      unscoredResponses: [],
    },
  };
}

function buildDbState() {
  const stateWithoutSha = {
    attempt: {
      id: TARGET.attemptId,
      participant_id: TARGET.participantId,
      test_id: "38cdeedc-c123-4fa8-b566-bae5389a1407",
      test_slug: TARGET.testSlug,
      status: "completed",
      locale: TARGET.locale,
      started_at: "2026-07-17T13:22:41.882037+00:00",
      completed_at: "2026-07-17T13:39:30.748+00:00",
      metadata_sha256: "fixture-attempt-metadata-sha",
    },
    reports: [
      {
        id: TARGET.reportId,
        attempt_id: TARGET.attemptId,
        test_slug: TARGET.testSlug,
        report_type: TARGET.reportType,
        audience: TARGET.audience,
        source_type: TARGET.sourceType,
        report_status: "ready",
        generator_type: "openai",
        model_name: "gpt-5.5",
        prompt_version_id: "ca910d21-a5ac-4f23-9025-c4e047cc4779",
        generator_version: "v1",
        generated_at: "2026-07-27T11:43:11.151+00:00",
        started_at: "2026-07-29T10:47:39.185193+00:00",
        completed_at: "2026-07-29T10:49:32.306829+00:00",
        failure_code: null,
        failure_reason: null,
        input_snapshot_sha256: "fixture-input-snapshot-sha",
        report_snapshot_sha256: "fixture-report-snapshot-sha",
      },
    ],
    counts: {
      report_rows: 1,
      queued: 0,
      processing: 0,
    },
  };

  return {
    ...stateWithoutSha,
    state_sha256: preview.sha256(stateWithoutSha),
  };
}

function buildFakeReport(promptInput) {
  return {
    contract_version: "ipip_neo_120_hr_v2",
    test: {
      code: "ipip_neo_120",
      name: "IPIP-NEO-120",
    },
    meta: {
      language: "bs",
      audience: "hr",
    },
    score_references: {
      test_slug: promptInput.test_slug,
      locale: promptInput.locale,
      domains: promptInput.domains.map((domain) => ({
        domain_code: domain.domain_code,
        domain_name: domain.label,
        score: domain.score,
        score_label_or_band: domain.score_band,
        facets: domain.facets.map((facet) => ({
          facet_code: facet.facet_code,
          facet_name: facet.label,
          score: facet.score,
          score_label_or_band: facet.score_band,
        })),
      })),
    },
    headline: "Pouzdanost u izvršenju uz jasnu provjeru prioriteta",
    executive_summary: "Rezultat daje radnu hipotezu za provjeru kroz iskustvo i intervju.",
    key_hr_signals: [1, 2, 3].map((index) => ({
      title: `Signal ${index}`,
      evidence: `Uporište u rezultatima ${index}.`,
      hr_implication: `Praktična HR implikacija ${index}.`,
    })),
    verification_focus: [1, 2, 3].map((index) => ({
      area: `Oblast ${index}`,
      why_it_matters: `Važnost provjere ${index}.`,
      how_to_check: `Provjeriti kroz konkretan primjer ${index}.`,
    })),
    interview_questions: [1, 2, 3, 4, 5].map((index) => ({
      question: `Navedite konkretan primjer ponašanja ${index}.`,
      evaluates: `Procjena ponašanja ${index}.`,
      what_good_answer_may_show: `Dobar odgovor može pokazati obrazac ${index}.`,
    })),
    strengths_and_overuse_risks: [1, 2].map((index) => ({
      trait_or_pattern: `Obrazac ${index}`,
      possible_strengths: [`Snaga ${index}a`, `Snaga ${index}b`, `Snaga ${index}c`],
      possible_overuse_risks: [`Rizik ${index}a`, `Rizik ${index}b`, `Rizik ${index}c`],
      hr_handling_tip: `Smjernica za postupanje ${index}.`,
    })),
    domain_overview: promptInput.domains.map((domain) => ({
      domain_name: domain.label,
      score_label_or_band: domain.score_band,
      concise_meaning: `Sažeto značenje za ${domain.label}.`,
      hr_relevance: `HR relevantnost za ${domain.label}.`,
      check_in_interview: `Provjera za ${domain.label}.`,
      top_facets: [],
    })),
    onboarding_and_management_guidance: [1, 2, 3, 4].map((index) => ({
      recommendation: `Preporuka ${index}.`,
      why: `Razlog ${index}.`,
      first_30_days_application: `Primjena u prvih 30 dana ${index}.`,
    })),
    team_fit_notes: [1, 2, 3].map((index) => ({
      fit_condition: `Uslov saradnje ${index}.`,
      may_work_well_when: `Može funkcionisati kada ${index}.`,
      watchout: `Obratiti pažnju na ${index}.`,
    })),
    decision_support_note: [
      "Ovaj izvještaj nije samostalna odluka.",
      "Nalaze treba kombinovati sa intervjuom, iskustvom, referencama i zahtjevima uloge.",
    ],
    interpretation_note: "Rezultat je hipoteza za provjeru u kontekstu konkretne uloge.",
  };
}

function buildDependencies(request, state, callCounter) {
  return {
    buildCompletedAssessmentReportRequest: async (testId, attemptId, options) => {
      assert.equal(testId, request.testId);
      assert.equal(attemptId, request.attemptId);
      assert.deepEqual(options, {
        audience: "hr",
        locale: "bs",
        promptVersion: TARGET.promptVersion,
      });
      return request;
    },
    buildPreparedReportGenerationInput,
    buildOpenAiStructuredRequestPayload,
    validateStructuredReport,
    getAiReportConfig: () => ({
      provider: "openai",
      model: "gpt-5.6-sol",
      reasoningEffort: "medium",
      fallbackToMock: false,
      openAiApiKey: null,
      openAiTimeoutMs: 120000,
    }),
    createOpenAiReportProvider: () => {
      throw new Error("real provider adapter must not be created in fake-provider test");
    },
    loadDbState: async () => {
      callCounter.dbReads += 1;
      return clone(state);
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalCliArgs(extra = []) {
  return [
    "--attempt",
    TARGET.attemptId,
    "--report",
    TARGET.reportId,
    "--prompt-key",
    TARGET.promptKey,
    "--prompt-version",
    TARGET.promptVersion,
    ...extra,
  ];
}

function assertFailureArtifacts(result, { raw, normalized }) {
  for (const fileName of [
    "manifest.json",
    "canonical-input.json",
    "source-prompt.json",
    "provider-request.json",
    "db-before-state.json",
    "db-after-state.json",
    "verification.json",
  ]) {
    assert.equal(fs.existsSync(path.join(result.artifact_directory, fileName)), true);
  }

  assert.equal(
    fs.existsSync(path.join(result.artifact_directory, "raw-provider-result.json")),
    raw,
  );
  assert.equal(
    fs.existsSync(path.join(result.artifact_directory, "normalized-preview.json")),
    normalized,
  );
  assert.equal(result.verification.db_verdict, "DB_WRITES_ZERO_AND_EXISTING_REPORT_UNCHANGED");
  assert.equal(result.verification.provider_verdict, result.provider_outcome);
  assert.equal(result.db_state_exact_match, true);
}

async function main() {
  const previousReasoning = process.env.AI_REPORT_REASONING_EFFORT;
  process.env.AI_REPORT_REASONING_EFFORT = "medium";

  try {
    assert.deepEqual(EXPECTED_SHA256, {
      input: "020851d3589a07ae514bdd1863cc7766d9ab65df5100e2d15aa44bf5e4654f98",
      prompt: "2a6d322fe02e8c5072d068fdaa9115d77d468ea0bd96a1df9bc2a54a3ee11525",
      request: "b45fa540f5fe2d3b00b25f330484fa62cc4862e8a6f781df4b447124fb5b4a35",
    });
    const source = preview.resolveSourcePrompt();
    assert.equal(source.sourcePrompt.authority, "source_prompt_version");
    assert.equal(source.sourcePrompt.prompt_key, TARGET.promptKey);
    assert.equal(source.sourcePrompt.version, TARGET.promptVersion);
    assert.equal(source.sourcePrompt.is_active, false);
    assert.throws(
      () => preview.resolveSourcePrompt({ promptVersion: "wrong-version" }),
      /must contain exactly one target prompt record/,
    );

    const sourceCode = fs.readFileSync(
      path.join(projectRoot, "scripts/preview-ipip-hr-source-v2-no-write.cjs"),
      "utf8",
    );
    assert.doesNotMatch(sourceCode, /getActivePromptVersion/);
    assert.doesNotMatch(sourceCode, /getActiveReportRuntimeConfig/);
    assert.doesNotMatch(sourceCode, /claim_report_job|complete_report_job|fail_report_job/);
    assert.doesNotMatch(sourceCode, /freezeProcessingReportMetadata|report-job-worker/);
    assert.doesNotMatch(
      sourceCode,
      /\.from\([^)]*\)\.(?:insert|update|upsert|delete)\(/,
      'preview seam must not contain Supabase persistence mutations',
    );

    const parsed = preview.parseCliArgs(canonicalCliArgs());
    assert.equal(parsed.executeProvider, false);
    assert.equal(parsed.confirmationToken, null);
    assert.equal(parsed.providerTimeoutMs, null);
    assert.equal(
      preview.parseCliArgs(canonicalCliArgs(["--provider-timeout-ms", "60000"]))
        .providerTimeoutMs,
      60000,
    );
    for (const invalidTimeout of ["29999", "600001", "not-an-integer"]) {
      assert.throws(
        () => preview.parseCliArgs(canonicalCliArgs(["--provider-timeout-ms", invalidTimeout])),
        /--provider-timeout-ms/,
      );
    }
    assert.throws(
      () =>
        preview.parseCliArgs([
          ...canonicalCliArgs(),
          "--prompt-version",
          "wrong-version",
        ]),
      /must equal v2_ipip_hr_natural_bosnian_section_roles_20260729/,
    );
    await assert.rejects(
      () =>
        preview.runPreview({
          identity: TARGET,
          env: { NODE_ENV: "production" },
          dependencies: {
            loadDbState: async () => {
              throw new Error("production guard failed before DB access");
            },
          },
        }),
      /requires NODE_ENV=development or NODE_ENV=test/,
    );

    const request = buildRequest();
    const state = buildDbState();
    const callCounter = { provider: 0, dbReads: 0 };
    assert.equal(callCounter.provider, 0);
    const dependencies = buildDependencies(request, state, callCounter);
    const prepareDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "ipip-hr-source-v2-prepare-test-"),
    );
    const prepareResult = await preview.runPreview({
      identity: TARGET,
      artifactDirectory: prepareDirectory,
      dependencies,
      env: { NODE_ENV: "test" },
      assertExpectedShas: false,
    });

    assert.equal(prepareResult.final_status, "READY_FOR_EXPLICIT_ONE_CALL_APPROVAL");
    assert.equal(prepareResult.provider_call_count, 0);
    assert.equal(prepareResult.provider.model, "gpt-5.6-sol");
    assert.equal(prepareResult.provider.reasoningEffort, "medium");
    assert.equal(prepareResult.validation_status, "not_run_prepare_only");
    assert.equal(callCounter.provider, 0);
    assert.equal(callCounter.dbReads, 1);
    assert.equal(Object.hasOwn(prepareResult.provider, "apiKey"), false);
    for (const fileName of [
      "manifest.json",
      "canonical-input.json",
      "source-prompt.json",
      "provider-request.json",
      "db-before-state.json",
    ]) {
      assert.equal(fs.existsSync(path.join(prepareDirectory, fileName)), true);
    }

    const plannedPrepare = await preview.runPreview({
      identity: TARGET,
      artifactDirectory: fs.mkdtempSync(path.join(os.tmpdir(), "ipip-hr-source-v2-planned-timeout-test-")),
      dependencies,
      env: { NODE_ENV: "test" },
      providerTimeoutMs: 60000,
      assertExpectedShas: false,
    });
    assert.equal(plannedPrepare.provider_call_count, 0);
    assert.equal(plannedPrepare.provider.timeoutMs, 120000);
    assert.equal(plannedPrepare.provider.plannedTimeoutMs, 60000);
    assert.equal(plannedPrepare.provider_timeout_ms, 60000);

    const unauthorized = await preview.runPreview({
      identity: TARGET,
      artifactDirectory: fs.mkdtempSync(path.join(os.tmpdir(), "ipip-hr-source-v2-auth-test-")),
      dependencies,
      env: { NODE_ENV: "test" },
      executeProvider: true,
      confirmationToken: null,
      provider: async () => {
        throw new Error("unauthorized provider must not be called");
      },
      assertExpectedShas: false,
    });
    assert.equal(unauthorized.final_status, "PROVIDER_CALL_NOT_AUTHORIZED");
    assert.equal(callCounter.provider, 0);

    const confirmationOnly = await preview.runPreview({
      identity: TARGET,
      artifactDirectory: fs.mkdtempSync(path.join(os.tmpdir(), "ipip-hr-source-v2-confirmation-only-test-")),
      dependencies,
      env: { NODE_ENV: "test" },
      executeProvider: false,
      confirmationToken: CONFIRMATION_TOKEN,
      provider: async () => {
        throw new Error("confirmation token alone must not authorize provider");
      },
      assertExpectedShas: false,
    });
    assert.equal(confirmationOnly.final_status, "READY_FOR_EXPLICIT_ONE_CALL_APPROVAL");
    assert.equal(callCounter.provider, 0);

    const fakeReport = buildFakeReport(prepareResult.preparedInput.promptInput);

    callCounter.provider = 0;
    const timeoutResult = await preview.runPreview({
      identity: TARGET,
      artifactDirectory: fs.mkdtempSync(path.join(os.tmpdir(), "ipip-hr-source-v2-timeout-test-")),
      dependencies,
      env: { NODE_ENV: "test" },
      executeProvider: true,
      confirmationToken: CONFIRMATION_TOKEN,
      providerTimeoutMs: 60000,
      provider: async () => {
        callCounter.provider += 1;
        const error = new Error("provider timed out after 60000ms");
        error.name = "TimeoutError";
        throw error;
      },
      assertExpectedShas: false,
    });
    assert.equal(callCounter.provider, 1);
    assert.equal(timeoutResult.provider_call_count, 1);
    assert.equal(timeoutResult.provider_outcome, "PROVIDER_TIMEOUT");
    assert.equal(timeoutResult.provider_error_type, "TimeoutError");
    assert.equal(timeoutResult.provider_timeout_ms, 60000);
    assert.equal(timeoutResult.final_status, "SOURCE_V2_PREVIEW_PROVIDER_TIMEOUT_DB_UNCHANGED");
    assert.equal(timeoutResult.hashes.raw_result_sha256, null);
    assert.equal(timeoutResult.hashes.normalized_result_sha256, null);
    assertFailureArtifacts(timeoutResult, { raw: false, normalized: false });

    callCounter.provider = 0;
    const providerErrorResult = await preview.runPreview({
      identity: TARGET,
      artifactDirectory: fs.mkdtempSync(path.join(os.tmpdir(), "ipip-hr-source-v2-provider-error-test-")),
      dependencies,
      env: { NODE_ENV: "test" },
      executeProvider: true,
      confirmationToken: CONFIRMATION_TOKEN,
      provider: async () => {
        callCounter.provider += 1;
        throw new Error("synthetic provider failure");
      },
      assertExpectedShas: false,
    });
    assert.equal(callCounter.provider, 1);
    assert.equal(providerErrorResult.provider_outcome, "PROVIDER_ERROR");
    assert.equal(providerErrorResult.provider_error_type, "ProviderError");
    assert.equal(providerErrorResult.final_status, "SOURCE_V2_PREVIEW_PROVIDER_ERROR_DB_UNCHANGED");
    assertFailureArtifacts(providerErrorResult, { raw: false, normalized: false });

    callCounter.provider = 0;
    const validationErrorResult = await preview.runPreview({
      identity: TARGET,
      artifactDirectory: fs.mkdtempSync(path.join(os.tmpdir(), "ipip-hr-source-v2-validation-error-test-")),
      dependencies,
      env: { NODE_ENV: "test" },
      executeProvider: true,
      confirmationToken: CONFIRMATION_TOKEN,
      provider: async () => {
        callCounter.provider += 1;
        return { invalid: "structured report" };
      },
      assertExpectedShas: false,
    });
    assert.equal(callCounter.provider, 1);
    assert.equal(validationErrorResult.provider_outcome, "PROVIDER_RESULT_INVALID");
    assert.equal(validationErrorResult.provider_error_type, "ValidationError");
    assert.equal(validationErrorResult.final_status, "SOURCE_V2_PREVIEW_RESULT_INVALID_DB_UNCHANGED");
    assert.ok(validationErrorResult.hashes.raw_result_sha256);
    assert.equal(validationErrorResult.hashes.normalized_result_sha256, null);
    assertFailureArtifacts(validationErrorResult, { raw: true, normalized: false });

    callCounter.provider = 0;
    let seenRequest = null;
    const executeResult = await preview.runPreview({
      identity: TARGET,
      artifactDirectory: fs.mkdtempSync(path.join(os.tmpdir(), "ipip-hr-source-v2-execute-test-")),
      dependencies,
      env: { NODE_ENV: "test" },
      executeProvider: true,
      confirmationToken: CONFIRMATION_TOKEN,
      provider: async ({ preparedInput, requestPayload, callNumber }) => {
        callCounter.provider += 1;
        assert.equal(callNumber, 1);
        assert.equal(preparedInput.promptVersion, TARGET.promptVersion);
        seenRequest = requestPayload;
        return fakeReport;
      },
      assertExpectedShas: false,
    });

    assert.equal(callCounter.provider, 1);
    assert.equal(executeResult.provider_call_count, 1);
    assert.equal(executeResult.final_status, "DB_WRITES_ZERO_AND_EXISTING_REPORT_UNCHANGED");
    assert.equal(executeResult.validation_status, "validated_and_normalized_in_memory");
    assert.equal(executeResult.provider_outcome, "PROVIDER_RESULT_AVAILABLE_AND_VALID");
    assert.equal(executeResult.verification.db_verdict, "DB_WRITES_ZERO_AND_EXISTING_REPORT_UNCHANGED");
    assert.ok(executeResult.hashes.normalized_result_sha256);
    assert.equal(seenRequest.requestBody.model, "gpt-5.6-sol");
    assert.equal(seenRequest.requestBody.reasoning_effort, "medium");
    assert.equal(Object.hasOwn(seenRequest.requestBody, "temperature"), false);
    assert.deepEqual(executeResult.beforeState, executeResult.afterState);
    assert.equal(
      executeResult.verification.status,
      "DB_WRITES_ZERO_AND_EXISTING_REPORT_UNCHANGED",
    );
    for (const fileName of [
      "raw-provider-result.json",
      "normalized-preview.json",
      "db-after-state.json",
      "verification.json",
    ]) {
      assert.equal(fs.existsSync(path.join(executeResult.artifact_directory, fileName)), true);
    }

    console.log("test-preview-ipip-hr-source-v2-no-write: ok");
  } finally {
    if (previousReasoning === undefined) {
      delete process.env.AI_REPORT_REASONING_EFFORT;
    } else {
      process.env.AI_REPORT_REASONING_EFFORT = previousReasoning;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
