const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const nextLinkStubPath = path.join(__dirname, "next-link-stub.cjs");
const retryActionStubPath = path.join(__dirname, "team-fit-retry-action-stub.cjs");
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

  if (request === "next/link") {
    return nextLinkStubPath;
  }

  if (request === "@/components/dashboard/team-fit-report-retry-action") {
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

require.cache[retryActionStubPath] = {
  id: retryActionStubPath,
  filename: retryActionStubPath,
  loaded: true,
  exports: {
    TeamFitReportRetryAction({ teamFitReportId, teamId, participantId }) {
      return React.createElement(
        "button",
        {
          type: "button",
          "data-team-fit-retry-report-id": teamFitReportId,
          "data-team-id": teamId,
          "data-participant-id": participantId,
        },
        "Pokušaj ponovo",
      );
    },
  },
};

const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
const {
  queueTeamFitReportShell,
  claimTeamFitReportForProcessing,
  markTeamFitReportProcessingFailed,
  resetFailedTeamFitReportToQueued,
} = require("../lib/b2b/team-fit-report-lifecycle.ts");
const { processTeamFitReportWithMock } = require("../lib/b2b/team-fit-report-processor.ts");
const { loadTeamFitReportDisplayRecord } = require("../lib/b2b/team-fit-report-display.ts");
const { listTeamFitReportEntries } = require("../lib/b2b/team-fit-report-list.ts");
const { validateTeamFitReportSnapshot } = require("../lib/b2b/team-fit-report-contract.ts");
const { TeamFitReportList } = require("../components/dashboard/team-fit-report-list.tsx");

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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

async function deleteOrganization(supabase, organizationId) {
  if (!isNonEmptyString(organizationId)) {
    return;
  }

  const { error } = await supabase.from("organizations").delete().eq("id", organizationId);

  if (error) {
    throw new Error(`Failed to cleanup organization ${organizationId}: ${error.message}`);
  }
}

async function countAssessmentReportsForOrganization(supabase, organizationId) {
  const { count, error } = await supabase
    .from("assessment_reports")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(`Failed to count assessment_reports: ${error.message}`);
  }

  return count ?? 0;
}

async function loadAttemptIdsForParticipant(supabase, participantId) {
  const { data, error } = await supabase
    .from("attempts")
    .select("id")
    .eq("participant_id", participantId);

  if (error) {
    throw new Error(`Failed to load attempts for participant: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id);
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
    throw new Error(`Failed to count attempt_reports: ${error.message}`);
  }

  return count ?? 0;
}

async function loadReportRow(supabase, reportId) {
  const { data, error } = await supabase
    .from("team_fit_reports")
    .select("id, report_status, report_snapshot, error_message")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Fit report row ${reportId}: ${error.message}`);
  }

  return data ?? null;
}

async function main() {
  const supabase = createSupabaseAdminClient();
  const token = crypto.randomUUID().slice(0, 8);
  const organizationSlug = `team-fit-db-smoke-${token}`;
  const createdIds = {
    organizationId: null,
    teamId: null,
    participantId: null,
    reportIds: [],
  };

  try {
    const { data: organizationRows, error: organizationError } = await supabase
      .from("organizations")
      .insert({
        name: `Team Fit DB Smoke ${token}`,
        slug: organizationSlug,
        status: "active",
      })
      .select("id, name")
      .limit(1);

    if (organizationError || !organizationRows?.[0]?.id) {
      throw new Error(
        `Failed to create Team Fit smoke organization: ${organizationError?.message ?? "unknown error"}`,
      );
    }

    createdIds.organizationId = organizationRows[0].id;

    const { data: teamRows, error: teamError } = await supabase
      .from("teams")
      .insert({
        organization_id: createdIds.organizationId,
        name: `Team Fit Smoke Team ${token}`,
        description: "Cleanup-safe Team Fit DB smoke fixture",
        created_by_user_id: null,
      })
      .select("id, name")
      .limit(1);

    if (teamError || !teamRows?.[0]?.id) {
      throw new Error(
        `Failed to create Team Fit smoke team: ${teamError?.message ?? "unknown error"}`,
      );
    }

    createdIds.teamId = teamRows[0].id;

    const { data: participantRows, error: participantError } = await supabase
      .from("participants")
      .insert({
        organization_id: createdIds.organizationId,
        user_id: null,
        email: `team-fit-smoke-${token}@example.test`,
        full_name: `Team Fit Smoke Candidate ${token}`,
        participant_type: "candidate",
        status: "active",
      })
      .select("id, full_name")
      .limit(1);

    if (participantError || !participantRows?.[0]?.id) {
      throw new Error(
        `Failed to create Team Fit smoke participant: ${participantError?.message ?? "unknown error"}`,
      );
    }

    createdIds.participantId = participantRows[0].id;

    const queued = await queueTeamFitReportShell(
      {
        organizationId: createdIds.organizationId,
        teamId: createdIds.teamId,
        participantId: createdIds.participantId,
        candidateSourceType: "composite_deterministic_input_snapshot",
        candidateSourceId: crypto.randomUUID(),
        teamSourceType: "team_dynamics_aggregation_input_snapshot",
        teamSourceId: crypto.randomUUID(),
        optionalContext: { locale: "bs" },
        createdBy: null,
      },
      {
        supabase,
        now: () => "2026-05-30T12:00:00.000Z",
      },
    );

    if (!queued.ok) {
      throw new Error(queued.message);
    }
    assert.equal(queued.ok, true);

    createdIds.reportIds.push(queued.reportId);

    const processed = await processTeamFitReportWithMock(
      {
        teamFitReportId: queued.reportId,
        organizationId: createdIds.organizationId,
      },
      {
        supabase,
        now: () => "2026-05-30T12:30:00.000Z",
      },
    );

    assert.deepEqual(processed, {
      ok: true,
      reportId: queued.reportId,
      status: "ready",
    });

    const readyRow = await loadReportRow(supabase, queued.reportId);
    assert.equal(readyRow?.report_status, "ready");
    assert.equal(typeof readyRow?.error_message, "object");

    const validation = validateTeamFitReportSnapshot(readyRow?.report_snapshot ?? null);
    assert.equal(validation.ok, true);

    const readyDisplay = await loadTeamFitReportDisplayRecord(
      {
        organizationId: createdIds.organizationId,
        teamId: createdIds.teamId,
        participantId: createdIds.participantId,
        teamFitReportId: queued.reportId,
      },
      { supabase },
    );

    assert.equal(readyDisplay?.status, "ready");
    assert.equal(readyDisplay?.teamId, createdIds.teamId);
    assert.equal(readyDisplay?.participantId, createdIds.participantId);
    assert.equal(readyDisplay?.reportSnapshot?.reportType, "team_fit_report_v1");

    const listEntries = await listTeamFitReportEntries(
      {
        organizationId: createdIds.organizationId,
        participantId: createdIds.participantId,
      },
      { supabase },
    );

    assert.equal(listEntries.length, 1);
    assert.equal(listEntries[0].status, "ready");
    assert.equal(
      listEntries[0].href,
      `/dashboard/teams/${createdIds.teamId}/participants/${createdIds.participantId}/team-fit-reports/${queued.reportId}`,
    );

    const wrongOrgDisplay = await loadTeamFitReportDisplayRecord(
      {
        organizationId: crypto.randomUUID(),
        teamId: createdIds.teamId,
        participantId: createdIds.participantId,
        teamFitReportId: queued.reportId,
      },
      { supabase },
    );
    assert.equal(wrongOrgDisplay, null);

    const wrongTeamDisplay = await loadTeamFitReportDisplayRecord(
      {
        organizationId: createdIds.organizationId,
        teamId: crypto.randomUUID(),
        participantId: createdIds.participantId,
        teamFitReportId: queued.reportId,
      },
      { supabase },
    );
    assert.equal(wrongTeamDisplay, null);

    const wrongParticipantDisplay = await loadTeamFitReportDisplayRecord(
      {
        organizationId: createdIds.organizationId,
        teamId: createdIds.teamId,
        participantId: crypto.randomUUID(),
        teamFitReportId: queued.reportId,
      },
      { supabase },
    );
    assert.equal(wrongParticipantDisplay, null);

    const wrongOrgList = await listTeamFitReportEntries(
      {
        organizationId: crypto.randomUUID(),
        participantId: createdIds.participantId,
      },
      { supabase },
    );
    assert.deepEqual(wrongOrgList, []);

    const wrongTeamList = await listTeamFitReportEntries(
      {
        organizationId: createdIds.organizationId,
        participantId: createdIds.participantId,
        teamId: crypto.randomUUID(),
      },
      { supabase },
    );
    assert.deepEqual(wrongTeamList, []);

    const wrongParticipantList = await listTeamFitReportEntries(
      {
        organizationId: createdIds.organizationId,
        participantId: crypto.randomUUID(),
      },
      { supabase },
    );
    assert.deepEqual(wrongParticipantList, []);

    const failedQueued = await queueTeamFitReportShell(
      {
        organizationId: createdIds.organizationId,
        teamId: createdIds.teamId,
        participantId: createdIds.participantId,
        candidateSourceType: "composite_deterministic_input_snapshot",
        candidateSourceId: crypto.randomUUID(),
        teamSourceType: "team_dynamics_aggregation_input_snapshot",
        teamSourceId: crypto.randomUUID(),
        optionalContext: { locale: "bs" },
        createdBy: null,
      },
      {
        supabase,
        now: () => "2026-05-30T13:00:00.000Z",
      },
    );

    if (!failedQueued.ok) {
      throw new Error(failedQueued.message);
    }
    assert.equal(failedQueued.ok, true);

    createdIds.reportIds.push(failedQueued.reportId);

    const claimed = await claimTeamFitReportForProcessing(
      {
        teamFitReportId: failedQueued.reportId,
        organizationId: createdIds.organizationId,
      },
      {
        supabase,
        now: () => "2026-05-30T13:05:00.000Z",
      },
    );

    if (!claimed.ok) {
      throw new Error(claimed.message);
    }
    assert.equal(claimed.ok, true);

    const failed = await markTeamFitReportProcessingFailed(
      {
        teamFitReportId: failedQueued.reportId,
        organizationId: createdIds.organizationId,
        errorMessage: "TEAM_FIT_PROVIDER_REQUEST_FAILED: raw backend 500 details",
      },
      {
        supabase,
        now: () => "2026-05-30T13:10:00.000Z",
      },
    );

    if (!failed.ok) {
      throw new Error(failed.message);
    }
    assert.equal(failed.ok, true);

    const failedDisplay = await loadTeamFitReportDisplayRecord(
      {
        organizationId: createdIds.organizationId,
        teamId: createdIds.teamId,
        participantId: createdIds.participantId,
        teamFitReportId: failedQueued.reportId,
      },
      { supabase },
    );

    assert.equal(failedDisplay?.status, "failed");
    assert.equal(failedDisplay?.safeStatusMessage, "Izvještaj trenutno nije uspješno kreiran.");

    const failedListEntries = await listTeamFitReportEntries(
      {
        organizationId: createdIds.organizationId,
        participantId: createdIds.participantId,
        teamId: createdIds.teamId,
      },
      { supabase },
    );

    const failedListEntry = failedListEntries.find((entry) => entry.id === failedQueued.reportId);
    assert.ok(failedListEntry);
    assert.equal(failedListEntry?.status, "failed");
    assert.equal(
      failedListEntry?.safeStatusMessage,
      "Izvještaj nije pripremljen. Možeš ga vratiti u red za pripremu.",
    );

    const failedHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(TeamFitReportList, { entries: [failedListEntry] }),
    );
    assert.doesNotMatch(failedHtml, /TEAM_FIT_PROVIDER_REQUEST_FAILED|raw backend 500 details|error_message/i);
    assert.match(
      failedHtml,
      /Izvještaj nije pripremljen\. Možeš ga vratiti u red za pripremu\./,
    );

    const reset = await resetFailedTeamFitReportToQueued(
      {
        teamFitReportId: failedQueued.reportId,
        organizationId: createdIds.organizationId,
      },
      {
        supabase,
        now: () => "2026-05-30T13:15:00.000Z",
      },
    );

    if (!reset.ok) {
      throw new Error(reset.message);
    }
    assert.equal(reset.ok, true);
    assert.equal(reset.report.reportStatus, "queued");

    const reprocessed = await processTeamFitReportWithMock(
      {
        teamFitReportId: failedQueued.reportId,
        organizationId: createdIds.organizationId,
      },
      {
        supabase,
        now: () => "2026-05-30T13:30:00.000Z",
      },
    );

    assert.deepEqual(reprocessed, {
      ok: true,
      reportId: failedQueued.reportId,
      status: "ready",
    });

    const recoveredRow = await loadReportRow(supabase, failedQueued.reportId);
    assert.equal(recoveredRow?.report_status, "ready");
    assert.equal(typeof recoveredRow?.error_message, "object");

    const recoveredValidation = validateTeamFitReportSnapshot(
      recoveredRow?.report_snapshot ?? null,
    );
    assert.equal(recoveredValidation.ok, true);

    const attemptIds = await loadAttemptIdsForParticipant(supabase, createdIds.participantId);
    const attemptReportCount = await countAttemptReportsForAttempts(supabase, attemptIds);
    const assessmentReportCount = await countAssessmentReportsForOrganization(
      supabase,
      createdIds.organizationId,
    );

    assert.equal(attemptIds.length, 0);
    assert.equal(attemptReportCount, 0);
    assert.equal(assessmentReportCount, 0);
  } finally {
    try {
      await deleteByIds(supabase, "team_fit_reports", createdIds.reportIds);
      await deleteByIds(
        supabase,
        "teams",
        createdIds.teamId ? [createdIds.teamId] : [],
      );
      await deleteByIds(
        supabase,
        "participants",
        createdIds.participantId ? [createdIds.participantId] : [],
      );
      await deleteOrganization(supabase, createdIds.organizationId);
    } catch (cleanupError) {
      console.warn(
        cleanupError instanceof Error
          ? `Team Fit DB smoke cleanup warning: ${cleanupError.message}`
          : `Team Fit DB smoke cleanup warning: ${String(cleanupError)}`,
      );
    }
  }
}

main()
  .then(() => {
    console.log("test-team-fit-report-db-smoke: ok");
  })
  .catch((error) => {
    console.error(
      error instanceof Error
        ? `test-team-fit-report-db-smoke: failed: ${error.stack ?? error.message}`
        : `test-team-fit-report-db-smoke: failed: ${String(error)}`,
    );
    process.exitCode = 1;
  });
