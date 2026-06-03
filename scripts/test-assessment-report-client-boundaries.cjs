const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const assessmentFormPath = path.join(projectRoot, "components", "assessment", "assessment-form.tsx");
const completedSummaryPath = path.join(
  projectRoot,
  "components",
  "assessment",
  "completed-assessment-summary.tsx",
);
const reportStateTypesPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "report-state-types.ts",
);

const assessmentFormSource = fs.readFileSync(assessmentFormPath, "utf8");
const completedSummarySource = fs.readFileSync(completedSummaryPath, "utf8");
const reportStateTypesSource = fs.readFileSync(reportStateTypesPath, "utf8");

assert.match(assessmentFormSource, /^"use client";/);
assert.match(completedSummarySource, /^"use client";/);

assert.doesNotMatch(
  assessmentFormSource,
  /CompletedAssessmentReportState\s*\}\s*from\s*"@\/lib\/assessment\/reports"/,
);
assert.doesNotMatch(
  completedSummarySource,
  /CompletedAssessmentReportState\s*\}\s*from\s*"@\/lib\/assessment\/reports"/,
);

assert.match(
  assessmentFormSource,
  /CompletedAssessmentReportState\s*\}\s*from\s*"@\/lib\/assessment\/report-state-types"/,
);
assert.match(
  completedSummarySource,
  /CompletedAssessmentReportState\s*\}\s*from\s*"@\/lib\/assessment\/report-state-types"/,
);

assert.doesNotMatch(reportStateTypesSource, /server-only/);
assert.doesNotMatch(reportStateTypesSource, /report-providers/);
assert.match(reportStateTypesSource, /export type CompletedAssessmentReportState/);

console.log("Assessment report client boundary tests passed.");
