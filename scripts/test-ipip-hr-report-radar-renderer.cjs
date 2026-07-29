const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const hrAttemptRouteSource = fs.readFileSync(
  path.join(projectRoot, "app/(protected)/dashboard/attempts/[attemptId]/page.tsx"),
  "utf8",
);
const reportRendererSource = fs.readFileSync(
  path.join(projectRoot, "components/assessment/completed-assessment-summary.tsx"),
  "utf8",
);
const radarChartSource = fs.readFileSync(
  path.join(projectRoot, "components/assessment/personality-radar-chart.tsx"),
  "utf8",
);

function extractFunctionBody(source, functionName) {
  const startToken = `function ${functionName}`;
  const startIndex = source.indexOf(startToken);
  assert.notEqual(startIndex, -1, `Expected ${functionName} to exist.`);

  const bodyStart = source.indexOf("{", startIndex);
  assert.notEqual(bodyStart, -1, `Expected ${functionName} to have a body.`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
    }

    if (depth === 0) {
      return source.slice(bodyStart, index + 1);
    }
  }

  throw new Error(`Could not extract ${functionName} body.`);
}

const radarHelperBody = extractFunctionBody(reportRendererSource, "getIpipHrRadarDomains");

assert.equal(
  hrAttemptRouteSource.includes("max-w-6xl"),
  true,
  "Expected the HR attempt report route to use a wider desktop canvas.",
);
assert.equal(
  hrAttemptRouteSource.includes("max-w-4xl"),
  false,
  "Expected the HR attempt report route not to keep the old blog-width cap.",
);
assert.equal(
  radarHelperBody.includes("report.score_references?.domains"),
  true,
  "Expected IPIP HR radar data to come from deterministic score_references domains.",
);
assert.equal(
  radarHelperBody.includes("scoreDomains.length !== HR_IPIP_RADAR_DOMAIN_ORDER.length"),
  true,
  "Expected incomplete score references to skip radar rendering.",
);
assert.equal(
  radarHelperBody.includes("domain.score"),
  true,
  "Expected radar values to use deterministic domain scores.",
);
assert.equal(
  radarHelperBody.includes("domain.domain_name"),
  true,
  "Expected radar labels to use score reference domain names.",
);

for (const forbiddenNarrativeField of [
  "headline",
  "executive_summary",
  "key_hr_signals",
  "domain_overview",
  "verification_focus",
  "interview_questions",
  "strengths_and_overuse_risks",
  "onboarding_and_management_guidance",
  "team_fit_notes",
  "decision_support_note",
  "interpretation_note",
]) {
  assert.equal(
    radarHelperBody.includes(forbiddenNarrativeField),
    false,
    `Expected IPIP HR radar helper not to read ${forbiddenNarrativeField}.`,
  );
}

for (const target of [
  'data-ui="ipip-hr-executive"',
  'data-ui="ipip-hr-radar-panel"',
  'data-ui="ipip-domain-radar"',
]) {
  assert.equal(
    reportRendererSource.includes(target),
    true,
    `Expected IPIP HR renderer to expose ${target}.`,
  );
}

assert.equal(
  reportRendererSource.includes("<PersonalityRadarChart domains={radarDomains}"),
  true,
  "Expected IPIP HR renderer to render the shared radar chart from prepared radar domains.",
);
assert.equal(
  reportRendererSource.includes("shouldRenderRadar ?"),
  true,
  "Expected IPIP HR renderer to omit the radar panel when deterministic score domains are unavailable.",
);
assert.equal(
  radarChartSource.includes('initialDimension={{ width: 320, height: 300 }}'),
  true,
  "Expected the shared radar ResponsiveContainer to have positive SSR dimensions.",
);

console.log("IPIP HR report radar renderer tests passed.");
