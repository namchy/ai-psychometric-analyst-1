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
const componentPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "hr-teams-table.tsx",
);

assert.equal(fs.existsSync(pagePath), true, "Expected /dashboard/teams page to exist.");
assert.equal(fs.existsSync(componentPath), true, "Expected HR teams table component to exist.");

const pageSource = fs.readFileSync(pagePath, "utf8");
const componentSource = fs.readFileSync(componentPath, "utf8");

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
assert.match(componentSource, /Aktivna procjena/);
assert.doesNotMatch(componentSource, /Kreiraj tim/);
assert.doesNotMatch(componentSource, /Uredi tim/);
assert.doesNotMatch(componentSource, /Dodaj člana/);
assert.doesNotMatch(componentSource, /Ukloni člana/);
assert.doesNotMatch(componentSource, /member score/i);
assert.doesNotMatch(componentSource, /attempt_reports/);
assert.doesNotMatch(componentSource, /assessment_reports/);

console.log("Team Dynamics teams UI skeleton tests passed.");
