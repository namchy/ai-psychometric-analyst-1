const fs = require("node:fs");
const path = require("node:path");

function fail(message) {
  throw new Error(message);
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    fail(`${label}: expected to find ${needle}`);
  }
}

function main() {
  const filePath = path.resolve(
    __dirname,
    "../components/assessment/completed-assessment-summary.tsx",
  );
  const source = fs.readFileSync(filePath, "utf8");

  assertIncludes(source, "ipip_neo_120_participant_v2", "renderer routing");
  assertIncludes(
    source,
    "function IpipNeo120ParticipantReportV2Sections",
    "V2 renderer component",
  );

  const componentStart = source.indexOf("function IpipNeo120ParticipantReportV2Sections");
  const componentEnd = source.indexOf("function IpipNeo120HrReportSections", componentStart);

  if (componentStart === -1 || componentEnd === -1 || componentEnd <= componentStart) {
    fail("Could not isolate IpipNeo120ParticipantReportV2Sections body.");
  }

  const componentBody = source.slice(componentStart, componentEnd);

  if (componentBody.includes("buildParticipantIpipProfileOverview")) {
    fail("V2 renderer must not call buildParticipantIpipProfileOverview.");
  }

  assertIncludes(source, "scrollIntoView(", "participant scroll helper presence");
  assertIncludes(
    componentBody,
    'const pendingScrollTargetRef = useRef<"details" | "overview" | null>(null);',
    "V2 pending scroll ref",
  );
  assertIncludes(
    componentBody,
    "if (pendingScrollTargetRef.current === null)",
    "V2 pending scroll guard",
  );

  assertIncludes(
    componentBody,
    'const [activeDomainCode, setActiveDomainCode] = useState<string | null>(null);',
    "V2 renderer default collapsed state",
  );
  assertIncludes(componentBody, 'aria-expanded={isActive}', "V2 domain button aria state");
  assertIncludes(
    componentBody,
    '{isActive ? "Zatvori detalje" : "Prikaži detalje"}',
    "V2 domain button action copy",
  );

  if (componentBody.includes("report.domains[0]?.domain_code")) {
    fail("V2 renderer must not default to the first domain.");
  }

  if (componentBody.includes("Aktivna domena")) {
    fail("V2 renderer must not expose developer-style active-state button copy.");
  }

  for (const needle of [
    "report.summary.badges",
    "report.key_patterns",
    "report.work_style",
    "report.strengths",
    "report.watchouts",
    "report.development_recommendations",
    "report.interpretation_note",
    "participant_display_label",
  ]) {
    assertIncludes(componentBody, needle, "V2 renderer snapshot field usage");
  }

  console.info("IPIP-NEO-120 participant V2 renderer verification passed");
}

try {
  main();
} catch (error) {
  console.error("verify-ipip-neo-120-participant-v2-renderer failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
}
