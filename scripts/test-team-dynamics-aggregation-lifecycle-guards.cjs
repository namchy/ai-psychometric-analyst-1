const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function walkFiles(rootDir, predicate, matches = []) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, matches);
      continue;
    }

    if (predicate(fullPath)) {
      matches.push(fullPath);
    }
  }

  return matches;
}

const persistenceSource = read("lib/assessment/team-assessment-aggregation-persistence.ts");
const readSource = read("lib/assessment/team-assessment-aggregation-read.ts");
const lifecycleSource = read("lib/assessment/team-assessment-aggregation-lifecycle.ts");
const actionSource = read("app/actions/team-assessments.ts");
const reportOrchestrationSource = read("lib/assessment/report-orchestration.ts");

assert.match(persistenceSource, /loadTeamAssessmentAggregationDraft/);
assert.match(
  persistenceSource,
  /TEAM_ASSESSMENT_AGGREGATION_ALLOWED_STATUSES = \[\s*"ready",\s*"not_ready",\s*"stale",\s*"failed"/,
);
assert.doesNotMatch(persistenceSource, /\.from\("responses"\)/);
assert.doesNotMatch(persistenceSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(persistenceSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(persistenceSource, /\.from\("team_assessment_participant_scores"\)\.update/);
assert.doesNotMatch(persistenceSource, /\.from\("team_assessment_participant_scores"\)\.insert/);

assert.doesNotMatch(readSource, /loadTeamAssessmentAggregationDraft/);
assert.doesNotMatch(readSource, /persistTeamAssessmentAggregationSnapshot/);
assert.match(readSource, /TEAM_ASSESSMENT_AGGREGATION_VERSION/);
assert.match(readSource, /verificationStatus: "missing"/);
assert.match(readSource, /aggregation_snapshot_not_found/);

assert.match(lifecycleSource, /loadTeamAssessmentAggregationDraft/);
assert.match(lifecycleSource, /persistTeamAssessmentAggregationSnapshot/);
assert.match(lifecycleSource, /loadTeamAssessmentAggregationVerification/);
assert.doesNotMatch(lifecycleSource, /\.from\("responses"\)/);
assert.doesNotMatch(lifecycleSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(lifecycleSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(lifecycleSource, /\.from\("team_assessment_participant_scores"\)\.update/);
assert.doesNotMatch(lifecycleSource, /\.from\("team_assessment_participant_scores"\)\.insert/);

assert.doesNotMatch(actionSource, /persistTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(actionSource, /loadTeamAssessmentAggregationDraft/);
assert.doesNotMatch(actionSource, /loadTeamAssessmentAggregationVerification/);
assert.doesNotMatch(actionSource, /TEAM_ASSESSMENT_AGGREGATION_VERSION/);
assert.doesNotMatch(actionSource, /refreshTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(actionSource, /team-assessment-aggregation-lifecycle/);

assert.doesNotMatch(reportOrchestrationSource, /persistTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(reportOrchestrationSource, /loadTeamAssessmentAggregationDraft/);
assert.doesNotMatch(reportOrchestrationSource, /loadTeamAssessmentAggregationVerification/);
assert.doesNotMatch(reportOrchestrationSource, /team_assessment_aggregation_snapshots/);
assert.doesNotMatch(reportOrchestrationSource, /refreshTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(reportOrchestrationSource, /team-assessment-aggregation-lifecycle/);

const uiSourceFiles = walkFiles(
  path.join(projectRoot, "app"),
  (fullPath) => /\.(ts|tsx)$/.test(fullPath),
).concat(
  walkFiles(path.join(projectRoot, "components"), (fullPath) => /\.(ts|tsx)$/.test(fullPath)),
);

for (const fullPath of uiSourceFiles) {
  const source = fs.readFileSync(fullPath, "utf8");
  assert.doesNotMatch(
    source,
    /team-assessment-aggregation-persistence|persistTeamAssessmentAggregationSnapshot/,
    `Unexpected aggregation persistence usage in ${path.relative(projectRoot, fullPath)}`,
  );
  assert.doesNotMatch(
    source,
    /team-assessment-aggregation-read|loadTeamAssessmentAggregationVerification/,
    `Unexpected aggregation read usage in ${path.relative(projectRoot, fullPath)}`,
  );
  assert.doesNotMatch(
    source,
    /team-assessment-aggregation-lifecycle|refreshTeamAssessmentAggregationSnapshot/,
    `Unexpected aggregation lifecycle usage in ${path.relative(projectRoot, fullPath)}`,
  );
}

console.log("test-team-dynamics-aggregation-lifecycle-guards: ok");
