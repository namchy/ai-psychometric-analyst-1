const assert = require("node:assert/strict");
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

function isSchemaCacheMiss(error) {
  return Boolean(error && SCHEMA_CACHE_MISS_CODES.has(error.code ?? ""));
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

async function deleteReportRows(supabase, reportIds) {
  if (reportIds.length === 0) {
    return;
  }

  const { error } = await supabase.from("team_assessment_reports").delete().in("id", reportIds);

  if (error) {
    throw new Error(`Failed to cleanup Team Dynamics report rows: ${error.message}`);
  }
}

async function deleteSelectionDraft(supabase, selectionDraftId) {
  const { error: deleteMembersError } = await supabase
    .from("team_assessment_report_selection_members")
    .delete()
    .eq("selection_draft_id", selectionDraftId);

  if (deleteMembersError) {
    throw new Error(
      `Failed to cleanup Team Dynamics selection members for draft ${selectionDraftId}: ${deleteMembersError.message}`,
    );
  }

  const { error: deleteDraftError } = await supabase
    .from("team_assessment_report_selection_drafts")
    .delete()
    .eq("id", selectionDraftId);

  if (deleteDraftError) {
    throw new Error(
      `Failed to cleanup Team Dynamics selection draft ${selectionDraftId}: ${deleteDraftError.message}`,
    );
  }
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
    ensureTeamDynamicsAssessmentV1SmokeFixture,
  } = require("./create-team-dynamics-assessment-v1-smoke-fixture.cjs");
  const {
    loadTeamDynamicsReportSelectionInclusionState,
    replaceTeamDynamicsReportSelectionInclusionSet,
  } = require("../lib/b2b/team-dynamics-report-selection-inclusion.ts");
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

  const fixture = await ensureTeamDynamicsAssessmentV1SmokeFixture();
  const attemptIds = await loadAssignmentAttemptIds(supabase, fixture.assignment.id);
  const initialSelectionState = await loadTeamDynamicsReportSelectionInclusionState({
    organizationId: fixture.organization.id,
    teamId: fixture.team.id,
    teamAssessmentAssignmentId: fixture.assignment.id,
  });
  const includedParticipantIds = await loadAssignmentParticipantIds(
    supabase,
    fixture.assignment.id,
  );

  const cleanup = {
    createdReportIds: [],
    createdSelectionDraftId: null,
  };

  const beforeCounts = {
    attemptReportsForFixtureAttempts: await countAttemptReportsForAttempts(supabase, attemptIds),
    assessmentReportsForFixtureOrganization: await countAssessmentReportsForOrganization(
      supabase,
      fixture.organization.id,
    ),
  };

  try {
    assert.ok(
      includedParticipantIds.length > 0,
      "Expected at least one Team Dynamics assignment participant in the smoke fixture.",
    );

    const savedSelection = await replaceTeamDynamicsReportSelectionInclusionSet({
      organizationId: fixture.organization.id,
      teamId: fixture.team.id,
      teamAssessmentAssignmentId: fixture.assignment.id,
      includedTeamAssessmentParticipantIds: includedParticipantIds,
      actorUserId: null,
    });

    if (!initialSelectionState.hasPersistedSelectionDraft) {
      cleanup.createdSelectionDraftId = savedSelection.selectionDraftId;
    }

    const reloadedSelection = await loadTeamDynamicsReportSelectionInclusionState({
      organizationId: fixture.organization.id,
      teamId: fixture.team.id,
      teamAssessmentAssignmentId: fixture.assignment.id,
    });

    assert.equal(reloadedSelection.hasPersistedSelectionDraft, true);
    assert.equal(reloadedSelection.selectionDraftId, savedSelection.selectionDraftId);
    assert.deepEqual(
      reloadedSelection.includedTeamAssessmentParticipantIds,
      [...includedParticipantIds].sort(),
    );

    const queued = await queueTeamDynamicsReportShell({
      organizationId: fixture.organization.id,
      teamId: fixture.team.id,
      teamAssessmentAssignmentId: fixture.assignment.id,
      selectionDraftId: savedSelection.selectionDraftId,
    });

    assert.equal(queued.ok, true, queued.ok ? "" : queued.reason);

    cleanup.createdReportIds.push(queued.report.id);

    assert.equal(queued.report.reportType, TEAM_DYNAMICS_REPORT_TYPE);
    assert.equal(queued.report.reportVersion, TEAM_DYNAMICS_REPORT_VERSION);
    assert.deepEqual(queued.report.includedMemberIdsSnapshot, [...includedParticipantIds].sort());

    const processed = await processTeamDynamicsExecutiveOverviewMock({
      organizationId: fixture.organization.id,
      teamAssessmentReportId: queued.report.id,
    });

    assert.equal(processed.ok, true, processed.ok ? "" : processed.reason);
    assert.equal(processed.finalStatus, "ready");
    assert.equal(processed.report.reportStatus, "ready");
    assert.ok(processed.report.inputSnapshot);
    assert.ok(processed.report.reportSnapshot);

    const validation = validateTeamDynamicsExecutiveOverviewSnapshot(
      processed.report.reportSnapshot,
    );
    assert.equal(validation.ok, true, validation.ok ? "" : validation.errors.join("; "));

    const displayReady = await loadTeamDynamicsExecutiveOverviewReportForDisplay({
      organizationId: fixture.organization.id,
      teamId: fixture.team.id,
      teamAssessmentReportId: queued.report.id,
    });

    assert.ok(displayReady);
    assert.equal(displayReady.status, "ready");
    assert.equal(displayReady.report.id, queued.report.id);
    assert.equal(displayReady.snapshot.reportType, "team_dynamics_executive_overview_v1");

    const wrongOrganization = await loadTeamDynamicsExecutiveOverviewReportForDisplay({
      organizationId: "00000000-0000-0000-0000-000000000000",
      teamId: fixture.team.id,
      teamAssessmentReportId: queued.report.id,
    });
    const wrongTeam = await loadTeamDynamicsExecutiveOverviewReportForDisplay({
      organizationId: fixture.organization.id,
      teamId: "00000000-0000-0000-0000-000000000000",
      teamAssessmentReportId: queued.report.id,
    });

    assert.equal(wrongOrganization, null);
    assert.equal(wrongTeam, null);

    const afterCounts = {
      attemptReportsForFixtureAttempts: await countAttemptReportsForAttempts(supabase, attemptIds),
      assessmentReportsForFixtureOrganization: await countAssessmentReportsForOrganization(
        supabase,
        fixture.organization.id,
      ),
    };

    assert.deepEqual(afterCounts, beforeCounts);

    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: false,
          verified: [
            "saved selection was created or updated through the existing selection inclusion helper",
            "queued team_assessment_reports row persisted with report_type, report_version, and included_member_ids_snapshot",
            "mock-safe processor completed queued -> processing -> ready and persisted input_snapshot + report_snapshot",
            "report_snapshot passed validateTeamDynamicsExecutiveOverviewSnapshot(...)",
            "display helper loaded the ready report within organizationId + teamId + reportId bounds",
            "wrong organization/team boundaries returned null",
            "attempt_reports row count for fixture attempts stayed unchanged",
            "assessment_reports row count for fixture organization stayed unchanged",
          ],
          fixture: {
            organizationId: fixture.organization.id,
            teamId: fixture.team.id,
            teamAssessmentAssignmentId: fixture.assignment.id,
            selectionDraftId: reloadedSelection.selectionDraftId,
            teamAssessmentReportId: queued.report.id,
            includedMemberCount: includedParticipantIds.length,
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
  } finally {
    try {
      await deleteReportRows(supabase, cleanup.createdReportIds);

      if (initialSelectionState.hasPersistedSelectionDraft && initialSelectionState.selectionDraftId) {
        await replaceTeamDynamicsReportSelectionInclusionSet({
          organizationId: fixture.organization.id,
          teamId: fixture.team.id,
          teamAssessmentAssignmentId: fixture.assignment.id,
          includedTeamAssessmentParticipantIds:
            initialSelectionState.includedTeamAssessmentParticipantIds,
          actorUserId: null,
        });
      } else if (cleanup.createdSelectionDraftId) {
        await deleteSelectionDraft(supabase, cleanup.createdSelectionDraftId);
      }
    } catch (cleanupError) {
      console.warn(
        cleanupError instanceof Error
          ? `Team Dynamics Executive Overview local lane smoke cleanup warning: ${cleanupError.message}`
          : `Team Dynamics Executive Overview local lane smoke cleanup warning: ${String(cleanupError)}`,
      );
    }
  }
}

main().catch((error) => {
  if (isSchemaCacheMiss(error)) {
    console.log(
      JSON.stringify(
        buildSkipResult("Runtime Supabase schema cache does not expose the required Team Dynamics report lane tables.", {
          runtimeError: {
            code: error.code ?? null,
            message: error.message,
          },
        }),
        null,
        2,
      ),
    );
    return;
  }

  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
