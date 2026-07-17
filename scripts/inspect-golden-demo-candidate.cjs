const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function installTypeScriptHook() {
  require.extensions[".ts"] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    module._compile(output.outputText, filename);
  };
}

function printCounts(title, counts) {
  process.stdout.write(`${title}:\n`);
  for (const [key, value] of Object.entries(counts)) {
    process.stdout.write(`  ${key}: ${value}\n`);
  }
}

function main() {
  const candidateId = process.argv[2];
  if (!candidateId) {
    process.stderr.write(
      "Usage: node scripts/inspect-golden-demo-candidate.cjs <candidate_id>\n",
    );
    process.exitCode = 1;
    return;
  }

  installTypeScriptHook();
  const projectRoot = path.resolve(__dirname, "..");
  const { loadGoldenDemoCsvFoundation, loadGoldenDemoRepoContract } = require(
    "../lib/golden-demo/csv-loader.ts",
  );
  const {
    inspectGoldenDemoCandidate,
    validateGoldenDemoCsvFoundation,
  } = require("../lib/golden-demo/csv-validator.ts");
  const {
    GD_001_EXPECTED_QUESTION_COUNTS,
    verifyGd001ExpectedScores,
  } = require("../lib/golden-demo/offline-score-verifier.ts");

  try {
    const foundation = loadGoldenDemoCsvFoundation(projectRoot);
    const repoContract = loadGoldenDemoRepoContract(projectRoot);
    const validation = validateGoldenDemoCsvFoundation(foundation, repoContract);
    if (!validation.ok) {
      process.stderr.write(
        `Golden Demo CSV foundation is invalid (${validation.errors.length} error(s)).\n`,
      );
      process.exitCode = 1;
      return;
    }

    const inspection = inspectGoldenDemoCandidate(foundation, candidateId);
    if (!inspection) {
      process.stderr.write(`Golden Demo candidate not found: ${candidateId}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(
      `Candidate: ${inspection.candidate.candidateId} — ${inspection.candidate.displayName}\n`,
    );
    process.stdout.write(`Email: ${inspection.candidate.email}\n`);
    process.stdout.write(`Team: ${inspection.candidate.teamId}\n`);
    process.stdout.write(
      `Cohort segment: ${inspection.candidate.cohortSegment}\n`,
    );
    process.stdout.write(`Data status: ${inspection.candidate.dataStatus}\n`);
    printCounts("Answer count by test", inspection.answerCountByTest);
    printCounts("Expected question count by test", GD_001_EXPECTED_QUESTION_COUNTS);
    const completeness = Object.fromEntries(
      Object.entries(GD_001_EXPECTED_QUESTION_COUNTS).map(([testSlug, expected]) => [
        testSlug,
        inspection.answerCountByTest[testSlug] === expected ? "PASS" : "FAIL",
      ]),
    );
    printCounts("Completeness by test", completeness);
    printCounts(
      "Expected score count by test",
      inspection.expectedScoreCountByTest,
    );
    printCounts(
      "Expected AI finding count by report lane",
      inspection.expectedAiFindingCountByReportLane,
    );

    if (candidateId === "GD-001") {
      const scoreVerification = verifyGd001ExpectedScores({ foundation, projectRoot });
      printCounts(
        "Expected score count by test and scope",
        scoreVerification.expectedScores.byTestAndScope,
      );
      process.stdout.write(`Target profile summary: ${scoreVerification.targetProfileSummary}\n`);
      process.stdout.write(
        `Offline score verification: ${scoreVerification.ok ? "PASS" : "FAIL"} (${scoreVerification.expectedScores.matched}/${scoreVerification.expectedScores.total} matched)\n`,
      );
    }
  } catch (error) {
    process.stderr.write(
      `Unable to inspect Golden Demo candidate: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    process.exitCode = 1;
  }
}

main();
