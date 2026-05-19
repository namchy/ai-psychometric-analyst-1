const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const dashboardPath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "page.tsx",
);
const teamsPagePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "teams",
  "page.tsx",
);

const dashboardSource = fs.readFileSync(dashboardPath, "utf8");
const teamsPageSource = fs.readFileSync(teamsPagePath, "utf8");

assert.match(dashboardSource, /href="\/dashboard\/teams"/);
assert.match(
  dashboardSource,
  /title=\{<span id="teams-entry-heading">Timovi<\/span>\}/,
);
assert.match(
  dashboardSource,
  /Pregled timova i procjena timske dinamike kroz agregirani timski uvid\./,
);
assert.match(dashboardSource, />\s*Otvori timove\s*</);

assert.doesNotMatch(dashboardSource, /Kreiraj tim/);
assert.doesNotMatch(dashboardSource, /Uredi tim/);
assert.doesNotMatch(dashboardSource, /Dodaj člana/);
assert.doesNotMatch(dashboardSource, /Ukloni člana/);
assert.doesNotMatch(dashboardSource, /individualn(?:e|ih) rezultat/i);
assert.doesNotMatch(dashboardSource, /assessment_reports/);
assert.doesNotMatch(dashboardSource, /attempt_reports/);

assert.match(teamsPageSource, /title="Timovi"/);

console.log("Team Dynamics dashboard entry tests passed.");
