const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const workerSource = fs.readFileSync(
  path.join(projectRoot, "lib/assessment/assessment-report-worker.ts"),
  "utf8",
);

const {
  claimNextAssessmentReportJob,
  processClaimedAssessmentReportJob,
} = require("../lib/assessment/assessment-report-worker.ts");
const {
  validateCompositeHrReportSnapshot,
} = require("../lib/assessment/composite-hr-report-contract.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildAssessmentReportRow(overrides = {}) {
  return {
    id: "report-1",
    assessment_assignment_id: "assignment-1",
    organization_id: "org-1",
    participant_id: "participant-1",
    report_type: "composite",
    audience: "hr",
    source_type: "assessment",
    report_status: "queued",
    generator_type: null,
    contract_version: null,
    prompt_version_id: null,
    model_name: null,
    generator_version: null,
    input_snapshot: null,
    report_snapshot: null,
    failure_code: null,
    failure_reason: null,
    queued_at: "2026-05-12T08:00:00.000Z",
    started_at: null,
    completed_at: null,
    generated_at: null,
    created_at: "2026-05-12T07:59:00.000Z",
    updated_at: "2026-05-12T07:59:00.000Z",
    metadata: {},
    ...overrides,
  };
}

function createFakeAssessmentReportsClient(initialRows) {
  const rows = initialRows.map((row) => clone(row));
  const calls = {
    select: [],
    update: [],
  };

  function matchesFilters(row, filters) {
    return filters.every(({ field, value }) => row[field] === value);
  }

  function applyOrders(list, orders) {
    return [...list].sort((left, right) => {
      for (const order of orders) {
        const leftValue = left[order.field];
        const rightValue = right[order.field];

        if (leftValue === rightValue) {
          continue;
        }

        const comparison = String(leftValue).localeCompare(String(rightValue));
        return order.ascending ? comparison : -comparison;
      }

      return 0;
    });
  }

  function createSelectQuery() {
    const query = {
      filters: [],
      orders: [],
      rangeStart: 0,
      rangeEnd: Number.MAX_SAFE_INTEGER,
      fields: null,
      eq(field, value) {
        query.filters.push({ field, value });
        return query;
      },
      order(field, options = {}) {
        query.orders.push({ field, ascending: options.ascending !== false });
        return query;
      },
      range(start, end) {
        query.rangeStart = start;
        query.rangeEnd = end;
        return query;
      },
      async execute() {
        calls.select.push({
          fields: query.fields,
          filters: [...query.filters],
          orders: [...query.orders],
          range: [query.rangeStart, query.rangeEnd],
        });

        const filtered = rows.filter((row) => matchesFilters(row, query.filters));
        const ordered = applyOrders(filtered, query.orders);
        const sliced = ordered.slice(query.rangeStart, query.rangeEnd + 1);

        return {
          data: clone(sliced),
          error: null,
        };
      },
      then(resolve, reject) {
        return query.execute().then(resolve, reject);
      },
      select(fields) {
        query.fields = fields;
        return query;
      },
    };

    return query;
  }

  function createUpdateQuery(payload) {
    const query = {
      filters: [],
      fields: null,
      payload,
      eq(field, value) {
        query.filters.push({ field, value });
        return query;
      },
      select(fields) {
        query.fields = fields;
        return query;
      },
      async maybeSingle() {
        calls.update.push({
          payload: clone(query.payload),
          filters: [...query.filters],
          fields: query.fields,
        });

        const matches = rows.filter((row) => matchesFilters(row, query.filters));

        if (matches.length === 0) {
          return {
            data: null,
            error: null,
          };
        }

        for (const row of matches) {
          Object.assign(row, clone(query.payload));
          row.updated_at = row.updated_at ?? "2026-05-12T08:00:00.000Z";
        }

        return {
          data: clone(matches[0]),
          error: null,
        };
      },
      then(resolve, reject) {
        return query.maybeSingle().then(resolve, reject);
      },
    };

    return query;
  }

  return {
    rows,
    calls,
    from(table) {
      assert.equal(table, "assessment_reports");

      return {
        select(fields) {
          const query = createSelectQuery();
          query.fields = fields;
          return query;
        },
        update(payload) {
          return createUpdateQuery(payload);
        },
      };
    },
  };
}

function buildCompositeInputSnapshotFixture(overrides = {}) {
  return {
    contractVersion: "composite_hr_input_v1",
    targetReportContractVersion: "composite_hr_v1",
    sourceType: "assessment",
    reportType: "composite",
    audience: "hr",
    locale: "hr",
    generatedFor: {
      organizationId: "org-1",
      participantId: "participant-1",
      assessmentAssignmentId: "assignment-1",
    },
    assessmentAssignment: {
      id: "assignment-1",
      assignmentType: "standard_battery",
      status: "active",
      locale: "hr",
      createdAt: "2026-05-12T06:00:00.000Z",
    },
    sourceAttempts: [
      {
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        status: "completed",
        completedAt: "2026-05-12T06:30:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 0,
      },
      {
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        status: "completed",
        completedAt: "2026-05-12T06:45:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 1,
      },
      {
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        status: "completed",
        completedAt: "2026-05-12T07:00:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 2,
      },
    ],
    coverage: {
      requiredCount: 3,
      completedCount: 3,
      requiredTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
      completedTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
      missingTestSlugs: [],
    },
    deterministicInputs: {
      ipip: {
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        scale: { min: 1, max: 5 },
        domains: [],
        summarySignals: {
          rankedDomains: ["CONSCIENTIOUSNESS", "AGREEABLENESS", "EXTRAVERSION"],
          highestDomains: ["CONSCIENTIOUSNESS"],
          lowestDomains: ["NEUROTICISM"],
          balancedDomains: [],
          topFacets: [],
          lowestFacets: [],
        },
      },
      safran: {
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        overall: { rawScore: 36, maxScore: 54, band: "moderate_raw", interpretation: "moderate" },
        verbal: { rawScore: 14, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        figural: { rawScore: 10, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        numeric: { rawScore: 12, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        summarySignals: {
          strongestDomain: "verbal",
          lowestDomain: "figural",
        },
      },
      mwms: {
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        scale: { min: 1, max: 7 },
        dimensions: [],
        motivationStructure: {
          autonomousMotivationScore: 6,
          controlledMotivationScore: 3.5,
          amotivationScore: 1.8,
        },
        summarySignals: {
          dominantDrivers: ["intrinsic", "identified"],
          lowerDrivers: ["amotivation", "external_social"],
          cautionFlags: {
            elevatedAmotivation: false,
            highControlledRelativeToAutonomous: false,
            mixedProfile: false,
          },
        },
      },
    },
    summarySignals: {
      personalityHighestDomains: ["CONSCIENTIOUSNESS"],
      personalityLowestDomains: ["NEUROTICISM"],
      cognitiveStrongestDomain: "verbal",
      cognitiveLowestDomain: "figural",
      motivationHighestDrivers: ["intrinsic", "identified"],
      motivationLowestDrivers: ["amotivation", "external_social"],
      crossInstrumentFlags: [],
    },
    guardrails: {
      usesOnlyLinkedAssignmentAttempts: true,
      usesHistoricalAttemptFallback: false,
      usesSingleTestAiReportsAsPrimaryInput: false,
      aiMayNotChangeScores: true,
    },
    metadata: {
      builtAt: "2026-05-12T09:00:00.000Z",
      builderVersion: "v1",
    },
    ...overrides,
  };
}

function createFakeDeps({
  rows,
  snapshot,
  buildError = null,
  generateCompositeHrReport,
  validateCompositeHrReport,
}) {
  const client = createFakeAssessmentReportsClient(rows);
  const builderCalls = [];

  return {
    client,
    builderCalls,
    deps: {
      createSupabaseClient: () => client,
      buildCompositeInputSnapshot: async (input) => {
        builderCalls.push(clone(input));

        if (buildError) {
          throw buildError;
        }

        return clone(snapshot);
      },
      ...(generateCompositeHrReport ? { generateCompositeHrReport } : {}),
      ...(validateCompositeHrReport ? { validateCompositeHrReport } : {}),
      now: () => "2026-05-12T10:10:00.000Z",
      logger: {
        info() {},
        warn() {},
        error() {},
      },
    },
  };
}

async function testClaimQueryAndDecision() {
  const { client, deps } = createFakeDeps({
    rows: [
      buildAssessmentReportRow({
        id: "report-ready",
        report_status: "ready",
        queued_at: "2026-05-12T06:00:00.000Z",
      }),
      buildAssessmentReportRow({
        id: "report-processing",
        report_status: "processing",
        queued_at: "2026-05-12T06:10:00.000Z",
      }),
      buildAssessmentReportRow({
        id: "report-failed",
        report_status: "failed",
        queued_at: "2026-05-12T06:20:00.000Z",
      }),
      buildAssessmentReportRow({
        id: "report-participant",
        audience: "participant",
        queued_at: "2026-05-12T06:30:00.000Z",
      }),
      buildAssessmentReportRow({
        id: "report-single-test",
        source_type: "single_test",
        queued_at: "2026-05-12T06:40:00.000Z",
      }),
      buildAssessmentReportRow({
        id: "report-null-queued",
        queued_at: null,
      }),
      buildAssessmentReportRow({
        id: "report-earlier-queued",
        queued_at: "2026-05-12T05:00:00.000Z",
      }),
    ],
    snapshot: {
      targetReportContractVersion: "composite_hr_v1",
      metadata: {
        builderVersion: "v1",
      },
    },
  });

  const claimedJob = await claimNextAssessmentReportJob({}, deps);

  assert.equal(claimedJob?.id, "report-earlier-queued");
  assert.equal(client.calls.select.length > 0, true);
  assert.deepEqual(client.calls.select[0].filters, [
    { field: "report_status", value: "queued" },
    { field: "report_type", value: "composite" },
    { field: "audience", value: "hr" },
    { field: "source_type", value: "assessment" },
  ]);

  const source = workerSource;
  assert.equal(/buildCompositeHrInputSnapshot/.test(source), true);
  assert.equal(/from\("attempt_reports"\)/.test(source), false);
  assert.equal(/from\("attempts"\)/.test(source), false);
  assert.equal(/from\("responses"\)/.test(source), false);
  assert.equal(/from\("dimension_scores"\)/.test(source), false);
  assert.equal(/generateCompletedAssessmentReport/.test(source), false);
  assert.equal(/createSelectedReportProvider/.test(source), false);
  assert.equal(/report-provider-openai/.test(source), false);
}

async function testSuccessToReadyWithMockProvider() {
  const initialRow = buildAssessmentReportRow({
    id: "report-success",
    queued_at: "2026-05-12T07:00:00.000Z",
  });
  const { client, builderCalls, deps } = createFakeDeps({
    rows: [initialRow],
    snapshot: buildCompositeInputSnapshotFixture(),
  });

  const claimedJob = await claimNextAssessmentReportJob({}, deps);

  assert.equal(claimedJob?.report_status, "processing");
  assert.equal(builderCalls.length, 0);

  const result = await processClaimedAssessmentReportJob(claimedJob, deps);

  assert.equal(result.status, "ready");
  assert.equal(result.snapshot.contractVersion, "composite_hr_v1");
  assert.equal(result.snapshot.source.sourceAttemptIds.join("|"), [
    "attempt-ipip",
    "attempt-safran",
    "attempt-mwms",
  ].join("|"));
  assert.equal(builderCalls.length, 1);
  assert.deepEqual(builderCalls[0], {
    assessmentAssignmentId: "assignment-1",
    organizationId: "org-1",
    participantId: "participant-1",
  });

  const persistedRow = client.rows.find((row) => row.id === "report-success");

  assert.equal(persistedRow.report_status, "ready");
  assert.equal(persistedRow.failure_code, null);
  assert.equal(persistedRow.failure_reason, null);
  assert.equal(persistedRow.input_snapshot.targetReportContractVersion, "composite_hr_v1");
  assert.equal(persistedRow.contract_version, "composite_hr_v1");
  assert.equal(persistedRow.generator_version, "v1");
  assert.equal(persistedRow.model_name, null);
  assert.equal(persistedRow.prompt_version_id, null);
  assert.equal(persistedRow.generator_type, "mock");
  assert.equal(persistedRow.report_snapshot.contractVersion, "composite_hr_v1");
  assert.equal(
    persistedRow.report_snapshot.source.sourceAttemptIds.join("|"),
    persistedRow.input_snapshot.sourceAttempts.map((attempt) => attempt.attemptId).join("|"),
  );
  const validation = validateCompositeHrReportSnapshot(persistedRow.report_snapshot);
  assert.equal(validation.ok, true);
  assert.equal(typeof persistedRow.generated_at, "string");
  assert.equal(persistedRow.started_at, "2026-05-12T10:10:00.000Z");
  assert.equal(persistedRow.completed_at, "2026-05-12T10:10:00.000Z");
}

async function testInputNotReady() {
  const inputError = new Error("Composite HR input snapshot requires ready linked attempts for assignment assignment-2.");
  const initialRow = buildAssessmentReportRow({
    id: "report-input-not-ready",
    assessment_assignment_id: "assignment-2",
    organization_id: "org-2",
    participant_id: "participant-2",
    queued_at: "2026-05-12T07:10:00.000Z",
  });
  const { client, builderCalls, deps } = createFakeDeps({
    rows: [initialRow],
    snapshot: {
      contractVersion: "composite_hr_input_v1",
      targetReportContractVersion: "composite_hr_v1",
      metadata: {
        builderVersion: "v1",
      },
    },
    buildError: inputError,
  });

  const claimedJob = await claimNextAssessmentReportJob({}, deps);
  const result = await processClaimedAssessmentReportJob(claimedJob, deps);

  assert.equal(result.status, "failed");
  assert.equal(result.failure.code, "COMPOSITE_INPUT_NOT_READY");
  assert.equal(result.failure.reason, inputError.message);
  assert.equal(builderCalls.length, 1);
  assert.deepEqual(builderCalls[0], {
    assessmentAssignmentId: "assignment-2",
    organizationId: "org-2",
    participantId: "participant-2",
  });

  const persistedRow = client.rows.find((row) => row.id === "report-input-not-ready");

  assert.equal(persistedRow.report_status, "failed");
  assert.equal(persistedRow.failure_code, "COMPOSITE_INPUT_NOT_READY");
  assert.equal(persistedRow.failure_reason, inputError.message);
  assert.equal(persistedRow.input_snapshot, null);
  assert.equal(persistedRow.report_snapshot, null);
  assert.equal(persistedRow.completed_at, "2026-05-12T10:10:00.000Z");
}

async function testInvalidProviderOutput() {
  const initialRow = buildAssessmentReportRow({
    id: "report-invalid-provider-output",
    assessment_assignment_id: "assignment-3",
    organization_id: "org-3",
    participant_id: "participant-3",
    queued_at: "2026-05-12T07:20:00.000Z",
  });
  const { client, deps } = createFakeDeps({
    rows: [initialRow],
    snapshot: buildCompositeInputSnapshotFixture({
      generatedFor: {
        organizationId: "org-3",
        participantId: "participant-3",
        assessmentAssignmentId: "assignment-3",
      },
      assessmentAssignment: {
        id: "assignment-3",
        assignmentType: "standard_battery",
        status: "active",
        locale: "hr",
        createdAt: "2026-05-12T06:00:00.000Z",
      },
    }),
    generateCompositeHrReport: async () => ({
      contractVersion: "broken",
      reportType: "composite",
    }),
    validateCompositeHrReport: validateCompositeHrReportSnapshot,
  });

  const claimedJob = await claimNextAssessmentReportJob({}, deps);
  const result = await processClaimedAssessmentReportJob(claimedJob, deps);

  assert.equal(result.status, "failed");
  assert.equal(result.failure.code, "COMPOSITE_REPORT_VALIDATION_FAILED");
  assert.equal(result.failure.reason.includes("contractVersion"), true);

  const persistedRow = client.rows.find((row) => row.id === "report-invalid-provider-output");

  assert.equal(persistedRow.report_status, "failed");
  assert.equal(persistedRow.failure_code, "COMPOSITE_REPORT_VALIDATION_FAILED");
  assert.equal(persistedRow.report_snapshot, null);
  assert.equal(typeof persistedRow.input_snapshot, "object");
  assert.equal(persistedRow.generated_at, null);
}

async function main() {
  await testClaimQueryAndDecision();
  await testSuccessToReadyWithMockProvider();
  await testInputNotReady();
  await testInvalidProviderOutput();

  console.log("Assessment report worker tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
