const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const routePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "app",
  "team-assessments",
  "[teamAssessmentParticipantId]",
  "page.tsx",
);

assert.equal(fs.existsSync(routePath), true, "Expected Team Dynamics intro route file to exist.");

const source = fs.readFileSync(routePath, "utf8");

assert.match(source, /loadTeamAssessmentExecutionContext/);
assert.match(source, /requireAuthenticatedUser/);
assert.match(source, /teamAssessmentParticipantId: params\.teamAssessmentParticipantId/);
assert.match(source, /userId: user\.id/);
assert.match(source, /if \(!access\.ok\) \{\s+notFound\(\);\s+\}/);

assert.doesNotMatch(source, /getCandidateAttemptForUser/);
assert.doesNotMatch(source, /getGenericCandidateAttemptForUser/);
assert.doesNotMatch(source, /AssessmentForm/);
assert.doesNotMatch(source, /saveAssessmentProgress/);
assert.doesNotMatch(source, /completeAssessmentAttempt/);
assert.doesNotMatch(source, /completeProtectedAssessmentAttempt/);
assert.doesNotMatch(source, /update\(\{/);
assert.doesNotMatch(source, /attemptId/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /report snapshot/i);
assert.doesNotMatch(source, /Team Fit/);
assert.doesNotMatch(source, /AI report/i);

assert.match(source, /Procjena timske dinamike/);
assert.match(source, /Ova procjena je dio timske procjene, ne individualni psihološki profil\./);
assert.match(source, /Rješavanje još nije omogućeno u ovoj verziji\./);
assert.match(source, /Uskoro ćeš ovdje moći započeti procjenu timske dinamike\./);
assert.match(source, /context\.wrapperStatus/);
assert.match(source, /context\.packageSlug/);

console.log("Team Dynamics intro route shell tests passed.");
