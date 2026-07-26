const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const display = read("lib", "b2b", "team-fit-report-display.ts");
const list = read("lib", "b2b", "team-fit-report-list.ts");
const action = read("app", "actions", "team-assessments.ts");
const route = read("app", "(protected)", "dashboard", "teams", "[teamId]", "participants", "[participantId]", "team-fit-reports", "[teamFitReportId]", "page.tsx");
const listView = read("components", "dashboard", "team-fit-report-list.tsx");
const v1View = read("components", "dashboard", "team-fit-report-view.tsx");
const v2View = read("components", "dashboard", "team-fit-report-v2-view.tsx");

assert.match(display, /resolveTeamFitReportIdentity/);
assert.doesNotMatch(display, /\.eq\("report_type"/);
assert.doesNotMatch(display, /\.eq\("report_version"/);
assert.match(display, /validateTeamFitReportSnapshot/);
assert.match(display, /validateTeamFitReportV2/);
assert.doesNotMatch(display, /\.insert\(|\.update\(|\.delete\(|OpenAI|fetch\(/);

assert.match(list, /resolveTeamFitReportIdentity/);
assert.doesNotMatch(list, /\.eq\("report_type"/);
assert.doesNotMatch(list, /\.eq\("report_version"/);
assert.match(list, /canProcess: !legacyReadOnly && row\.report_status === "queued"/);
assert.match(list, /canRetry: !legacyReadOnly && row\.report_status === "failed"/);
assert.match(list, /canOpen: row\.report_status === "ready"/);
assert.match(list, /Legacy V1/);
assert.match(list, /Samo za pregled/);

assert.match(route, /TEAM_FIT_REPORT_V2_TYPE/);
assert.match(route, /TeamFitReportV2View/);
assert.match(route, /TeamFitReportView/);
assert.match(route, /record\.reportType === TEAM_FIT_REPORT_V2_TYPE/);

assert.match(action, /queueTeamFitReportV2Shell/);
assert.match(action, /processTeamFitReportV2WithProvider/);
assert.match(action, /generateTeamFitReportV2WithOpenAI/);
assert.doesNotMatch(action, /from "@\/lib\/b2b\/team-fit-report-processor"/);
assert.match(action, /Postojeći V1 Team Fit izvještaj dostupan je samo za pregled/);

assert.match(listView, /entry\.canProcess/);
assert.match(listView, /entry\.canRetry/);
assert.match(listView, /entry\.canOpen/);
assert.doesNotMatch(listView, /entry\.status === "queued" \? \(\s*<TeamFitReportProcessAction/);
assert.match(v1View, /TeamFitReportV1DisplayRecord/);
assert.match(v2View, /TeamFitReportV2DisplayRecord/);

for (const source of [action, display, list, route, listView, v1View, v2View]) {
  assert.doesNotMatch(source, /scheduler|cron|mass regeneration|migration up|migration apply|delete from team_fit_reports/i);
}

console.log("test-team-fit-v2-active-cutover: ok");
