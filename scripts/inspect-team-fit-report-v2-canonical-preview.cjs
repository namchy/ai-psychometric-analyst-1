const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const typescript = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_TEAM_FIT_V2_CANONICAL_PREVIEW";
const OUTPUT_PATH_ENV = "TEAM_FIT_V2_CANONICAL_PREVIEW_PATH";
const TIMEOUT_ENV = "TEAM_FIT_V2_CANONICAL_PREVIEW_TIMEOUT_MS";
const DEFAULT_OUTPUT_PATH = "/tmp/team-fit-v2-gd001-gdt01-preview.json";
const DEFAULT_TIMEOUT_MS = 900000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 900000;
const CANONICAL_MODEL = "gpt-5.6-sol";
const CANONICAL_REASONING_EFFORT = "high";
const CANONICAL_CANDIDATE_KEY = "GD-001";
const CANONICAL_TEAM_KEY = "GDT-01";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

let typeScriptRuntimeInstalled = false;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of ["", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;
    if (fs.existsSync(withExtension)) return withExtension;
  }

  return candidatePath;
}

function installTypeScriptRuntime() {
  if (typeScriptRuntimeInstalled) return;

  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    if (request === "server-only") return emptyModulePath;
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
    const transpiled = typescript.transpileModule(source, {
      compilerOptions: {
        module: typescript.ModuleKind.CommonJS,
        moduleResolution: typescript.ModuleResolutionKind.NodeJs,
        target: typescript.ScriptTarget.ES2022,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
      fileName: filename,
    });
    module._compile(transpiled.outputText, filename);
  };

  typeScriptRuntimeInstalled = true;
}

function loadCanonicalGdt01MemberCount() {
  installTypeScriptRuntime();
  const { GDT_01_COUNTS } = require(
    path.join(projectRoot, "lib", "golden-demo", "team-dynamics-gdt-01-db-contract.ts"),
  );
  return GDT_01_COUNTS.members;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function binaryCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function resolveExactCanonicalMatch(label, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Canonical source resolution failed: zero matches for ${label}.`);
  }
  if (rows.length > 1) {
    throw new Error(
      `Canonical source resolution failed: ambiguous ${label}; found ${rows.length} matches.`,
    );
  }
  return rows[0];
}

function assertCandidateCoverage(compositeSnapshot) {
  const expectedSlugs = ["ipip-neo-120-v1", "mwms_v1", "safran_v1"];
  const sourceAttempts = Array.isArray(compositeSnapshot?.sourceAttempts)
    ? compositeSnapshot.sourceAttempts
    : [];
  const observedSlugs = sourceAttempts.map((entry) => entry.testSlug).sort(binaryCompare);
  const exactCoverage =
    compositeSnapshot?.coverage?.requiredCount === 3 &&
    compositeSnapshot?.coverage?.completedCount === 3 &&
    Array.isArray(compositeSnapshot?.coverage?.missingTestSlugs) &&
    compositeSnapshot.coverage.missingTestSlugs.length === 0 &&
    sourceAttempts.length === 3 &&
    sourceAttempts.every(
      (entry) => entry.requiredForComposite === true && entry.status === "completed",
    ) &&
    JSON.stringify(observedSlugs) === JSON.stringify(expectedSlugs);

  if (!exactCoverage) {
    throw new Error("Canonical GD-001 assignment does not have exact 3/3 deterministic coverage.");
  }

  return {
    requiredCount: 3,
    completedCount: 3,
    missingTestSlugs: [],
    sourceTestSlugs: observedSlugs,
  };
}

function assertTeamCoverage(verification, expected) {
  const canonicalMemberCount = expected.canonicalMemberCount;
  if (!Number.isSafeInteger(canonicalMemberCount) || canonicalMemberCount <= 0) {
    throw new Error("Canonical GDT-01 member count authority is invalid.");
  }

  const exactCoverage =
    verification?.status === "ready" &&
    verification?.teamAssessmentAssignmentId === expected.teamAssessmentAssignmentId &&
    verification?.aggregationSnapshotId === expected.aggregationSnapshotId &&
    verification?.incompleteMemberCount === 0 &&
    verification?.missingScoreCount === 0 &&
    verification?.invalidScoreCount === 0;

  if (!exactCoverage) {
    throw new Error("Canonical GDT-01 aggregation does not have verified full coverage.");
  }

  const includedMemberCount = verification.includedMemberCount;
  const completedMemberCount = verification.completedMemberCount;
  const readyScoredMemberCount = verification.readyScoredMemberCount;
  if (
    includedMemberCount !== canonicalMemberCount ||
    completedMemberCount !== canonicalMemberCount ||
    readyScoredMemberCount !== canonicalMemberCount
  ) {
    throw new Error(
      `Canonical GDT-01 coverage mismatch: expected included/completed/readyScored ${canonicalMemberCount}/${canonicalMemberCount}/${canonicalMemberCount}, received ${String(includedMemberCount)}/${String(completedMemberCount)}/${String(readyScoredMemberCount)}.`,
    );
  }

  return {
    status: verification.status,
    teamFullCoverage: true,
    includedMemberCount: verification.includedMemberCount,
    completedMemberCount: verification.completedMemberCount,
    readyScoredMemberCount: verification.readyScoredMemberCount,
    incompleteMemberCount: verification.incompleteMemberCount,
    missingScoreCount: verification.missingScoreCount,
    invalidScoreCount: verification.invalidScoreCount,
  };
}

function classifyCanonicalRows(input) {
  const organization = resolveExactCanonicalMatch("Golden Demo organization", input.organizations);
  const participant = resolveExactCanonicalMatch("GD-001 participant", input.participants);
  const team = resolveExactCanonicalMatch("GDT-01 team", input.teams);
  const candidateAssignment = resolveExactCanonicalMatch(
    "GD-001 standard-battery assignment",
    input.candidateAssignments,
  );
  const teamAssignment = resolveExactCanonicalMatch(
    "GDT-01 Team Dynamics assignment",
    input.teamAssignments,
  );
  const aggregationSnapshot = resolveExactCanonicalMatch(
    "GDT-01 ready aggregation snapshot",
    input.aggregationSnapshots,
  );

  if (participant.organization_id !== organization.id) {
    throw new Error("Canonical source resolution failed: GD-001 organization mismatch.");
  }
  if (team.organization_id !== organization.id) {
    throw new Error("Canonical source resolution failed: GDT-01 organization mismatch.");
  }
  if (
    candidateAssignment.organization_id !== organization.id ||
    candidateAssignment.participant_id !== participant.id
  ) {
    throw new Error("Canonical source resolution failed: GD-001 assignment lineage mismatch.");
  }
  if (teamAssignment.team_id !== team.id) {
    throw new Error("Canonical source resolution failed: GDT-01 assignment lineage mismatch.");
  }
  if (
    aggregationSnapshot.team_assessment_assignment_id !== teamAssignment.id ||
    (aggregationSnapshot.team_id && aggregationSnapshot.team_id !== team.id)
  ) {
    throw new Error("Canonical source resolution failed: GDT-01 snapshot lineage mismatch.");
  }

  return {
    organization,
    participant,
    team,
    candidateAssignment,
    teamAssignment,
    aggregationSnapshot,
  };
}

function parseTimeoutMs(rawValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return DEFAULT_TIMEOUT_MS;
  }
  const normalized = String(rawValue).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${TIMEOUT_ENV} must be a positive integer.`);
  }
  const timeoutMs = Number(normalized);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < MIN_TIMEOUT_MS ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `${TIMEOUT_ENV} must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}.`,
    );
  }
  return timeoutMs;
}

function assertSafeDumpPath(filePath, fsImpl = fs) {
  if (!isNonEmptyString(filePath) || !path.isAbsolute(filePath)) {
    throw new Error(`${OUTPUT_PATH_ENV} must be an absolute .json path inside /tmp.`);
  }
  const resolvedPath = path.resolve(filePath);
  if (path.extname(resolvedPath).toLowerCase() !== ".json") {
    throw new Error(`${OUTPUT_PATH_ENV} must point to a .json file.`);
  }
  const tmpRoot = fsImpl.realpathSync("/tmp");
  const parent = fsImpl.realpathSync(path.dirname(resolvedPath));
  if (parent !== tmpRoot && !parent.startsWith(`${tmpRoot}${path.sep}`)) {
    throw new Error(`${OUTPUT_PATH_ENV} must resolve inside ${tmpRoot}.`);
  }
  if (fsImpl.existsSync(resolvedPath) && fsImpl.lstatSync(resolvedPath).isSymbolicLink()) {
    throw new Error(`${OUTPUT_PATH_ENV} must not be a symbolic link.`);
  }
  return resolvedPath;
}

function sanitizeForDump(value) {
  if (typeof value === "string") {
    return value
      .replace(/\bBearer\s+[^\s]+/gi, "Bearer [REDACTED]")
      .replace(/\bsk-[A-Za-z0-9_-]+/g, "sk-[REDACTED]");
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeForDump(entry));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (/(authorization|cookie|token|secret|password|api[_-]?key|service[_-]?role)/i.test(key)) {
        return [key, "[REDACTED]"];
      }
      return [key, sanitizeForDump(entry)];
    }),
  );
}

function writeDiagnosticArtifact(filePath, artifact, fsImpl = fs) {
  const safePath = assertSafeDumpPath(filePath, fsImpl);
  const sanitized = sanitizeForDump(artifact);
  if (
    artifact.reportSnapshot &&
    JSON.stringify(sanitized.reportSnapshot) !== JSON.stringify(artifact.reportSnapshot)
  ) {
    throw new Error("Report snapshot contains secret-like content; diagnostic dump was blocked.");
  }
  fsImpl.writeFileSync(safePath, `${JSON.stringify(sanitized, null, 2)}\n`, {
    mode: 0o600,
  });
  fsImpl.chmodSync(safePath, 0o600);
  return safePath;
}

function summarizeRequestBody(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  return {
    model: body?.model ?? null,
    reasoningEffort: body?.reasoning_effort ?? null,
    temperaturePropertyPresent: Object.prototype.hasOwnProperty.call(body ?? {}, "temperature"),
    responseFormat: body?.response_format?.type ?? null,
    schemaName: body?.response_format?.json_schema?.name ?? null,
    schemaStrict: body?.response_format?.json_schema?.strict ?? null,
    messageCount: messages.length,
    messages: messages.map((message) => ({
      role: message?.role ?? null,
      contentSha256: sha256(String(message?.content ?? "")),
      contentLength: String(message?.content ?? "").length,
    })),
  };
}

function createSingleOpenAiFetchGuard(baseFetch) {
  if (typeof baseFetch !== "function") throw new Error("A fetch implementation is required.");
  let transportCallCount = 0;
  let secondTransportBlocked = false;
  let requestSummary = null;

  async function guardedFetch(input, init) {
    if (transportCallCount >= 1) {
      secondTransportBlocked = true;
      throw new Error("Second OpenAI transport attempt is blocked.");
    }

    const url = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
    if (url !== OPENAI_CHAT_COMPLETIONS_URL) {
      throw new Error(`Unexpected transport target: ${String(url)}.`);
    }
    if ((init?.method ?? "GET") !== "POST") {
      throw new Error("Canonical preview transport must use POST.");
    }

    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body.model !== CANONICAL_MODEL) {
      throw new Error("Canonical preview request model mismatch.");
    }
    if (body.reasoning_effort !== CANONICAL_REASONING_EFFORT) {
      throw new Error("Canonical preview request reasoning_effort mismatch.");
    }
    if (Object.prototype.hasOwnProperty.call(body, "temperature")) {
      throw new Error("Canonical preview request must omit temperature.");
    }

    transportCallCount += 1;
    requestSummary = summarizeRequestBody(body);
    return baseFetch(input, init);
  }

  return {
    fetchImpl: guardedFetch,
    getTransportCallCount: () => transportCallCount,
    wasSecondTransportBlocked: () => secondTransportBlocked,
    getRequestSummary: () => deepClone(requestSummary),
  };
}

function createReadOnlySupabaseGuard(client, audit) {
  const forbidden = new Set(["insert", "update", "upsert", "delete"]);
  const queryCache = new WeakMap();

  function wrapQuery(query, table) {
    if (!query || typeof query !== "object") return query;
    if (queryCache.has(query)) return queryCache.get(query);

    const proxy = new Proxy(query, {
      get(target, property) {
        if (forbidden.has(property)) {
          return () => {
            throw new Error(`Read-only DB guard blocked ${String(property)} on ${table}.`);
          };
        }
        if (property === "then") return target.then.bind(target);
        const value = Reflect.get(target, property, target);
        if (typeof value !== "function") return value;
        return (...args) => {
          const result = value.apply(target, args);
          if (result && typeof result === "object" && !(result instanceof Promise)) {
            return wrapQuery(result, table);
          }
          return result;
        };
      },
    });
    queryCache.set(query, proxy);
    return proxy;
  }

  return {
    from(table) {
      audit.tablesRead.add(table);
      return wrapQuery(client.from(table), table);
    },
    rpc() {
      throw new Error("Read-only DB guard blocked rpc.");
    },
  };
}

async function requireRows(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`Failed to read ${label}: ${error.message}`);
  return data ?? [];
}

function loadDefaultDependencies() {
  installTypeScriptRuntime();
  const { createSupabaseAdminClient } = require(
    path.join(projectRoot, "lib", "supabase", "admin.ts"),
  );
  const { loadGoldenDemoFoundationContract } = require(
    path.join(projectRoot, "lib", "golden-demo", "golden-demo-foundation-contract.ts"),
  );
  const { GDT_01_PACKAGE_SLUG } = require(
    path.join(projectRoot, "lib", "golden-demo", "team-dynamics-gdt-01-db-contract.ts"),
  );
  const { buildCompositeHrInputSnapshot } = require(
    path.join(projectRoot, "lib", "assessment", "composite-input.ts"),
  );
  const { loadTeamDynamicsFinalAggregationVerification } = require(
    path.join(projectRoot, "lib", "assessment", "team-dynamics-final-aggregation-read.ts"),
  );
  const { buildTeamFitReportInputSnapshotFromSources } = require(
    path.join(projectRoot, "lib", "b2b", "team-fit-report-input.ts"),
  );
  const {
    generateTeamFitReportV2WithOpenAI,
    TEAM_FIT_REPORT_V2_OPENAI_PROVIDER_VERSION,
  } = require(
    path.join(projectRoot, "lib", "b2b", "team-fit-report-v2-openai-provider.ts"),
  );
  const {
    buildTeamFitReportV2EvidenceCatalog,
    validateTeamFitReportV2EvidenceReferences,
  } = require(
    path.join(projectRoot, "lib", "b2b", "team-fit-report-v2-evidence.ts"),
  );
  const { validateTeamFitReportV2 } = require(
    path.join(projectRoot, "lib", "b2b", "team-fit-report-v2-contract.ts"),
  );
  const { TEAM_FIT_REPORT_V2_PROMPT_VERSION } = require(
    path.join(projectRoot, "lib", "b2b", "team-fit-report-v2-prompt.ts"),
  );
  const { TEAM_FIT_REPORT_V2_SCHEMA_NAME } = require(
    path.join(projectRoot, "lib", "b2b", "team-fit-report-v2-schema.ts"),
  );

  return {
    createSupabaseAdminClient,
    loadGoldenDemoFoundationContract,
    canonicalTeamMemberCount: loadCanonicalGdt01MemberCount(),
    canonicalTeamPackageSlug: GDT_01_PACKAGE_SLUG,
    buildCompositeHrInputSnapshot,
    loadTeamDynamicsFinalAggregationVerification,
    sourceDirectBuilder: buildTeamFitReportInputSnapshotFromSources,
    provider: generateTeamFitReportV2WithOpenAI,
    providerVersion: TEAM_FIT_REPORT_V2_OPENAI_PROVIDER_VERSION,
    buildEvidenceCatalog: buildTeamFitReportV2EvidenceCatalog,
    validateContract: validateTeamFitReportV2,
    validateEvidence: validateTeamFitReportV2EvidenceReferences,
    promptVersion: TEAM_FIT_REPORT_V2_PROMPT_VERSION,
    schemaName: TEAM_FIT_REPORT_V2_SCHEMA_NAME,
  };
}

async function resolveCanonicalSources({ ephemeralReportReferenceId, generatedAt, deps }) {
  const contract = deps.loadGoldenDemoFoundationContract(projectRoot);
  if (contract.fixtureValidationErrors.length > 0) {
    throw new Error(
      `Golden Demo foundation contract is invalid: ${contract.fixtureValidationErrors.join("; ")}`,
    );
  }
  const candidateManifest = resolveExactCanonicalMatch(
    "GD-001 repo manifest entry",
    contract.participants.filter((entry) => entry.candidateId === CANONICAL_CANDIDATE_KEY),
  );
  const teamManifest = resolveExactCanonicalMatch(
    "GDT-01 repo manifest entry",
    contract.teams.filter((entry) => entry.teamCode === CANONICAL_TEAM_KEY),
  );
  if (candidateManifest.teamCode !== teamManifest.teamCode) {
    throw new Error("Golden Demo repo contract does not map GD-001 to GDT-01.");
  }

  const audit = { tablesRead: new Set() };
  const rawSupabase = deps.createSupabaseAdminClient();
  const supabase = createReadOnlySupabaseGuard(rawSupabase, audit);

  const organizations = await requireRows(
    supabase
      .from("organizations")
      .select("id, name, status")
      .eq("name", contract.organization.name)
      .eq("status", contract.organization.status),
    "Golden Demo organization",
  );
  const organization = resolveExactCanonicalMatch("Golden Demo organization", organizations);

  const participants = await requireRows(
    supabase
      .from("participants")
      .select("id, organization_id, full_name, email, status")
      .eq("organization_id", organization.id)
      .eq("email", candidateManifest.email),
    "GD-001 participant",
  );
  if (participants.some((entry) => entry.full_name !== candidateManifest.fullName)) {
    throw new Error("Canonical source resolution failed: GD-001 name differs from repo manifest.");
  }

  const teams = await requireRows(
    supabase
      .from("teams")
      .select("id, organization_id, name, archived_at")
      .eq("organization_id", organization.id)
      .eq("name", teamManifest.name)
      .is("archived_at", null),
    "GDT-01 team",
  );

  const participant = resolveExactCanonicalMatch("GD-001 participant", participants);
  const team = resolveExactCanonicalMatch("GDT-01 team", teams);

  const candidateAssignments = await requireRows(
    supabase
      .from("assessment_assignments")
      .select(
        "id, organization_id, participant_id, assignment_type, status, locale, created_at",
      )
      .eq("organization_id", organization.id)
      .eq("participant_id", participant.id)
      .eq("assignment_type", "standard_battery")
      .in("status", ["active", "completed"]),
    "GD-001 standard-battery assignments",
  );

  const teamAssignments = await requireRows(
    supabase
      .from("team_assessment_assignments")
      .select("id, team_id, package_slug, status, created_at")
      .eq("team_id", team.id)
      .eq("package_slug", deps.canonicalTeamPackageSlug)
      .eq("status", "active"),
    "GDT-01 Team Dynamics assignments",
  );
  const teamAssignment = resolveExactCanonicalMatch(
    "GDT-01 Team Dynamics assignment",
    teamAssignments,
  );

  const aggregationSnapshots = await requireRows(
    supabase
      .from("team_assessment_aggregation_snapshots")
      .select(
        "id, team_assessment_assignment_id, team_id, aggregation_version, aggregation_status, created_at, calculated_at",
      )
      .eq("team_assessment_assignment_id", teamAssignment.id)
      .eq("aggregation_status", "ready"),
    "GDT-01 ready aggregation snapshots",
  );

  const rows = classifyCanonicalRows({
    organizations,
    participants,
    teams,
    candidateAssignments,
    teamAssignments,
    aggregationSnapshots,
  });

  const compositeSnapshot = await deps.buildCompositeHrInputSnapshot({
    assessmentAssignmentId: rows.candidateAssignment.id,
    organizationId: rows.organization.id,
    participantId: rows.participant.id,
    locale: rows.candidateAssignment.locale ?? "bs",
  });
  const candidateCoverage = assertCandidateCoverage(compositeSnapshot);

  const verification = await deps.loadTeamDynamicsFinalAggregationVerification(
    {
      teamAssessmentAssignmentId: rows.teamAssignment.id,
      aggregationVersion: rows.aggregationSnapshot.aggregation_version,
    },
    { supabase },
  );
  const teamCoverage = assertTeamCoverage(verification, {
    teamAssessmentAssignmentId: rows.teamAssignment.id,
    aggregationSnapshotId: rows.aggregationSnapshot.id,
    canonicalMemberCount: deps.canonicalTeamMemberCount,
  });

  const sourceResult = await deps.sourceDirectBuilder(
    {
      ephemeralReportReferenceId,
      organizationId: rows.organization.id,
      teamId: rows.team.id,
      participantId: rows.participant.id,
      candidateAssessmentAssignmentId: rows.candidateAssignment.id,
      teamAggregationSourceId: rows.aggregationSnapshot.id,
      locale: rows.candidateAssignment.locale ?? "bs",
      generatedAt,
    },
    {
      supabase,
      buildCompositeInputSnapshot: async (input) => {
        if (
          input.assessmentAssignmentId !== rows.candidateAssignment.id ||
          input.organizationId !== rows.organization.id ||
          input.participantId !== rows.participant.id
        ) {
          throw new Error("Source-direct builder requested unexpected candidate lineage.");
        }
        return compositeSnapshot;
      },
      loadTeamAggregationVerification: async (input) => {
        if (
          input.teamAssessmentAssignmentId !== rows.teamAssignment.id ||
          input.aggregationVersion !== rows.aggregationSnapshot.aggregation_version
        ) {
          throw new Error("Source-direct builder requested unexpected team lineage.");
        }
        return verification;
      },
    },
  );

  if (!sourceResult.ok) {
    throw new Error(
      `Source-direct Team Fit input build failed: ${sourceResult.reason}: ${sourceResult.message}`,
    );
  }

  return {
    inputSnapshot: sourceResult.inputSnapshot,
    sourceResolution: {
      organization: {
        id: rows.organization.id,
        name: rows.organization.name,
        status: rows.organization.status,
      },
      candidate: {
        fixtureKey: CANONICAL_CANDIDATE_KEY,
        participantId: rows.participant.id,
        displayName: rows.participant.full_name,
        manifestDisplayName: candidateManifest.fullName,
        assignmentId: rows.candidateAssignment.id,
        assignmentType: rows.candidateAssignment.assignment_type,
        assignmentStatus: rows.candidateAssignment.status,
      },
      team: {
        fixtureKey: CANONICAL_TEAM_KEY,
        teamId: rows.team.id,
        teamName: rows.team.name,
        manifestTeamName: teamManifest.name,
        teamAssessmentAssignmentId: rows.teamAssignment.id,
        packageSlug: rows.teamAssignment.package_slug,
        assignmentStatus: rows.teamAssignment.status,
        aggregationSnapshotId: rows.aggregationSnapshot.id,
        aggregationVersion: rows.aggregationSnapshot.aggregation_version,
      },
      ambiguityChecks: {
        organizations: organizations.length,
        participants: participants.length,
        candidateAssignments: candidateAssignments.length,
        teams: teams.length,
        teamAssignments: teamAssignments.length,
        readyAggregationSnapshots: aggregationSnapshots.length,
      },
      lineage: {
        sameOrganization: true,
        candidateAssignmentMatchesParticipant: true,
        teamAssignmentMatchesTeam: true,
        aggregationSnapshotMatchesAssignment: true,
      },
      databaseTablesRead: [...audit.tablesRead].sort(binaryCompare),
    },
    candidateCoverage,
    teamCoverage,
  };
}

function buildInputSummary(inputSnapshot, candidateCoverage, teamCoverage) {
  return {
    inputType: inputSnapshot.inputType,
    inputVersion: inputSnapshot.inputVersion,
    locale: inputSnapshot.locale,
    candidateSourceStatus: inputSnapshot.candidateSignals.sourceStatus,
    teamSourceStatus: inputSnapshot.teamSignals.sourceStatus,
    candidateCoverage,
    teamCoverage,
    candidateSourceTestSlugs:
      inputSnapshot.candidateSignals.sourceMetadata?.sourceTestSlugs ??
      candidateCoverage.sourceTestSlugs,
    inputSha256: sha256(inputSnapshot),
  };
}

function buildEvidenceSummary(catalog) {
  return {
    candidateCount: catalog.candidate.length,
    teamCount: catalog.team.length,
    candidateKeys: catalog.candidate.map((entry) => entry.key),
    teamKeys: catalog.team.map((entry) => entry.key),
  };
}

function collectEvidenceReferences(report) {
  const groups = [
    ...(report?.executiveAssessment?.mainReasons ?? []),
    ...(report?.keySignals ?? []),
    ...(report?.likelyContributions ?? []),
    ...(report?.frictionRisks ?? []),
    ...(report?.interviewPlan ?? []),
  ];
  return groups.flatMap((entry) => entry?.evidenceRefs ?? []);
}

function buildContentAuditChecklist(report, evidenceValidationPassed) {
  const references = collectEvidenceReferences(report);
  return {
    manualReviewRequired: true,
    technicalEvidenceValidationPassed: evidenceValidationPassed,
    sectionCounts: {
      mainReasons: report?.executiveAssessment?.mainReasons?.length ?? 0,
      keySignals: report?.keySignals?.length ?? 0,
      likelyContributions: report?.likelyContributions?.length ?? 0,
      successConditions: report?.successConditions?.length ?? 0,
      frictionRisks: report?.frictionRisks?.length ?? 0,
      interviewPlan: report?.interviewPlan?.length ?? 0,
      adaptForThisTeam: report?.teamIntegrationPlan?.adaptForThisTeam?.length ?? 0,
      teamPreparations: report?.teamIntegrationPlan?.teamPreparations?.length ?? 0,
      first30Days: report?.teamIntegrationPlan?.first30Days?.length ?? 0,
      managerGuidance: report?.managerGuidance?.length ?? 0,
    },
    evidenceReferenceCount: references.length,
    candidateEvidenceReferenceCount: references.filter((entry) => entry.source === "candidate")
      .length,
    teamEvidenceReferenceCount: references.filter((entry) => entry.source === "team").length,
    reviewPaths: [
      "executiveAssessment",
      "keySignals",
      "likelyContributions",
      "successConditions",
      "frictionRisks",
      "interviewPlan",
      "teamIntegrationPlan",
      "managerGuidance",
      "interpretationLimits",
    ],
  };
}

function buildBaseArtifact({ mode, generatedAt, timeoutMs, providerVersion, promptVersion, schemaName }) {
  return {
    metadata: {
      inspector: "team_fit_report_v2_canonical_preview_v1",
      mode,
      generatedAt,
      openAiCalled: false,
      transportCallCount: 0,
      databaseReads: true,
      databaseWrites: false,
      persistence: false,
      reportGenerated: false,
      reportPersisted: false,
      runtimeWiringChanged: false,
      existingReportsModified: false,
    },
    sourceResolution: null,
    inputSummary: null,
    evidenceCatalog: null,
    requestSummary: {
      model: CANONICAL_MODEL,
      reasoningEffort: CANONICAL_REASONING_EFFORT,
      temperaturePropertyPresent: false,
      responseFormat: "json_schema",
      schemaName,
      schemaStrict: true,
      timeoutMs,
      providerVersion,
      promptVersion,
    },
    providerResult: null,
    reportSnapshotSha256: null,
    reportSnapshot: null,
    contentAuditChecklist: null,
    dumpPath: null,
  };
}

async function runCanonicalPreview({ env = process.env, dependencies = {} } = {}) {
  const confirmed = env[CONFIRM_ENV] === "true";
  const mode = confirmed ? "confirmed_single_call_preview" : "no_call_preflight";
  const timeoutMs = parseTimeoutMs(env[TIMEOUT_ENV]);
  const model = dependencies.model ?? CANONICAL_MODEL;
  if (model !== CANONICAL_MODEL) {
    throw new Error(`Canonical preview model must be ${CANONICAL_MODEL}.`);
  }

  const generatedAt = dependencies.now?.() ?? new Date().toISOString();
  const ephemeralReportReferenceId = dependencies.randomUUID?.() ?? crypto.randomUUID();
  const defaults = dependencies.skipDefaultDependencies ? {} : loadDefaultDependencies();
  const deps = { ...defaults, ...dependencies };
  const requiredDependencies = [
    "resolveCanonicalSources",
    "buildEvidenceCatalog",
    "provider",
    "validateContract",
    "validateEvidence",
  ];
  if (!deps.resolveCanonicalSources) {
    deps.resolveCanonicalSources = (input) => resolveCanonicalSources({ ...input, deps });
  }
  for (const key of requiredDependencies) {
    if (typeof deps[key] !== "function") throw new Error(`Missing inspector dependency: ${key}.`);
  }

  const artifact = buildBaseArtifact({
    mode,
    generatedAt,
    timeoutMs,
    providerVersion: deps.providerVersion,
    promptVersion: deps.promptVersion,
    schemaName: deps.schemaName,
  });

  const resolved = await deps.resolveCanonicalSources({
    ephemeralReportReferenceId,
    generatedAt,
  });
  const inputSnapshotBefore = JSON.stringify(resolved.inputSnapshot);
  const evidenceCatalog = deps.buildEvidenceCatalog(resolved.inputSnapshot);
  artifact.sourceResolution = resolved.sourceResolution;
  artifact.inputSummary = buildInputSummary(
    resolved.inputSnapshot,
    resolved.candidateCoverage,
    resolved.teamCoverage,
  );
  artifact.evidenceCatalog = {
    ...buildEvidenceSummary(evidenceCatalog),
    candidate: evidenceCatalog.candidate,
    team: evidenceCatalog.team,
  };

  if (!confirmed) {
    return artifact;
  }

  if (!isNonEmptyString(env.OPENAI_API_KEY)) {
    throw new Error("OPENAI_API_KEY is required for confirmed canonical preview.");
  }
  const outputPath = assertSafeDumpPath(
    isNonEmptyString(env[OUTPUT_PATH_ENV]) ? env[OUTPUT_PATH_ENV].trim() : DEFAULT_OUTPUT_PATH,
    deps.fsImpl ?? fs,
  );
  const transport = createSingleOpenAiFetchGuard(deps.fetchImpl ?? globalThis.fetch);
  const providerResult = await deps.provider(resolved.inputSnapshot, {
    apiKey: env.OPENAI_API_KEY,
    model,
    timeoutMs,
    reasoningEffort: CANONICAL_REASONING_EFFORT,
    fetchImpl: transport.fetchImpl,
    now: () => generatedAt,
  });

  artifact.metadata.openAiCalled = transport.getTransportCallCount() === 1;
  artifact.metadata.transportCallCount = transport.getTransportCallCount();
  artifact.requestSummary = {
    ...artifact.requestSummary,
    ...(transport.getRequestSummary() ?? {}),
  };

  if (!providerResult.ok) {
    artifact.providerResult = providerResult;
    artifact.dumpPath = writeDiagnosticArtifact(outputPath, artifact, deps.fsImpl ?? fs);
    return artifact;
  }

  const contractValidation = deps.validateContract(providerResult.snapshot);
  if (!contractValidation.ok) {
    throw new Error("Provider returned success but explicit V2 contract validation failed.");
  }
  const evidenceValidation = deps.validateEvidence(contractValidation.value, evidenceCatalog);
  if (!evidenceValidation.ok) {
    throw new Error("Provider returned success but explicit evidence validation failed.");
  }
  if (JSON.stringify(resolved.inputSnapshot) !== inputSnapshotBefore) {
    throw new Error("Canonical preview mutated the source-direct input snapshot.");
  }

  artifact.metadata.reportGenerated = true;
  artifact.providerResult = {
    ok: true,
    model: providerResult.model,
    provider: providerResult.provider,
    providerVersion: providerResult.providerVersion,
    promptVersion: providerResult.promptVersion,
    contractValidation: "passed",
    evidenceValidation: "passed",
  };
  artifact.reportSnapshot = contractValidation.value;
  artifact.reportSnapshotSha256 = sha256(contractValidation.value);
  artifact.contentAuditChecklist = buildContentAuditChecklist(
    contractValidation.value,
    true,
  );
  artifact.dumpPath = outputPath;
  writeDiagnosticArtifact(outputPath, artifact, deps.fsImpl ?? fs);
  return artifact;
}

async function main() {
  try {
    const artifact = await runCanonicalPreview();
    process.stdout.write(`${JSON.stringify(sanitizeForDump(artifact), null, 2)}\n`);
    if (artifact.metadata.mode === "confirmed_single_call_preview" && !artifact.providerResult?.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    const failure = {
      metadata: {
        inspector: "team_fit_report_v2_canonical_preview_v1",
        openAiCalled: false,
        transportCallCount: 0,
        databaseWrites: false,
        persistence: false,
        runtimeWiringChanged: false,
        existingReportsModified: false,
      },
      error: error instanceof Error ? error.message : String(error),
    };
    process.stdout.write(`${JSON.stringify(sanitizeForDump(failure), null, 2)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  CANONICAL_MODEL,
  CANONICAL_REASONING_EFFORT,
  CONFIRM_ENV,
  DEFAULT_OUTPUT_PATH,
  OPENAI_CHAT_COMPLETIONS_URL,
  OUTPUT_PATH_ENV,
  TIMEOUT_ENV,
  assertCandidateCoverage,
  assertSafeDumpPath,
  assertTeamCoverage,
  classifyCanonicalRows,
  createSingleOpenAiFetchGuard,
  loadCanonicalGdt01MemberCount,
  parseTimeoutMs,
  resolveExactCanonicalMatch,
  runCanonicalPreview,
  sanitizeForDump,
  writeDiagnosticArtifact,
};

if (require.main === module) {
  main();
}
