const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const pagePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "teams",
  "page.tsx",
);
const detailPagePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "teams",
  "[teamId]",
  "page.tsx",
);
const componentPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "hr-teams-table.tsx",
);
const detailComponentPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "hr-team-assessment-detail.tsx",
);

assert.equal(fs.existsSync(pagePath), true, "Expected /dashboard/teams page to exist.");
assert.equal(fs.existsSync(detailPagePath), true, "Expected /dashboard/teams/[teamId] page to exist.");
assert.equal(fs.existsSync(componentPath), true, "Expected HR teams table component to exist.");
assert.equal(
  fs.existsSync(detailComponentPath),
  true,
  "Expected HR team assessment detail component to exist.",
);

const pageSource = fs.readFileSync(pagePath, "utf8");
const detailPageSource = fs.readFileSync(detailPagePath, "utf8");
const componentSource = fs.readFileSync(componentPath, "utf8");
const detailComponentSource = fs.readFileSync(detailComponentPath, "utf8");

assert.match(pageSource, /requireAuthenticatedUser\(\)/);
assert.match(pageSource, /getActiveOrganizationForUser\(user\.id\)/);
assert.match(pageSource, /getTeamsForOrganization\(organization\.id\)/);
assert.match(pageSource, /PageNavigation/);
assert.match(pageSource, /title="Timovi"/);
assert.doesNotMatch(pageSource, /getAttemptsForOrganization/);
assert.doesNotMatch(pageSource, /getHrAttemptReports/);
assert.doesNotMatch(pageSource, /assessment_reports/);

assert.match(componentSource, /createTeamDynamicsAssessmentAction/);
assert.match(componentSource, /useFormState/);
assert.match(componentSource, /team-dynamics-action-contract/);
assert.match(componentSource, /name="teamId"/);
assert.match(componentSource, /Pokreni procjenu timske dinamike/);
assert.match(componentSource, /href=\{`\/dashboard\/teams\/\$\{team\.teamId\}`\}/);
assert.match(componentSource, /Otvori admin detalje/);
assert.match(componentSource, /Aktivna procjena/);
assert.doesNotMatch(componentSource, /Kreiraj tim/);
assert.doesNotMatch(componentSource, /Uredi tim/);
assert.doesNotMatch(componentSource, /Dodaj člana/);
assert.doesNotMatch(componentSource, /Ukloni člana/);
assert.doesNotMatch(componentSource, /member score/i);
assert.doesNotMatch(componentSource, /attempt_reports/);
assert.doesNotMatch(componentSource, /assessment_reports/);
assert.doesNotMatch(componentSource, /Pogledaj izvještaj/);

assert.match(detailPageSource, /getTeamAssessmentDetailForOrganization/);
assert.match(detailPageSource, /notFound\(\)/);
assert.match(detailPageSource, /HrTeamAssessmentDetail/);

assert.match(detailComponentSource, /Nazad na timove/);
assert.match(detailComponentSource, /Ovaj admin pregled prikazuje samo status procjene na nivou tima/);
assert.match(detailComponentSource, /Članovi u procjeni/);
assert.doesNotMatch(detailComponentSource, /Pogledaj izvještaj/);
assert.doesNotMatch(detailComponentSource, /individualn(?:e|ih) rezultat/i);
assert.doesNotMatch(detailComponentSource, /attemptId/);
assert.doesNotMatch(detailComponentSource, /raw response/i);
assert.doesNotMatch(detailComponentSource, /score/i);
assert.doesNotMatch(detailComponentSource, /OpenAI|AI provider|generator_type|report_snapshot/);

console.log("Team Dynamics teams UI skeleton tests passed.");
