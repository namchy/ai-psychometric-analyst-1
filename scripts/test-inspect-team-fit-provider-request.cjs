const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(
  projectRoot,
  "scripts",
  "inspect-team-fit-provider-request.cjs",
);
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /TEAM_FIT_PROVIDER_REQUEST_CAPTURE_PATH/);
assert.match(scriptSource, /TEAM_FIT_PROVIDER_REQUEST_MODEL/);
assert.match(scriptSource, /openAiCalled:\s*false/);
assert.match(scriptSource, /databaseReads:\s*false/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /reportGenerated:\s*false/);
assert.match(scriptSource, /productionFlowChanged:\s*false/);
assert.match(scriptSource, /chmodFile\(dumpPath,\s*0o600\)/);
assert.doesNotMatch(scriptSource, /fetch\(/);
assert.doesNotMatch(scriptSource, /\.from\(/);
assert.doesNotMatch(scriptSource, /supabase|worker|scheduler|renderer|process-assessment-report-jobs/i);

const {
  DEFAULT_MODEL,
  DUMP_PATH_ENV,
  FIXTURE_GENERATED_AT,
  MODEL_ENV,
  assertSafeDumpPath,
  buildTeamFitProviderRequestCaptureArtifact,
  runTeamFitProviderRequestCapture,
  sanitizeForDump,
} = require(scriptPath);

const FORBIDDEN_KEYS = [
  "fitScore",
  "numericScore",
  "fitPercentage",
  "decision",
  "hireDecision",
  "hiringDecision",
  "hireRecommendation",
  "hiringRecommendation",
  "passFail",
  "rank",
  "ranking",
  "candidateRank",
];

function assertArtifactShape(artifact) {
  assert.equal(artifact.metadata.inspector, "team_fit_provider_request_capture_v1");
  assert.equal(artifact.metadata.reportType, "team_fit_report_v1");
  assert.equal(artifact.metadata.contractVersion, "team_fit_report_v1");
  assert.equal(artifact.metadata.provider, "no_call");
  assert.equal(artifact.metadata.openAiCalled, false);
  assert.equal(artifact.metadata.databaseReads, false);
  assert.equal(artifact.metadata.databaseWrites, false);
  assert.equal(artifact.metadata.reportGenerated, false);
  assert.equal(artifact.metadata.productionFlowChanged, false);

  assert.equal(artifact.inputBundle.locale, "bs-BA");
  assert.equal(Array.isArray(artifact.evidenceIds), true);
  assert.equal(artifact.evidenceIds.length > 0, true);
  assert.equal(Boolean(artifact.evidenceIdMap), true);
  assert.equal(Boolean(artifact.providerPromptInput), true);
  assert.equal(Boolean(artifact.messages), true);
  assert.equal(Boolean(artifact.requestDraft), true);
  assert.equal(Boolean(artifact.responseFormat), true);
  assert.equal(artifact.schemaName, "team_fit_report_v1");
  assert.equal(artifact.responseFormat.type, "json_schema");
  assert.equal(artifact.responseFormat.json_schema.strict, true);
  assert.equal(artifact.requestBody.model, artifact.metadata.model);
  assert.deepEqual(artifact.requestBody.messages, artifact.messages.messages);
  assert.deepEqual(artifact.requestBody.response_format, artifact.responseFormat);
  assert.equal(artifact.requestBody.contractVersion, "team_fit_report_v1");
  assert.equal(artifact.requestDraft.contractVersion, "team_fit_report_v1");
  assert.equal(artifact.requestDraft.responseSchemaName, "team_fit_report_v1");
  assert.equal(artifact.requestDraft.metadata.locale, "bs-BA");
  assert.equal(artifact.providerPromptInput.contractVersion, "team_fit_report_v1");
  assert.equal(artifact.providerPromptInput.reportType, "team_fit");
  assert.equal(artifact.providerPromptInput.audience, "hr");

  const serialized = JSON.stringify(artifact);
  assert.equal(serialized.includes("sk-"), false);
  assert.equal(serialized.includes("apiKey"), false);

  FORBIDDEN_KEYS.forEach((key) => {
    assert.equal(serialized.includes(`"${key}"`), false, `Forbidden key leaked: ${key}`);
  });
}

async function main() {
  const artifact = buildTeamFitProviderRequestCaptureArtifact();
  assert.equal(artifact.metadata.model, DEFAULT_MODEL);
  assert.equal(artifact.inputBundle.metadata.generatedAt, FIXTURE_GENERATED_AT);
  assert.equal(
    artifact.requestDraft.metadata.allowedEvidenceIds.includes(
      "candidate.deep_profile.ipip.work_style.structure",
    ),
    true,
  );
  assertArtifactShape(artifact);

  const overriddenArtifact = buildTeamFitProviderRequestCaptureArtifact({
    model: "gpt-fixture-model",
  });
  assert.equal(overriddenArtifact.metadata.model, "gpt-fixture-model");
  assert.equal(overriddenArtifact.requestBody.model, "gpt-fixture-model");

  assert.throws(() => assertSafeDumpPath("relative.json"), /absolute path under \/tmp/);
  assert.throws(() => assertSafeDumpPath("/etc/team-fit.json"), /resolve inside/);
  assert.throws(() => assertSafeDumpPath("/tmp/team-fit.txt"), /\.json file/);
  assert.doesNotThrow(() => assertSafeDumpPath("/tmp/team-fit-request-capture.json"));

  const sanitized = sanitizeForDump({
    token: "abc",
    nested: {
      apiKey: "sk-test-secret",
      content: "Use sk-real-secret in request",
    },
  });
  assert.equal(sanitized.token, "[REDACTED]");
  assert.equal(sanitized.nested.apiKey, "[REDACTED]");
  assert.equal(sanitized.nested.content.includes("sk-real-secret"), false);

  let stdout = "";
  let dumpWrites = 0;
  let chmods = 0;
  const dumpPath = path.join(os.tmpdir(), "team-fit-provider-request-capture-test.json");
  fs.rmSync(dumpPath, { force: true });

  const runResult = await runTeamFitProviderRequestCapture({
    env: {
      [MODEL_ENV]: "gpt-test-model",
      [DUMP_PATH_ENV]: dumpPath,
    },
    stdout: {
      write(chunk) {
        stdout += chunk;
      },
    },
    writeFile(filePath, content, encoding) {
      dumpWrites += 1;
      fs.writeFileSync(filePath, content, encoding);
    },
    chmodFile(filePath, mode) {
      chmods += 1;
      fs.chmodSync(filePath, mode);
    },
  });

  assert.equal(runResult.dumpPath, dumpPath);
  assert.equal(dumpWrites, 1);
  assert.equal(chmods, 1);
  const parsedStdout = JSON.parse(stdout);
  assertArtifactShape(parsedStdout);
  assert.equal(parsedStdout.metadata.model, "gpt-test-model");
  assert.equal(fs.existsSync(dumpPath), true);
  const parsedDump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
  assertArtifactShape(parsedDump);
  if (process.platform !== "win32") {
    const mode = fs.statSync(dumpPath).mode & 0o777;
    assert.equal(mode, 0o600);
  }
  fs.rmSync(dumpPath, { force: true });

  console.log("test-inspect-team-fit-provider-request: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
