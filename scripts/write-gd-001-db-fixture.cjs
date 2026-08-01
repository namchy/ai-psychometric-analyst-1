const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

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

const {
  GD_001_CANDIDATE_ID,
  GD_001_ORGANIZATION_NAME,
  GD_001_TEST_SLUGS,
  GD_001_FIXTURE_RPC,
  GOLDEN_DEMO_FIXTURE_RPC,
  getGoldenDemoCandidateContract,
  buildGoldenDemoFixtureRpcPayload,
  executeGd001ApplyWithRpcBoundary,
  executeGoldenDemoApplyWithRpcBoundary,
  getGd001RpcErrorText,
  inspectGd001FixtureWithRepository,
  parseGd001WriterCli,
} = require("../lib/golden-demo/db-fixture-writer.ts");
const {
  loadGoldenDemoCsvFoundation,
  loadGoldenDemoRepoContract,
} = require("../lib/golden-demo/csv-loader.ts");
const { validateGoldenDemoCsvFoundation } = require(
  "../lib/golden-demo/csv-validator.ts",
);

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const name = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function requireEnvironment(name, env = process.env) {
  if (!env[name] || !env[name].trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return env[name].trim();
}

function redactSecrets(message, env = process.env) {
  let redacted = String(message);
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const value = env[name];
    if (value) redacted = redacted.split(value).join(`[${name}]`);
  }
  return redacted;
}

function requireQuery(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data ?? [];
}

function createReadOnlyRepository({ supabase, foundation, candidate }) {
  return {
    async inspect() {
      const organizations = requireQuery(
        await supabase
          .from("organizations")
          .select("id, name, status")
          .eq("name", GD_001_ORGANIZATION_NAME),
        "Failed to resolve organization",
      );
      if (organizations.length !== 1) {
        throw new Error(
          `Expected exactly one organization named ${GD_001_ORGANIZATION_NAME}; received ${organizations.length}.`,
        );
      }
      const organization = organizations[0];
      if (organization.status !== "active") {
        throw new Error(`Organization ${GD_001_ORGANIZATION_NAME} is not active.`);
      }

      const tests = requireQuery(
        await supabase
          .from("tests")
          .select("id, slug, status, is_active")
          .in("slug", GD_001_TEST_SLUGS),
        "Failed to resolve standard battery tests",
      );
      const testIdsBySlug = {};
      for (const slug of GD_001_TEST_SLUGS) {
        const matches = tests.filter((test) => test.slug === slug);
        if (matches.length !== 1) {
          throw new Error(`Expected exactly one test for ${slug}; received ${matches.length}.`);
        }
        if (matches[0].status !== "active" || matches[0].is_active !== true) {
          throw new Error(`Standard battery test ${slug} is not active.`);
        }
        testIdsBySlug[slug] = matches[0].id;
      }

      const questions = requireQuery(
        await supabase
          .from("questions")
          .select("id, test_id, code, question_type, is_required, is_active")
          .in("test_id", Object.values(testIdsBySlug))
          .eq("is_active", true),
        "Failed to resolve Golden Demo questions",
      );
      const questionByIdentity = new Map();
      for (const row of foundation.answers.rows.filter(
        (answer) => answer.values.candidate_id === candidate.candidateId,
      )) {
        const slug = row.values.test_slug;
        const code = row.values.question_code;
        const matches = questions.filter(
          (question) => question.test_id === testIdsBySlug[slug] && question.code === code,
        );
        if (matches.length !== 1) {
          throw new Error(`Expected exactly one question for ${slug}/${code}; received ${matches.length}.`);
        }
        if (matches[0].question_type !== row.values.response_kind) {
          throw new Error(`Question type mismatch for ${slug}/${code}.`);
        }
        if (matches[0].is_required !== true) {
          throw new Error(`Golden Demo scored question ${slug}/${code} is not required.`);
        }
        questionByIdentity.set(`${slug}\u0000${code}`, matches[0]);
      }

      const questionIds = [...questionByIdentity.values()].map((question) => question.id);
      const options = requireQuery(
        await supabase
          .from("answer_options")
          .select("id, question_id, code")
          .in("question_id", questionIds),
        "Failed to resolve Golden Demo answer options",
      );

      const participantRows = requireQuery(
        await supabase
          .from("participants")
          .select(
            "id, organization_id, user_id, email, full_name, participant_type, status, addressing_form",
          )
          .ilike("email", candidate.email),
        "Failed to resolve participant",
      ).filter((participant) => participant.email.trim().toLowerCase() === candidate.email);
      const targetParticipants = participantRows.filter(
        (participant) => participant.organization_id === organization.id,
      );
      const participantConflictReasons = [];
      if (participantRows.some((participant) => participant.organization_id !== organization.id)) {
        participantConflictReasons.push("The fixture email already exists in another organization.");
      }
      if (targetParticipants.length > 1) {
        participantConflictReasons.push("Multiple participants match the fixture email in Partner Plus.");
      }
      const participant = targetParticipants.length === 1 ? targetParticipants[0] : null;

      let assignments = [];
      let attempts = [];
      let links = [];
      let responses = [];
      let dimensionScoreCount = 0;
      let attemptReportCount = 0;
      let assessmentReportCount = 0;
      if (participant) {
        assignments = requireQuery(
          await supabase
            .from("assessment_assignments")
            .select(
              "id, organization_id, participant_id, assignment_type, status, locale, completed_at",
            )
            .eq("organization_id", organization.id)
            .eq("participant_id", participant.id),
          "Failed to load participant assignments",
        );
        const attemptRows = requireQuery(
          await supabase
          .from("attempts")
            .select(
              "id, test_id, organization_id, participant_id, user_id, status, locale, addressing_form_snapshot, completed_at, scored_started_at",
            )
            .eq("organization_id", organization.id)
            .eq("participant_id", participant.id)
            .in("test_id", Object.values(testIdsBySlug)),
          "Failed to load participant attempts",
        );
        const slugByTestId = new Map(Object.entries(testIdsBySlug).map(([slug, id]) => [id, slug]));
        attempts = attemptRows.map((attempt) => ({
          ...attempt,
          test_slug: slugByTestId.get(attempt.test_id) ?? `unknown:${attempt.test_id}`,
        }));
        const assignmentIds = assignments.map((assignment) => assignment.id);
        if (assignmentIds.length > 0) {
          links = requireQuery(
            await supabase
              .from("assessment_assignment_attempts")
              .select(
                "assessment_assignment_id, attempt_id, test_id, test_slug, role_in_assignment, required_for_composite, required_for_team_fit, position",
              )
              .in("assessment_assignment_id", assignmentIds),
            "Failed to load assignment-attempt links",
          );
          const assessmentReports = await supabase
            .from("assessment_reports")
            .select("id", { count: "exact", head: true })
            .in("assessment_assignment_id", assignmentIds);
          if (assessmentReports.error) throw new Error(`Failed to count assessment reports: ${assessmentReports.error.message}`);
          assessmentReportCount = assessmentReports.count ?? 0;
        }
        const attemptIds = attempts.map((attempt) => attempt.id);
        if (attemptIds.length > 0) {
          responses = requireQuery(
            await supabase
              .from("responses")
              .select(
                "attempt_id, question_id, response_kind, answer_option_id, text_value, raw_value, scored_value",
              )
              .in("attempt_id", attemptIds),
            "Failed to load responses",
          );
          const dimensionScores = await supabase
            .from("dimension_scores")
            .select("id", { count: "exact", head: true })
            .in("attempt_id", attemptIds);
          if (dimensionScores.error) throw new Error(`Failed to count dimension scores: ${dimensionScores.error.message}`);
          dimensionScoreCount = dimensionScores.count ?? 0;
          const attemptReports = await supabase
            .from("attempt_reports")
            .select("id", { count: "exact", head: true })
            .in("attempt_id", attemptIds);
          if (attemptReports.error) throw new Error(`Failed to count attempt reports: ${attemptReports.error.message}`);
          attemptReportCount = attemptReports.count ?? 0;
        }
      }

      const attemptIdBySlug = new Map(
        GD_001_TEST_SLUGS.map((slug) => [
          slug,
          attempts.find((attempt) => attempt.test_slug === slug)?.id ?? `planned:${slug}`,
        ]),
      );
      const expectedResponses = foundation.answers.rows
        .filter((row) => row.values.candidate_id === candidate.candidateId)
        .map((row) => {
        const slug = row.values.test_slug;
        const question = questionByIdentity.get(`${slug}\u0000${row.values.question_code}`);
        let answerOptionId = null;
        let textValue = null;
        if (row.values.response_kind === "single_choice") {
          const optionMatches = options.filter(
            (option) =>
              option.question_id === question.id &&
              option.code === row.values.answer_option_code,
          );
          if (optionMatches.length !== 1) {
            throw new Error(
              `Expected exactly one option for ${slug}/${row.values.question_code}/${row.values.answer_option_code}; received ${optionMatches.length}.`,
            );
          }
          answerOptionId = optionMatches[0].id;
        } else {
          textValue = row.values.answer_value;
        }
        return {
          testSlug: slug,
          questionCode: row.values.question_code,
          attemptId: attemptIdBySlug.get(slug),
          questionId: question.id,
          responseKind: row.values.response_kind,
          answerOptionId,
          textValue,
        };
        });
      if (expectedResponses.length !== 184) {
        throw new Error(`Expected 184 resolved responses; received ${expectedResponses.length}.`);
      }

      return {
        snapshot: {
          organizationId: organization.id,
          participant,
          participantConflictReasons,
          assignments,
          attempts,
          links,
          responses,
          dimensionScoreCount,
          attemptReportCount,
          assessmentReportCount,
        },
        expectedResponses,
        candidate,
        testIdsBySlug,
      };
    },
  };
}

async function run(argv = process.argv.slice(2), env = process.env) {
  const options = parseGd001WriterCli(argv);
  process.stderr.write(`Mode: ${options.mode}\n`);
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));
  const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL", env);
  const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY", env);

  const foundation = loadGoldenDemoCsvFoundation(projectRoot);
  const repoContract = loadGoldenDemoRepoContract(projectRoot);
  const validation = validateGoldenDemoCsvFoundation(foundation, repoContract);
  if (!validation.ok) {
    throw new Error(`Golden Demo CSV validation failed with ${validation.errors.length} error(s).`);
  }
  const candidate = getGoldenDemoCandidateContract(foundation, options.candidateId);

  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const repository = createReadOnlyRepository({ supabase, foundation, candidate });
  const plan = await inspectGd001FixtureWithRepository(repository);
  if (options.mode === "apply") {
    const applyResult = candidate.candidateId === GD_001_CANDIDATE_ID
      ? await executeGd001ApplyWithRpcBoundary({
          initialPlan: plan,
          payload: buildGoldenDemoFixtureRpcPayload(foundation, candidate.candidateId),
          async invokeRpc({ rpcName, payload }) {
            if (rpcName !== GD_001_FIXTURE_RPC) {
              throw new Error(`Unexpected fixture RPC: ${rpcName}`);
            }
            const { data, error } = await supabase.rpc(rpcName, { p_fixture: payload });
            if (error) {
              throw new Error(`GD-001 fixture RPC failed: ${getGd001RpcErrorText(error)}`);
            }
            return data;
          },
          inspectAfterRpc: () => inspectGd001FixtureWithRepository(repository),
        })
      : await executeGoldenDemoApplyWithRpcBoundary({
          candidateId: candidate.candidateId,
          initialPlan: plan,
          payload: buildGoldenDemoFixtureRpcPayload(foundation, candidate.candidateId),
          async invokeRpc({ rpcName, payload }) {
            if (rpcName !== GOLDEN_DEMO_FIXTURE_RPC) {
              throw new Error(`Unexpected fixture RPC: ${rpcName}`);
            }
            const { data, error } = await supabase.rpc(rpcName, { p_fixture: payload });
            if (error) {
              throw new Error(`Golden Demo fixture RPC failed: ${getGd001RpcErrorText(error)}`);
            }
            return data;
          },
          inspectAfterRpc: () => inspectGd001FixtureWithRepository(repository),
        });
    process.stdout.write(`${JSON.stringify(applyResult, null, 2)}\n`);
    return applyResult;
  }
  if (options.verbose) plan.verbose = { responseIdentitiesResolved: plan.responses.resolved };
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  return plan;
}

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(
      `GD-001 fixture writer error: ${redactSecrets(
        error instanceof Error ? error.message : String(error),
      )}\n`,
    );
    process.exitCode = 1;
  });
}

module.exports = {
  createReadOnlyRepository,
  loadEnvFileIfPresent,
  redactSecrets,
  requireEnvironment,
  run,
};
