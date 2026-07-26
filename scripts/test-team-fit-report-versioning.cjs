const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const identityPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-fit-report-identity.ts",
);
const lifecyclePath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-fit-report-lifecycle.ts",
);
const migrationPath = path.join(
  projectRoot,
  "supabase",
  "migrations",
  "20260726100000_allow_team_fit_report_v2.sql",
);
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
  if (request === "server-only" || request === "@/lib/supabase/admin") {
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

const identitySource = fs.readFileSync(identityPath, "utf8");
const lifecycleSource = fs.readFileSync(lifecyclePath, "utf8");
const migrationSource = fs.readFileSync(migrationPath, "utf8");
const normalizedMigration = migrationSource.replace(/\s+/g, " ").trim();

const {
  TEAM_FIT_REPORT_V1_IDENTITY,
  TEAM_FIT_REPORT_V1_TYPE,
  TEAM_FIT_REPORT_V1_VERSION,
  TEAM_FIT_REPORT_V2_IDENTITY,
  TEAM_FIT_REPORT_V2_TYPE,
  TEAM_FIT_REPORT_V2_VERSION,
  isTeamFitReportIdentity,
  resolveTeamFitReportIdentity,
} = require(identityPath);
const {
  claimTeamFitReportForProcessing,
  markTeamFitReportProcessingFailed,
  resetFailedTeamFitReportToQueued,
} = require(lifecyclePath);

assert.strictEqual(
  resolveTeamFitReportIdentity(TEAM_FIT_REPORT_V1_TYPE, TEAM_FIT_REPORT_V1_VERSION),
  TEAM_FIT_REPORT_V1_IDENTITY,
);
assert.strictEqual(
  resolveTeamFitReportIdentity(TEAM_FIT_REPORT_V2_TYPE, TEAM_FIT_REPORT_V2_VERSION),
  TEAM_FIT_REPORT_V2_IDENTITY,
);
for (const [reportType, reportVersion] of [
  [TEAM_FIT_REPORT_V1_TYPE, TEAM_FIT_REPORT_V2_VERSION],
  [TEAM_FIT_REPORT_V2_TYPE, TEAM_FIT_REPORT_V1_VERSION],
  ["team_fit_report_unknown", TEAM_FIT_REPORT_V1_VERSION],
  [TEAM_FIT_REPORT_V1_TYPE, "unknown"],
  [null, undefined],
  [undefined, null],
  ["", ""],
  [1, 1],
]) {
  assert.equal(resolveTeamFitReportIdentity(reportType, reportVersion), null);
}
assert.equal(isTeamFitReportIdentity(TEAM_FIT_REPORT_V1_IDENTITY), true);
assert.equal(isTeamFitReportIdentity(TEAM_FIT_REPORT_V2_IDENTITY), true);
assert.equal(
  isTeamFitReportIdentity({
    reportType: TEAM_FIT_REPORT_V1_TYPE,
    reportVersion: TEAM_FIT_REPORT_V2_VERSION,
  }),
  false,
);
assert.equal(Object.isFrozen(TEAM_FIT_REPORT_V1_IDENTITY), true);
assert.equal(Object.isFrozen(TEAM_FIT_REPORT_V2_IDENTITY), true);

assert.match(migrationSource, /drop constraint if exists team_fit_reports_report_type_check/i);
assert.match(migrationSource, /drop constraint if exists team_fit_reports_report_version_check/i);
assert.match(migrationSource, /drop constraint if exists team_fit_reports_report_identity_check/i);
assert.match(migrationSource, /add constraint team_fit_reports_report_identity_check/i);
assert.ok(
  normalizedMigration.includes(
    "(report_type = 'team_fit_report_v1' and report_version = 'v1') or (report_type = 'team_fit_report_v2' and report_version = 'v2')",
  ),
);
assert.doesNotMatch(migrationSource, /\b(insert|update|delete|truncate)\b/i);
assert.doesNotMatch(migrationSource, /\b(create|drop)\s+table\b/i);
assert.doesNotMatch(migrationSource, /\b(add|drop)\s+column\b/i);
assert.doesNotMatch(migrationSource, /\b(create|drop)\s+(unique\s+)?index\b/i);
assert.doesNotMatch(migrationSource, /\b(unique|policy|row level security|trigger|rpc|repair)\b/i);

for (const source of [identitySource, lifecycleSource]) {
  assert.doesNotMatch(
    source,
    /team-fit-report-(?:input|processor|provider|display|list)|OpenAI|team-assessments|renderer|worker|scheduler/i,
  );
}
assert.doesNotMatch(identitySource, /process\.env|supabase|database/i);

function buildInvalidRow(reportType, reportVersion) {
  return {
    id: "report-invalid",
    organization_id: "org-1",
    team_id: "team-1",
    participant_id: "participant-1",
    candidate_source_type: "composite_deterministic_input_snapshot",
    candidate_source_id: null,
    team_source_type: "team_dynamics_aggregation_input_snapshot",
    team_source_id: null,
    optional_context: {},
    report_type: reportType,
    report_version: reportVersion,
    report_status: "queued",
    input_snapshot: null,
    report_snapshot: null,
    error_message: null,
    queued_at: "2026-07-26T10:00:00.000Z",
    started_at: null,
    completed_at: null,
    failed_at: null,
    created_by: null,
    created_at: "2026-07-26T10:00:00.000Z",
    updated_at: "2026-07-26T10:00:00.000Z",
  };
}

function createReadOnlyInvalidRowStub(row) {
  let updateCount = 0;
  return {
    get updateCount() {
      return updateCount;
    },
    from(table) {
      assert.equal(table, "team_fit_reports");
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        update() {
          updateCount += 1;
          return query;
        },
        async maybeSingle() {
          return { data: row, error: null };
        },
      };
      return query;
    },
  };
}

async function assertInvalidPersistedIdentity(reportType, reportVersion) {
  const row = buildInvalidRow(reportType, reportVersion);
  const before = structuredClone(row);
  const supabase = createReadOnlyInvalidRowStub(row);
  const input = { teamFitReportId: row.id, organizationId: row.organization_id };
  const results = [
    await claimTeamFitReportForProcessing(input, { supabase }),
    await markTeamFitReportProcessingFailed(
      { ...input, errorMessage: "MUST_NOT_WRITE" },
      { supabase },
    ),
    await resetFailedTeamFitReportToQueued(input, { supabase }),
  ];

  assert.deepEqual(
    results.map((result) => result.reason),
    ["not_claimable", "not_processing", "not_resettable"],
  );
  for (const result of results) {
    assert.equal(result.ok, false);
    assert.match(result.message, /Invalid Team Fit report identity/);
    assert.ok(result.message.includes(JSON.stringify(reportType)));
    assert.ok(result.message.includes(JSON.stringify(reportVersion)));
  }
  assert.equal(supabase.updateCount, 0);
  assert.deepEqual(row, before);
}

async function main() {
  await assertInvalidPersistedIdentity(
    TEAM_FIT_REPORT_V1_TYPE,
    TEAM_FIT_REPORT_V2_VERSION,
  );
  await assertInvalidPersistedIdentity("team_fit_report_unknown", "v9");
  console.log("test-team-fit-report-versioning: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
