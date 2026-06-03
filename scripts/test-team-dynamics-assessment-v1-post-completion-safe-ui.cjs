const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const introRoutePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "app",
  "team-assessments",
  "[teamAssessmentParticipantId]",
  "page.tsx",
);
const runRoutePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "app",
  "team-assessments",
  "[teamAssessmentParticipantId]",
  "run",
  "page.tsx",
);
const detailHelperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-assessment-detail.ts",
);
const detailComponentPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "hr-team-assessment-detail.tsx",
);

const introSource = fs.readFileSync(introRoutePath, "utf8");
const runSource = fs.readFileSync(runRoutePath, "utf8");
const detailHelperSource = fs.readFileSync(detailHelperPath, "utf8");
const detailComponentSource = fs.readFileSync(detailComponentPath, "utf8");

assert.match(introSource, /TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG/);
assert.match(introSource, /shellState\.kind === "intro_completed"/);
assert.match(introSource, /Odgovori su spremljeni i procjena je oznacena kao zavrsena\./);
assert.match(introSource, /Izvjestaji i[\s\S]*dalja obrada bice omoguceni kroz zaseban korak\./);
assert.doesNotMatch(introSource, /Započni procjenu/);
assert.doesNotMatch(introSource, /Nastavi procjenu/);
assert.doesNotMatch(introSource, /attemptId/);
assert.doesNotMatch(introSource, /assessment_reports/);

assert.match(runSource, /shouldRenderActiveMixedRuntimePreview/);
assert.match(runSource, /isMixedRuntimePreview && handoff\.isRunnableShellState/);
assert.match(runSource, /Ovaj wrapper je u sigurnom post-completion ili unavailable stanju\./);
assert.match(runSource, /Aktivni run više nije dostupan za ovaj wrapper i pitanja se više ne prikazuju\./);
assert.match(runSource, /Odgovori su spremljeni i procjena je oznacena kao zavrsena\./);
assert.match(runSource, /Izvjestaji i[\s\S]*dalja obrada bice omoguceni kroz zaseban korak\./);
assert.doesNotMatch(runSource, /attemptId/);
assert.doesNotMatch(runSource, /assessment_reports/);
assert.doesNotMatch(runSource, /AssessmentForm/);

assert.match(detailHelperSource, /TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG/);
assert.match(detailHelperSource, /\.in\("package_slug", \[/);
assert.match(detailComponentSource, /Završen/);
assert.match(detailComponentSource, /completedCount/);
assert.doesNotMatch(detailComponentSource, /Pogledaj izvještaj/);
assert.doesNotMatch(detailComponentSource, /score/i);
assert.doesNotMatch(detailComponentSource, /Team Fit/);
assert.doesNotMatch(detailComponentSource, /attemptId/);

console.log("test-team-dynamics-assessment-v1-post-completion-safe-ui: ok");
