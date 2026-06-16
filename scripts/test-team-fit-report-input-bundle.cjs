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
  "team-fit-report-input-bundle.ts",
);
const promptHelperPath = path.join(
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

assert.match(helperSource, /buildTeamFitReportInputBundle/);
assert.match(helperSource, /validateTeamFitReportInputBundle/);
assert.match(helperSource, /getTeamFitReportInputBundleEvidenceIds/);
assert.match(helperSource, /candidate\.deep_profile/);
assert.match(helperSource, /team\.dynamics/);
assert.match(helperSource, /context\.hr/);
assert.match(helperSource, /link\.\$\{candidateId\}__\$\{targetId\}/);
assert.doesNotMatch(helperSource, /OpenAI|createChatCompletion|fetch\(/i);
assert.doesNotMatch(helperSource, /\.from\(/);
assert.doesNotMatch(helperSource, /supabase|worker|scheduler|renderer|process-assessment-report-jobs/i);

const {
  buildTeamFitReportInputBundle,
  validateTeamFitReportInputBundle,
  getTeamFitReportInputBundleEvidenceIds,
} = require(helperPath);
const {
  buildTeamFitReportProviderPromptInput,
  buildTeamFitReportProviderMessages,
  buildTeamFitReportProviderRequestDraft,
} = require(promptHelperPath);

function buildBaseInput() {
  return {
    locale: "bs-BA",
    generatedFor: {
      organizationId: "org-1",
      teamId: "team-1",
      participantId: "participant-1",
      teamName: "Operativni tim",
      candidateDisplayName: "Kandidat A",
    },
    candidateDeepProfileSignals: [
      {
        key: "ipip.work_style.structure",
        label: "Strukturiranje rada",
        signal:
          "Kandidat rano razjasnjava ocekivanja i preferira pregledan nacin pracenja zadataka.",
      },
    ],
    teamDynamicsAggregationSignals: [
      {
        key: "decision_ownership",
        label: "Vlasnistvo odluka",
        signal:
          "Tim pokazuje trenje oko jasnog zatvaranja dogovora i raspodjele vlasnistva nad odlukama.",
      },
    ],
    hrAdminOptionalContext: {
      allowed: true,
      signals: [
        {
          key: "role_expectation",
          label: "Ocekivanje uloge",
          signal: "HR zeli provjeriti kako kandidat uvodi strukturu bez usporavanja tima.",
        },
      ],
    },
    interpretiveLinks: [
      {
        candidateSignalKey: "ipip.work_style.structure",
        targetCollection: "teamDynamicsAggregationSignals",
        targetSignalKey: "decision_ownership",
        label: "Veza kandidat-tim",
        signal:
          "Kandidatov strukturisan pristup moze pomoci timu da jasnije zakljucuje otvorene dogovore.",
      },
    ],
    interpretationLimits: [
      "Report ne predstavlja odluku o zaposljavanju.",
      "Signal je relacijski i zavisi od stvarnog radnog konteksta.",
    ],
    metadata: {
      generatedAt: "2026-06-16T12:00:00.000Z",
      requestId: "req-1",
      inputVersion: "team_fit_input_bundle_v1",
      sourceVersion: "deterministic_test_fixture_v1",
    },
  };
}

function main() {
  const validResult = buildTeamFitReportInputBundle(buildBaseInput());
  assert.equal(validResult.ok, true);

  const bundle = validResult.bundle;
  const evidenceIds = getTeamFitReportInputBundleEvidenceIds(bundle);

  assert.deepEqual(evidenceIds, [
    "candidate.deep_profile.ipip.work_style.structure",
    "team.dynamics.decision_ownership",
    "context.hr.role_expectation",
    "link.candidate.deep_profile.ipip.work_style.structure__team.dynamics.decision_ownership",
  ]);

  assert.equal(bundle.candidateDeepProfileSignals[0].side, "candidate");
  assert.equal(bundle.teamDynamicsAggregationSignals[0].side, "team");
  assert.equal(bundle.hrAdminOptionalContextSignals[0].side, "context");
  assert.equal(bundle.interpretiveLinks[0].side, "interpretive_link");

  const validBundleCheck = validateTeamFitReportInputBundle(bundle);
  assert.equal(validBundleCheck.ok, true);

  const providerPromptInput = buildTeamFitReportProviderPromptInput(bundle);
  const providerMessages = buildTeamFitReportProviderMessages(bundle);
  const requestDraft = buildTeamFitReportProviderRequestDraft(bundle, {
    model: "team-fit-placeholder",
    responseSchemaName: "Team Fit Bundle Request",
  });

  assert.equal(providerPromptInput.allowedEvidenceIds.includes("team.dynamics.decision_ownership"), true);
  assert.equal(providerPromptInput.allowedEvidenceIds.includes("context.hr.role_expectation"), true);
  assert.match(providerMessages.systemPrompt, /postojece evidence id-eve/i);
  assert.match(providerMessages.systemPrompt, /nema numeric fit score-a/i);
  assert.match(providerMessages.userPrompt, /riskAndMitigationMap/);
  assert.equal(requestDraft.model, "team-fit-placeholder");
  assert.equal(requestDraft.contractVersion, "team_fit_report_v1");
  assert.equal(requestDraft.messages.length, 2);
  assert.equal(JSON.stringify(requestDraft).includes("createChatCompletion"), false);
  assert.equal(JSON.stringify(requestDraft).includes(".from("), false);

  const duplicateEvidenceResult = buildTeamFitReportInputBundle({
    ...buildBaseInput(),
    interpretiveLinks: [
      {
        candidateSignalKey: "ipip.work_style.structure",
        targetCollection: "teamDynamicsAggregationSignals",
        targetSignalKey: "decision_ownership",
        label: "Veza 1",
        signal: "Prva veza.",
      },
      {
        candidateSignalKey: "ipip.work_style.structure",
        targetCollection: "teamDynamicsAggregationSignals",
        targetSignalKey: "decision_ownership",
        label: "Veza 2",
        signal: "Druga veza sa istim referencama.",
      },
    ],
  });
  assert.equal(duplicateEvidenceResult.ok, false);
  assert.match(duplicateEvidenceResult.errors.join("\n"), /Duplicate evidence id/);

  const invalidSideResult = buildTeamFitReportInputBundle({
    ...buildBaseInput(),
    candidateDeepProfileSignals: [
      {
        key: "ipip.work_style.structure",
        label: "Strukturiranje rada",
        signal: "Kandidat signal.",
        side: "team",
      },
    ],
  });
  assert.equal(invalidSideResult.ok, false);
  assert.match(invalidSideResult.errors.join("\n"), /candidateDeepProfileSignals\[0\]\.side: Expected candidate/);

  const invalidInterpretiveLinkResult = buildTeamFitReportInputBundle({
    ...buildBaseInput(),
    interpretiveLinks: [
      {
        candidateSignalKey: "ipip.work_style.structure",
        targetCollection: "hrAdminOptionalContextSignals",
        targetSignalKey: "missing_context",
        label: "Nevalidna veza",
        signal: "Link bez validnog target reference-a.",
      },
    ],
  });
  assert.equal(invalidInterpretiveLinkResult.ok, false);
  assert.match(
    invalidInterpretiveLinkResult.errors.join("\n"),
    /Interpretive link requires valid team or context evidence reference/,
  );

  const hrContextWithoutAllowResult = buildTeamFitReportInputBundle({
    ...buildBaseInput(),
    hrAdminOptionalContext: {
      allowed: false,
      signals: [
        {
          key: "role_expectation",
          label: "Ocekivanje uloge",
          signal: "HR zeli provjeriti upravljanje rokovima.",
        },
      ],
    },
  });
  assert.equal(hrContextWithoutAllowResult.ok, false);
  assert.match(hrContextWithoutAllowResult.errors.join("\n"), /Signals require explicit allow flag/);

  const executiveOverviewWithoutAllowResult = buildTeamFitReportInputBundle({
    ...buildBaseInput(),
    teamDynamicsExecutiveOverview: {
      allowed: false,
      signals: [
        {
          key: "exec_alignment",
          label: "Executive alignment",
          signal: "Overview navodi potrebu za jasnijim koordinacionim ritmom.",
        },
      ],
    },
  });
  assert.equal(executiveOverviewWithoutAllowResult.ok, false);
  assert.match(
    executiveOverviewWithoutAllowResult.errors.join("\n"),
    /teamDynamicsExecutiveOverview: Signals require explicit allow flag/,
  );

  const teamStyleMissingSourceTypeResult = buildTeamFitReportInputBundle({
    ...buildBaseInput(),
    teamStyleCollaboration: {
      allowed: true,
      signals: [
        {
          key: "collaboration.preference.sync",
          label: "Preferirani ritam uskladjivanja",
          signal: "Kandidat preferira rano uskladjivanje prije vecih promjena plana.",
        },
      ],
    },
  });
  assert.equal(teamStyleMissingSourceTypeResult.ok, false);
  assert.match(
    teamStyleMissingSourceTypeResult.errors.join("\n"),
    /Team Style signals require explicit sourceType team_style_collaboration_signal/,
  );

  const invalidValidatedBundle = validateTeamFitReportInputBundle({
    ...bundle,
    interpretiveLinks: [
      {
        id: "link.candidate.deep_profile.missing_candidate__team.dynamics.decision_ownership",
        sourceType: "interpretive_link",
        side: "interpretive_link",
        label: "Broken link",
        signal: "Broken interpretive link.",
      },
    ],
  });
  assert.equal(invalidValidatedBundle.ok, false);
  assert.match(
    invalidValidatedBundle.errors.join("\n"),
    /Interpretive link requires existing candidate evidence reference/,
  );

  console.log("test-team-fit-report-input-bundle: ok");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
