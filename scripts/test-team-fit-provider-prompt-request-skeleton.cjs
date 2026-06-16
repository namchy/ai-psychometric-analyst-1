const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-fit-report-provider-prompt.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;
    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyModulePath;
  }

  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      resolveWithExtensions(path.join(projectRoot, request.slice(2))),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

assert.match(helperSource, /buildTeamFitReportProviderPromptInput/);
assert.match(helperSource, /buildTeamFitReportProviderMessages/);
assert.match(helperSource, /buildTeamFitReportProviderRequestDraft/);
assert.match(helperSource, /candidate-vs-team HR report/);
assert.match(helperSource, /outputSections/);
assert.doesNotMatch(helperSource, /OpenAI|createChatCompletion|fetch\(/i);
assert.doesNotMatch(helperSource, /\.from\(/);
assert.doesNotMatch(helperSource, /supabase|worker|scheduler|process-assessment-report-jobs/i);

const {
  TEAM_FIT_PROVIDER_PROMPT_SCHEMA_NAME,
  buildTeamFitReportProviderPromptInput,
  buildTeamFitReportProviderMessages,
  buildTeamFitReportProviderRequestDraft,
} = require(helperPath);

function buildEvidence(id, sourceType, side, label, signal, relationNote) {
  return {
    id,
    sourceType,
    side,
    label,
    signal,
    relationNote,
  };
}

function buildFixtureBundle() {
  return {
    locale: "bs-BA",
    generatedFor: {
      organizationId: "org-1",
      teamId: "team-1",
      participantId: "participant-1",
      teamName: "Tim operacija",
      candidateDisplayName: "Kandidat 1",
    },
    candidateDeepProfileSignals: [
      buildEvidence(
        "cand-1",
        "candidate_deep_profile_signal",
        "candidate",
        "Strukturiranje rada",
        "Kandidat rano razjasnjava ocekivanja i preferira pregledan radni okvir.",
        "Relevantno za tim koji ima trenje oko vlasnistva odluka.",
      ),
    ],
    teamDynamicsAggregationSignals: [
      buildEvidence(
        "team-1",
        "team_dynamics_aggregation_signal",
        "team",
        "Koordinacija odluka",
        "Tim ima signal povremenog trenja oko uskladjivanja prioriteta i vlasnistva odluka.",
        "Relevantno za kandidat-vs-team fit framing.",
      ),
    ],
    teamDynamicsExecutiveOverviewSignals: [
      buildEvidence(
        "exec-1",
        "team_dynamics_executive_overview_signal",
        "context",
        "Executive context",
        "Executive pregled naglasava potrebu za jasnijim zatvaranjem otvorenih dogovora.",
        "Dodatni interpreted context, ne canonical source.",
      ),
    ],
    teamStyleCollaborationSignals: [],
    hrAdminOptionalContextSignals: [
      buildEvidence(
        "ctx-1",
        "hr_admin_optional_context",
        "context",
        "Onboarding prioritet",
        "HR zeli provjeriti kako kandidat uvodi strukturu bez usporavanja tima.",
        "Koristi se samo kao dodatni HR context.",
      ),
    ],
    interpretiveLinks: [
      buildEvidence(
        "link-1",
        "interpretive_link",
        "interpretive_link",
        "Veza kandidat-tim",
        "Kandidatov strukturisan pristup moze pomoci timu da jasnije zatvara otvorene dogovore.",
        "Povezuje candidate i team signal.",
      ),
    ],
    interpretationLimits: [
      "Executive Overview je optional interpreted context i nije jedini team-side source.",
      "Report nije odluka o zaposljavanju.",
    ],
    metadata: {
      generatedAt: "2026-06-16T12:00:00.000Z",
      requestId: "req-1",
      inputVersion: "team_fit_provider_prompt_input_v1",
      sourceVersion: "team_fit_report_input_v2_enriched",
    },
  };
}

function main() {
  const bundle = buildFixtureBundle();
  const promptInput = buildTeamFitReportProviderPromptInput(bundle);

  assert.equal(promptInput.contractVersion, "team_fit_report_v1");
  assert.equal(promptInput.reportType, "team_fit");
  assert.equal(promptInput.audience, "hr");
  assert.deepEqual(promptInput.allowedEvidenceIds, [
    "cand-1",
    "team-1",
    "exec-1",
    "ctx-1",
    "link-1",
  ]);
  assert.equal(promptInput.outputSections.length, 11);

  const messageDraft = buildTeamFitReportProviderMessages(promptInput);
  assert.equal(messageDraft.messages.length, 2);
  assert.match(messageDraft.systemPrompt, /candidate-vs-team HR report/i);
  assert.match(messageDraft.systemPrompt, /nema numeric fit score-a/i);
  assert.match(messageDraft.systemPrompt, /nema hire\/no-hire/i);
  assert.match(messageDraft.systemPrompt, /nema pass\/fail/i);
  assert.match(messageDraft.systemPrompt, /ne iznosi tvrdnju bez input evidence-a/i);
  assert.match(messageDraft.systemPrompt, /fit je umjeren/i);
  assert.match(messageDraft.systemPrompt, /kandidat se dobro uklapa/i);
  assert.match(messageDraft.systemPrompt, /bosanski jezik, latinicu, ijekavicu/i);
  assert.match(messageDraft.systemPrompt, /ti\/tvoj/i);
  assert.match(messageDraft.systemPrompt, /postojece evidence id-eve/i);

  assert.match(messageDraft.userPrompt, /summary/);
  assert.match(messageDraft.userPrompt, /fitOverview/);
  assert.match(messageDraft.userPrompt, /likelyTeamContribution/);
  assert.match(messageDraft.userPrompt, /possibleFrictionPoints/);
  assert.match(messageDraft.userPrompt, /teamConditionsThatImproveFit/);
  assert.match(messageDraft.userPrompt, /interviewProbes/);
  assert.match(messageDraft.userPrompt, /onboardingAndManagerGuidance/);
  assert.match(messageDraft.userPrompt, /riskAndMitigationMap/);
  assert.match(messageDraft.userPrompt, /evidenceAppendix/);
  assert.match(messageDraft.userPrompt, /interpretationLimits/);
  assert.match(messageDraft.userPrompt, /metadata/);
  assert.match(messageDraft.userPrompt, /cand-1/);
  assert.match(messageDraft.userPrompt, /team-1/);
  assert.match(messageDraft.userPrompt, /link-1/);

  const requestDraft = buildTeamFitReportProviderRequestDraft(bundle, {
    model: "gpt-placeholder",
    responseSchemaName: "Team Fit Prompt Request V1",
  });
  assert.equal(requestDraft.model, "gpt-placeholder");
  assert.equal(requestDraft.contractVersion, "team_fit_report_v1");
  assert.equal(requestDraft.responseSchemaName, "team_fit_prompt_request_v1");
  assert.equal(requestDraft.messages.length, 2);
  assert.equal(requestDraft.metadata.locale, "bs-BA");
  assert.deepEqual(requestDraft.metadata.allowedEvidenceIds, [
    "cand-1",
    "team-1",
    "exec-1",
    "ctx-1",
    "link-1",
  ]);
  assert.equal(
    requestDraft.metadata.outputSections.includes("riskAndMitigationMap"),
    true,
  );

  assert.equal(requestDraft.responseSchemaName === TEAM_FIT_PROVIDER_PROMPT_SCHEMA_NAME, false);
  assert.equal(JSON.stringify(requestDraft).includes("createChatCompletion"), false);
  assert.equal(JSON.stringify(requestDraft).includes("supabase"), false);
  assert.equal(JSON.stringify(requestDraft).includes(".from("), false);
  assert.equal(JSON.stringify(requestDraft).includes("insert into"), false);

  console.log("test-team-fit-provider-prompt-request-skeleton: ok");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
