const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const tablePath = path.join(projectRoot, "components", "dashboard", "hr-assessments-table.tsx");
const modelPath = path.join(projectRoot, "lib", "dashboard", "hr-candidate-assessment.ts");

const tableSource = fs.readFileSync(tablePath, "utf8");
const modelSource = fs.readFileSync(modelPath, "utf8");

assert.match(tableSource, /Dodijeli procjenu/);
assert.match(tableSource, />\s*Pregled procjena\s*</);
assert.match(tableSource, /href=\{participantReportsHref\}/);
assert.match(tableSource, /const participantReportsHref = `\/dashboard\/participants\/\$\{row\.participant\.id\}\/reports`/);
assert.doesNotMatch(tableSource, /team-fit-reports/);
assert.doesNotMatch(tableSource, /report_status/);
assert.doesNotMatch(tableSource, /error_message/);

assert.match(modelSource, /label: "Pregled procjena"/);
assert.match(modelSource, /href: `\/dashboard\/participants\/\$\{participant\.id\}\/reports`/);
assert.doesNotMatch(modelSource, /label: "Pogledaj procjenu"/);

console.log("HR dashboard navigation polish tests passed.");
