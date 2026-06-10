const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const routePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "attempts",
  "[attemptId]",
  "page.tsx",
);

assert.equal(fs.existsSync(routePath), true, "Expected HR attempt detail route to exist.");

const routeSource = fs.readFileSync(routePath, "utf8");

assert.match(routeSource, /PageNavigation/);
assert.match(routeSource, /buildBackNavigation/);
assert.match(routeSource, /participant_id/);
assert.match(routeSource, /\/dashboard\/participants\/\$\{input\.participantId\}\/reports/);
assert.match(routeSource, /label: "Nazad na pregled procjena"/);
assert.match(routeSource, /href: "\/dashboard"/);
assert.match(routeSource, /label: "Nazad na HR dashboard"/);
assert.match(routeSource, /contextLabel="HR izvještaj procjene"/);
assert.match(routeSource, /backLinkVariant="subtle"/);
assert.match(routeSource, /CompletedAssessmentSummary/);
assert.match(routeSource, /HR izvještaj još nije dostupan/);

assert.doesNotMatch(routeSource, /generate|regenerate|retry_failed|recoverHrCandidateAttemptReport/i);
assert.doesNotMatch(routeSource, /OpenAI|openai/i);
assert.doesNotMatch(routeSource, /\.insert\(|\.update\(|\.delete\(/);

console.log("test-hr-single-test-attempt-route-navigation: ok");
