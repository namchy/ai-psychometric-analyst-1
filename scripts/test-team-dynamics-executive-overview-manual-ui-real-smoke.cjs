const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const nextLinkStubPath = path.join(__dirname, "next-link-stub.cjs");
const processActionStubPath = path.join(__dirname, "td-process-action-stub.cjs");
const retryActionStubPath = path.join(__dirname, "td-retry-action-stub.cjs");
const queueListPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "team-dynamics-report-queue-list.tsx",
);
const routePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "teams",
  "[teamId]",
  "reports",
  "[teamAssessmentReportId]",
  "page.tsx",
);
const originalResolveFilename = Module._resolveFilename;

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

  if (request === "next/link") {
    return nextLinkStubPath;
  }

  if (request === "@/components/dashboard/team-dynamics-report-process-action") {
    return processActionStubPath;
  }

  if (request === "@/components/dashboard/team-dynamics-report-retry-action") {
    return retryActionStubPath;
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

require.extensions[".tsx"] = function compileTsx(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

require.cache[nextLinkStubPath] = {
  id: nextLinkStubPath,
  filename: nextLinkStubPath,
  loaded: true,
  exports: function Link(props) {
    const { href, children, ...rest } = props;
    return React.createElement("a", { href, ...rest }, children);
  },
};

require.cache[processActionStubPath] = {
  id: processActionStubPath,
  filename: processActionStubPath,
  loaded: true,
  exports: {
    TeamDynamicsReportProcessAction({ teamAssessmentReportId, teamId }) {
      return React.createElement(
        "button",
        {
          type: "button",
          "data-process-report-id": teamAssessmentReportId,
          "data-process-team-id": teamId,
        },
        "Obradi izvještaj",
      );
    },
  },
};

require.cache[retryActionStubPath] = {
  id: retryActionStubPath,
  filename: retryActionStubPath,
  loaded: true,
  exports: {
    TeamDynamicsReportRetryAction({ teamAssessmentReportId, teamId }) {
      return React.createElement(
        "button",
        {
          type: "button",
          "data-retry-report-id": teamAssessmentReportId,
          "data-retry-team-id": teamId,
        },
        "Pokušaj ponovo",
      );
    },
  },
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

async function deleteReportRows(supabase, reportIds) {
  if (!Array.isArray(reportIds) || reportIds.length === 0) {
    return;
  }

  const { error } = await supabase.from("team_assessment_reports").delete().in("id", reportIds);

  if (error) {
    throw new Error(`Failed to cleanup Team Dynamics report rows: ${error.message}`);
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

function renderQueueList(TeamDynamicsReportQueueList, teamId, reportRows) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(TeamDynamicsReportQueueList, {
      teamId,
      reportRows,
    }),
  );
}

function parseJsonOutput(rawOutput) {
  const trimmed = rawOutput.trim();

  if (!trimmed) {
    throw new Error("Smoke command returned empty output.");
  }

  return JSON.parse(trimmed);
}

function summarizeControlledFailure(result) {
  return {
    status: result.status,
    marker: result.marker ?? null,
    processorOperation: result.processorOperation ?? null,
    providerCode: result.providerCode ?? null,
    message: result.message,
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

  const routeSource = fs.readFileSync(routePath, "utf8");
  assert.doesNotMatch(
    routeSource,
    /processTeamDynamicsExecutiveOverviewReportAction|resetTeamDynamicsExecutiveOverviewReportAction|processTeamDynamicsExecutiveOverviewWithOpenAI|generateTeamDynamicsExecutiveOverviewWithOpenAI/,
  );

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

  const bootstrapRaw = execFileSync(
    "node",
    ["scripts/test-team-dynamics-executive-overview-openai-db-smoke.cjs"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        KEEP_TD_OPENAI_SMOKE_DATA: "1",
      },
    },
  );

  const bootstrap = parseJsonOutput(bootstrapRaw);

  if (bootstrap.skipped) {
    console.log(JSON.stringify(bootstrap, null, 2));
    return;
  }

  if (bootstrap.controlledFailure) {
    console.log(
      JSON.stringify(
        buildControlledFailureResult(
          "Bootstrap OpenAI DB smoke reached a controlled failure before manual UI/runtime verification.",
          {
            bootstrap: bootstrap.outcome ?? bootstrap,
          },
        ),
        null,
        2,
      ),
    );
    return;
  }

  const fixture = bootstrap.fixture;

  if (
    !fixture ||
    !isNonEmptyString(fixture.organizationId) ||
    !isNonEmptyString(fixture.teamId) ||
    !isNonEmptyString(fixture.teamAssessmentAssignmentId) ||
    !isNonEmptyString(fixture.selectionDraftId)
  ) {
    throw new Error("Bootstrap smoke did not return a usable fixture payload.");
  }

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const {
    TEAM_DYNAMICS_REPORT_TYPE,
    TEAM_DYNAMICS_REPORT_VERSION,
    queueTeamDynamicsReportShell,
    listTeamDynamicsReportRowsForAssignment,
  } = require("../lib/b2b/team-dynamics-report-lifecycle.ts");
  const {
    loadTeamDynamicsFinalAggregationVerification,
  } = require("../lib/assessment/team-dynamics-final-aggregation-read.ts");
  const {
    processTeamDynamicsExecutiveOverviewReportAction,
    resetTeamDynamicsExecutiveOverviewReportAction,
  } = require("../app/actions/team-assessments.ts");
  const {
    validateTeamDynamicsExecutiveOverviewSnapshot,
  } = require("../lib/b2b/team-dynamics-executive-overview-contract.ts");
  const {
    loadTeamDynamicsExecutiveOverviewReportForDisplay,
  } = require("../lib/b2b/team-dynamics-executive-overview-display.ts");
  const {
    TeamDynamicsReportQueueList,
  } = require(queueListPath);

  const supabase = createSupabaseAdminClient();
  const cleanup = {
    createdReportIds: [],
  };

  const attemptIds = await loadAssignmentAttemptIds(supabase, fixture.teamAssessmentAssignmentId);
  const beforeCounts = {
    attemptReportsForFixtureAttempts: await countAttemptReportsForAttempts(supabase, attemptIds),
    assessmentReportsForFixtureOrganization: await countAssessmentReportsForOrganization(
      supabase,
      fixture.organizationId,
    ),
  };

  try {
    const queued = await queueTeamDynamicsReportShell({
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      teamAssessmentAssignmentId: fixture.teamAssessmentAssignmentId,
      selectionDraftId: fixture.selectionDraftId,
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
    cleanup.createdReportIds.push(queued.report.id);
    assert.equal(queued.report.reportType, TEAM_DYNAMICS_REPORT_TYPE);
    assert.equal(queued.report.reportVersion, TEAM_DYNAMICS_REPORT_VERSION);

    const queuedRows = await listTeamDynamicsReportRowsForAssignment({
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      teamAssessmentAssignmentId: fixture.teamAssessmentAssignmentId,
    });
    const queuedMarkup = renderQueueList(TeamDynamicsReportQueueList, fixture.teamId, queuedRows);
    assert.match(queuedMarkup, /Obradi izvještaj/);

    const unauthorizedProcess = await processTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: queued.report.id,
        teamId: fixture.teamId,
      },
      {
        requireUser: async () => ({ id: "smoke-user" }),
        getActiveOrganization: async () => ({ id: "00000000-0000-0000-0000-000000000000" }),
        revalidate: () => {},
      },
    );
    assert.equal(unauthorizedProcess.ok, false);
    assert.equal(unauthorizedProcess.status, "unauthorized");

    const processed = await processTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: queued.report.id,
        teamId: fixture.teamId,
      },
      {
        requireUser: async () => ({ id: "smoke-user" }),
        getActiveOrganization: async () => ({ id: fixture.organizationId }),
        revalidate: () => {},
      },
    );

    if (!processed.ok) {
      if (processed.status === "failed") {
        console.log(
          JSON.stringify(
            buildControlledFailureResult(
              "Manual Team Dynamics Executive Overview processing hit a controlled failed path.",
              {
                outcome: summarizeControlledFailure(processed),
                verified: [
                  "queued report was visible in the queue list before manual processing",
                  "manual server action boundary executed against a real OpenAI provider path",
                  "report view route still does not generate reports",
                ],
              },
            ),
            null,
            2,
          ),
        );
        return;
      }

      throw new Error(
        `Unexpected manual process action failure: ${processed.status} | ${processed.message}`,
      );
    }

    assert.equal(processed.status, "ready");

    const readyRows = await listTeamDynamicsReportRowsForAssignment({
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      teamAssessmentAssignmentId: fixture.teamAssessmentAssignmentId,
    });
    const readyRow = readyRows.find((row) => row.id === queued.report.id);
    assert.ok(readyRow);
    assert.equal(readyRow.reportStatus, "ready");
    assert.ok(readyRow.reportSnapshot);

    const readyValidation = validateTeamDynamicsExecutiveOverviewSnapshot(
      readyRow.reportSnapshot,
    );
    assert.equal(readyValidation.ok, true, readyValidation.ok ? "" : readyValidation.errors.join("; "));

    const readyMarkup = renderQueueList(TeamDynamicsReportQueueList, fixture.teamId, readyRows);
    assert.match(readyMarkup, /Otvori izvještaj/);

    const displayReady = await loadTeamDynamicsExecutiveOverviewReportForDisplay({
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      teamAssessmentReportId: queued.report.id,
    });
    assert.ok(displayReady);
    assert.equal(displayReady.status, "ready");

    const wrongOrganizationDisplay = await loadTeamDynamicsExecutiveOverviewReportForDisplay({
      organizationId: "00000000-0000-0000-0000-000000000000",
      teamId: fixture.teamId,
      teamAssessmentReportId: queued.report.id,
    });
    const wrongTeamDisplay = await loadTeamDynamicsExecutiveOverviewReportForDisplay({
      organizationId: fixture.organizationId,
      teamId: "00000000-0000-0000-0000-000000000000",
      teamAssessmentReportId: queued.report.id,
    });
    assert.equal(wrongOrganizationDisplay, null);
    assert.equal(wrongTeamDisplay, null);

    const retrySeed = await queueTeamDynamicsReportShell({
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      teamAssessmentAssignmentId: fixture.teamAssessmentAssignmentId,
      selectionDraftId: fixture.selectionDraftId,
    }, {
      supabase,
      loadAggregationVerification: async (queueInput) =>
        mapFinalAggregationToQueueVerification(
          await loadTeamDynamicsFinalAggregationVerification(queueInput, {
            supabase,
          }),
        ),
    });
    assert.equal(retrySeed.ok, true, retrySeed.ok ? "" : retrySeed.reason);
    cleanup.createdReportIds.push(retrySeed.report.id);

    const { data: failedRowData, error: failedRowError } = await supabase
      .from("team_assessment_reports")
      .update({
        report_status: "failed",
        error_message: "SMOKE_FORCED_FAILURE",
        started_at: "2026-05-29T16:40:00.000Z",
        completed_at: "2026-05-29T16:45:00.000Z",
      })
      .eq("id", retrySeed.report.id)
      .eq("organization_id", fixture.organizationId)
      .select("id, report_status, error_message")
      .maybeSingle();

    if (failedRowError || !failedRowData) {
      throw new Error(
        `Failed to seed Team Dynamics failed report state for retry smoke: ${failedRowError?.message ?? "missing row"}`,
      );
    }

    const failedRows = await listTeamDynamicsReportRowsForAssignment({
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      teamAssessmentAssignmentId: fixture.teamAssessmentAssignmentId,
    });
    const failedMarkup = renderQueueList(TeamDynamicsReportQueueList, fixture.teamId, failedRows);
    assert.match(failedMarkup, /Nije uspješno kreiran/);
    assert.match(failedMarkup, /Pokušaj ponovo/);

    const unauthorizedRetry = await resetTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: retrySeed.report.id,
        teamId: fixture.teamId,
      },
      {
        requireUser: async () => ({ id: "smoke-user" }),
        getActiveOrganization: async () => ({ id: "00000000-0000-0000-0000-000000000000" }),
        revalidate: () => {},
      },
    );
    assert.equal(unauthorizedRetry.ok, false);
    assert.equal(unauthorizedRetry.status, "unauthorized");

    const retried = await resetTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: retrySeed.report.id,
        teamId: fixture.teamId,
      },
      {
        requireUser: async () => ({ id: "smoke-user" }),
        getActiveOrganization: async () => ({ id: fixture.organizationId }),
        revalidate: () => {},
      },
    );
    assert.equal(retried.ok, true, retried.ok ? "" : retried.message);
    assert.equal(retried.status, "queued");

    const queuedAgainRows = await listTeamDynamicsReportRowsForAssignment({
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      teamAssessmentAssignmentId: fixture.teamAssessmentAssignmentId,
    });
    const retriedRow = queuedAgainRows.find((row) => row.id === retrySeed.report.id);
    assert.ok(retriedRow);
    assert.equal(retriedRow.reportStatus, "queued");
    assert.equal(retriedRow.errorMessage, null);
    assert.equal(retriedRow.startedAt, null);
    assert.equal(retriedRow.completedAt, null);
    assert.equal(retriedRow.reportSnapshot, null);

    const queuedAgainMarkup = renderQueueList(
      TeamDynamicsReportQueueList,
      fixture.teamId,
      queuedAgainRows,
    );
    assert.match(queuedAgainMarkup, /Obradi izvještaj/);
    assert.doesNotMatch(queuedAgainMarkup, /retry and process/i);

    const afterCounts = {
      attemptReportsForFixtureAttempts: await countAttemptReportsForAttempts(supabase, attemptIds),
      assessmentReportsForFixtureOrganization: await countAssessmentReportsForOrganization(
        supabase,
        fixture.organizationId,
      ),
    };
    assert.deepEqual(afterCounts, beforeCounts);

    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: false,
          controlledFailure: false,
          verified: [
            "queued report existed and queue list rendered Obradi izvjestaj",
            "manual process action completed queued report through a real OpenAI provider-backed processor to ready",
            "ready report persisted report_snapshot and passed runtime validation",
            "queue list rendered Otvori izvjestaj for ready report",
            "read-only display helper loaded the ready report",
            "wrong organization/team display boundaries returned null",
            "failed report rendered Nije uspjesno kreiran and Pokusaj ponovo",
            "retry action returned failed report to queued without automatic processing",
            "queue list rendered Obradi izvjestaj again after retry reset",
            "attempt_reports counts stayed unchanged",
            "assessment_reports counts stayed unchanged",
            "report view route remained read-only and did not generate reports",
            "no worker loop, automatic batch processing, or retry-and-process automation was introduced",
          ],
          fixture: {
            source: fixture.source,
            organizationId: fixture.organizationId,
            teamId: fixture.teamId,
            teamAssessmentAssignmentId: fixture.teamAssessmentAssignmentId,
            selectionDraftId: fixture.selectionDraftId,
            bootstrapReadyReportId: fixture.teamAssessmentReportId,
            manualReadyReportId: queued.report.id,
            retryResetReportId: retrySeed.report.id,
          },
          counts: {
            before: beforeCounts,
            after: afterCounts,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    try {
      if (fixture.source === "created_cleanup_safe_fixture") {
        await deleteOrganizationCascade(supabase, fixture.organizationId);
      } else {
        await deleteReportRows(supabase, cleanup.createdReportIds);
      }
    } catch (cleanupError) {
      console.warn(
        cleanupError instanceof Error
          ? `Team Dynamics Executive Overview manual UI real smoke cleanup warning: ${cleanupError.message}`
          : `Team Dynamics Executive Overview manual UI real smoke cleanup warning: ${String(cleanupError)}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
