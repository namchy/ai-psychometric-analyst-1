import fs from "node:fs";
import path from "node:path";

import {
  validateRuntimeContractSnapshot,
  type RuntimeContractSnapshot,
} from "./team-dynamics-runtime-contract";

export const GDT_01_ORGANIZATION_NAME =
  "Partner Plus d.o.o., Mikrokreditna organizacija" as const;
export const GDT_01_TEAM_ID = "GDT-01" as const;
export const GDT_01_TEAM_NAME = "Kreditno poslovanje i rad s klijentima" as const;
export const GDT_01_PACKAGE_SLUG = "team_dynamics_assessment_v1" as const;
export const GDT_01_LEGACY_PACKAGE_SLUG = "team_dynamics_v1_strong" as const;
export const GDT_01_RUNTIME_CHECKSUM =
  "375a97663ed825ff2f8c09f3716d6a39bbea2722d5b45f4a61d60d2be210f48d" as const;
export const GDT_01_LOCALE = "bs" as const;

export const GDT_01_EXPECTED_MEMBER_IDS = [
  "GD-001",
  "GD-002",
  "GD-003",
  "GD-004",
  "GD-005",
  "GD-019",
] as const;

export const GDT_01_SEED_LIFECYCLE = {
  assignmentStatus: "active",
  wrapperStatus: "invited",
  attemptStatus: "in_progress",
  locale: GDT_01_LOCALE,
} as const;

export const GDT_01_COUNTS = {
  members: 6,
  questionsPerMember: 48,
  likertResponsesPerMember: 42,
  sjtResponsesPerMember: 6,
  responsesPerMember: 48,
  totalResponses: 288,
  physicalSjtSelectionsPerMember: 12,
  totalPhysicalSjtSelections: 72,
  logicalSelectionsPerMember: 54,
  totalLogicalSelections: 324,
} as const;

type JsonRecord = Record<string, unknown>;

export type Gdt01ExpectedMember = {
  candidateId: string;
  displayName: string;
  jobTitle: string;
  email: string;
  cohortSegment: string;
  expectedParticipationState: string;
  deterministicVerificationAllowed: boolean;
  aiPromptCalibrationAllowed: boolean;
};

export type Gdt01ExpectedResponse = {
  candidateId: string;
  questionCode: string;
  questionOrder: number;
  blockCode: string;
  responseType: "likert_single" | "sjt_best_worst";
  optionCode?: string;
  optionValue?: number | string | null;
  bestOptionCode?: string;
  worstOptionCode?: string;
};

export type Gdt01ContractFinding = {
  code: string;
  message: string;
  category?: "foundation" | "runtime" | "target_persistence" | "target_graph";
  entity?: string;
  expected?: unknown;
  observed?: unknown;
};

export type Gdt01ObservedRuntime = {
  test: {
    id: string;
    slug: string;
    status: string;
    isActive: boolean;
    scoringMethod: string | null;
    metadata: unknown;
  } | null;
  questions: Array<{
    id: string;
    testId: string;
    code: string;
    order: number;
    questionType: string;
    required: boolean;
    isActive: boolean;
    metadata: unknown;
  }>;
  options: Array<{
    id: string;
    questionId: string;
    code: string;
    value: number | string | null;
    order: number;
    metadata: unknown;
  }>;
  snapshot: RuntimeContractSnapshot | null;
  snapshotErrors: string[];
};

export type Gdt01ObservedOrganization = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type Gdt01ObservedTeam = {
  id: string;
  organizationId: string;
  name: string;
  archivedAt: string | null;
};

export type Gdt01ObservedParticipant = {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  participantType: string;
  status: string;
};

export type Gdt01ObservedMembership = {
  id: string;
  teamId: string;
  participantId: string;
  isActive: boolean;
  leftAt: string | null;
};

export type Gdt01ObservedAssignment = {
  id: string;
  teamId: string;
  packageSlug: string;
  status: string;
};

export type Gdt01ObservedWrapper = {
  id: string;
  assignmentId: string;
  membershipId: string;
  participantId: string;
  attemptId: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type Gdt01ObservedAttempt = {
  id: string;
  testId: string;
  testSlug: string | null;
  organizationId: string | null;
  participantId: string | null;
  userId: string | null;
  locale: string | null;
  status: string;
  completedAt: string | null;
};

export type Gdt01ObservedResponse = {
  id: string;
  attemptId: string;
  questionId: string;
  questionCode: string | null;
  responseKind: string | null;
  answerOptionId: string | null;
  optionCode: string | null;
  optionValue: number | string | null;
  optionQuestionId: string | null;
  rawValue: number | null;
  scoredValue: number | null;
};

export type Gdt01ObservedSelection = {
  id: string;
  responseId: string;
  questionId: string;
  questionCode: string | null;
  answerOptionId: string;
  optionCode: string | null;
  optionQuestionId: string | null;
  selectionRole: string | null;
};

export type Gdt01ObservedTeamFitReport = {
  id: string;
  organizationId: string;
  teamId: string;
  participantId: string;
  candidateSourceType: string;
  candidateSourceId: string | null;
  teamSourceType: string;
  teamSourceId: string | null;
  lineage: "direct" | "ambient" | "unknown";
};

export type Gdt01ObservedState = {
  organizations: Gdt01ObservedOrganization[];
  teams: Gdt01ObservedTeam[];
  participants: Gdt01ObservedParticipant[];
  memberships: Gdt01ObservedMembership[];
  runtime: Gdt01ObservedRuntime | null;
  assignments: Gdt01ObservedAssignment[];
  wrappers: Gdt01ObservedWrapper[];
  attempts: Gdt01ObservedAttempt[];
  responses: Gdt01ObservedResponse[];
  selections: Gdt01ObservedSelection[];
  dimensionScoreIds: string[];
  memberScoreIds: string[];
  aggregationIds: string[];
  reportSelectionDraftIds: string[];
  reportSelectionMemberIds: string[];
  teamReportIds: string[];
  attemptReportIds: string[];
  teamFitReports: Gdt01ObservedTeamFitReport[];
  ambientAssignments: Gdt01ObservedAssignment[];
};

export type Gdt01DbContract = {
  organizationName: typeof GDT_01_ORGANIZATION_NAME;
  teamId: typeof GDT_01_TEAM_ID;
  teamName: typeof GDT_01_TEAM_NAME;
  packageSlug: typeof GDT_01_PACKAGE_SLUG;
  legacyPackageSlug: typeof GDT_01_LEGACY_PACKAGE_SLUG;
  runtimeChecksum: typeof GDT_01_RUNTIME_CHECKSUM;
  lifecycle: typeof GDT_01_SEED_LIFECYCLE;
  counts: typeof GDT_01_COUNTS;
  members: Gdt01ExpectedMember[];
  responses: Gdt01ExpectedResponse[];
  runtimeSnapshot: RuntimeContractSnapshot | null;
  runtimeValidationErrors: string[];
  fixtureValidationErrors: string[];
};

export type Gdt01InspectionResult = {
  target: {
    organization: typeof GDT_01_ORGANIZATION_NAME;
    teamId: typeof GDT_01_TEAM_ID;
    packageSlug: typeof GDT_01_PACKAGE_SLUG;
    runtimeChecksum: typeof GDT_01_RUNTIME_CHECKSUM;
  };
  state: "EMPTY" | "EXACT_MATCH" | "PARTIAL" | "CONFLICT";
  writerEligible: boolean;
  counts: {
    membersExpected: number;
    wrappersObserved: number;
    attemptsObserved: number;
    responsesExpected: number;
    responsesObserved: number;
    physicalSjtSelectionsExpected: number;
    physicalSjtSelectionsObserved: number;
    logicalSelectionsExpected: number;
    logicalSelectionsObserved: number;
  };
  blockingFindings: Gdt01ContractFinding[];
  diagnosticFindings: Array<{
    code: string;
    message: string;
    entity?: string;
  }>;
  safety: {
    readOnly: true;
    databaseWrites: false;
    rpcCalls: false;
    scoringExecuted: false;
    aggregationExecuted: false;
    reportsGenerated: false;
    openaiCalled: false;
  };
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumberOrString(value: unknown): number | string | null {
  return typeof value === "number" || typeof value === "string" ? value : null;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim();
}

function readCsv(filePath: string): Array<Record<string, string>> {
  const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  if (lines.length === 0 || !lines[0]) return [];
  const headers = lines[0].split(",").map(normalizeHeader);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildFixtureValidation(
  fixture: unknown,
  members: Gdt01ExpectedMember[],
  runtimeSnapshot: RuntimeContractSnapshot | null,
): { responses: Gdt01ExpectedResponse[]; errors: string[] } {
  const errors: string[] = [];
  const responses: Gdt01ExpectedResponse[] = [];
  const data = isRecord(fixture) ? fixture : {};
  const fixtureMembers = Array.isArray(data.members) ? data.members : [];

  if (data.schema_version !== "gdt_01_team_dynamics_explicit_answers_v1") {
    errors.push("Explicit fixture schema_version is not canonical.");
  }
  if (data.team_id !== GDT_01_TEAM_ID) errors.push("Explicit fixture team_id is not GDT-01.");
  if (data.contract_identity !== GDT_01_PACKAGE_SLUG) errors.push("Explicit fixture contract identity is not final runtime.");
  if (data.contract_checksum !== GDT_01_RUNTIME_CHECKSUM) errors.push("Explicit fixture checksum differs from locked runtime checksum.");
  if (data.canonical_persistence_input !== true || data.db_writer_input_allowed !== true || data.recipe_inference_required !== false) {
    errors.push("Explicit fixture is not marked as canonical persistence input.");
  }
  if (data.ai_prompt_calibration_allowed !== false) errors.push("GDT-01 fixture is not calibration-blocked.");
  if (fixtureMembers.length !== GDT_01_COUNTS.members) errors.push("Explicit fixture member count is not six.");

  const expectedIds = new Set<string>(GDT_01_EXPECTED_MEMBER_IDS);
  const seenMemberIds = new Set<string>();
  for (const memberValue of fixtureMembers) {
    const member = isRecord(memberValue) ? memberValue : {};
    const candidateId = asString(member.candidate_id);
    if (!expectedIds.has(candidateId)) errors.push(`Unexpected GDT-01 member: ${candidateId || "<missing>"}.`);
    if (seenMemberIds.has(candidateId)) errors.push(`Duplicate GDT-01 member: ${candidateId}.`);
    seenMemberIds.add(candidateId);

    const memberResponses = Array.isArray(member.responses) ? member.responses : [];
    if (memberResponses.length !== GDT_01_COUNTS.responsesPerMember) {
      errors.push(`${candidateId || "Unknown member"} does not contain 48 responses.`);
    }
    const seenQuestions = new Set<string>();
    for (const responseValue of memberResponses) {
      const response = isRecord(responseValue) ? responseValue : {};
      const questionCode = asString(response.question_code);
      const responseType = response.response_type;
      if (seenQuestions.has(questionCode)) errors.push(`Duplicate question ${candidateId}/${questionCode}.`);
      seenQuestions.add(questionCode);
      if (responseType !== "likert_single" && responseType !== "sjt_best_worst") {
        errors.push(`Unsupported response type ${candidateId}/${questionCode}.`);
        continue;
      }
      const normalized: Gdt01ExpectedResponse = {
        candidateId,
        questionCode,
        questionOrder: Number(response.question_order),
        blockCode: asString(response.block_code),
        responseType,
      };
      if (responseType === "likert_single") {
        normalized.optionCode = asString(response.option_code);
        normalized.optionValue = asNumberOrString(response.option_value);
      } else {
        normalized.bestOptionCode = asString(response.best_option_code);
        normalized.worstOptionCode = asString(response.worst_option_code);
      }
      responses.push(normalized);
    }
  }
  for (const expectedId of GDT_01_EXPECTED_MEMBER_IDS) {
    if (!seenMemberIds.has(expectedId)) errors.push(`Missing GDT-01 member: ${expectedId}.`);
  }

  if (runtimeSnapshot) {
    const runtimeQuestions = new Map(runtimeSnapshot.questions.map((question) => [question.code, question]));
    if (runtimeSnapshot.questions.length !== GDT_01_COUNTS.questionsPerMember) {
      errors.push("Runtime snapshot does not contain 48 questions.");
    }
    for (const response of responses) {
      const question = runtimeQuestions.get(response.questionCode);
      if (!question) {
        errors.push(`Unknown runtime question ${response.questionCode}.`);
        continue;
      }
      const options = new Map(question.options.map((option) => [option.code, option]));
      if (response.responseType === "likert_single") {
        const option = options.get(response.optionCode ?? "");
        if (!option || option.value !== response.optionValue) {
          errors.push(`Invalid canonical Likert option ${response.candidateId}/${response.questionCode}.`);
        }
      } else {
        const best = options.get(response.bestOptionCode ?? "");
        const worst = options.get(response.worstOptionCode ?? "");
        if (!best || !worst) errors.push(`Invalid canonical SJT option ${response.candidateId}/${response.questionCode}.`);
        if (response.bestOptionCode === response.worstOptionCode) errors.push(`SJT best/worst pair is identical ${response.candidateId}/${response.questionCode}.`);
      }
    }
  }

  const membersById = new Set(members.map((member) => member.candidateId));
  for (const response of responses) {
    if (!membersById.has(response.candidateId)) errors.push(`Response belongs to unknown member ${response.candidateId}.`);
  }
  return { responses, errors: [...new Set(errors)] };
}

export function buildGdt01DbContract(input: {
  fixture: unknown;
  memberRows: Array<Record<string, string>>;
  runtimeSnapshot: unknown;
}): Gdt01DbContract {
  const members = input.memberRows.map((row) => ({
    candidateId: row.candidate_id,
    displayName: row.display_name,
    jobTitle: row.job_title,
    email: row.email,
    cohortSegment: row.development_or_holdout,
    expectedParticipationState: row.expected_participation_state,
    deterministicVerificationAllowed: row.deterministic_verification_allowed === "true",
    aiPromptCalibrationAllowed: row.ai_prompt_calibration_allowed === "true",
  }));
  const runtimeValidation = validateRuntimeContractSnapshot(input.runtimeSnapshot);
  const runtimeSnapshot = runtimeValidation.state === "VALID" ? input.runtimeSnapshot as RuntimeContractSnapshot : null;
  const fixtureValidation = buildFixtureValidation(input.fixture, members, runtimeSnapshot);
  return {
    organizationName: GDT_01_ORGANIZATION_NAME,
    teamId: GDT_01_TEAM_ID,
    teamName: GDT_01_TEAM_NAME,
    packageSlug: GDT_01_PACKAGE_SLUG,
    legacyPackageSlug: GDT_01_LEGACY_PACKAGE_SLUG,
    runtimeChecksum: GDT_01_RUNTIME_CHECKSUM,
    lifecycle: GDT_01_SEED_LIFECYCLE,
    counts: GDT_01_COUNTS,
    members,
    responses: fixtureValidation.responses,
    runtimeSnapshot,
    runtimeValidationErrors: runtimeValidation.errors,
    fixtureValidationErrors: fixtureValidation.errors,
  };
}

export function loadGdt01DbContract(projectRoot: string): Gdt01DbContract {
  const fixturePath = path.join(projectRoot, "fixtures/golden-demo/partner-plus/v1/team-dynamics-gdt-01-answers.json");
  const membersPath = path.join(projectRoot, "fixtures/golden-demo/partner-plus/v1/team-dynamics-gdt-01-members.csv");
  const runtimePath = path.join(projectRoot, "fixtures/golden-demo/contracts/team-dynamics-assessment-v1-runtime.json");
  return buildGdt01DbContract({
    fixture: readJson(fixturePath),
    memberRows: readCsv(membersPath),
    runtimeSnapshot: readJson(runtimePath),
  });
}

export function buildOfflineObservedRuntime(snapshot: RuntimeContractSnapshot): Gdt01ObservedRuntime {
  const testId = `test:${snapshot.test.slug}`;
  const questions = snapshot.questions.map((question) => ({
    id: `question:${question.code}`,
    testId,
    code: question.code,
    order: question.order,
    questionType: question.question_type,
    required: question.required,
    isActive: true,
    metadata: question.metadata,
  }));
  const options = snapshot.questions.flatMap((question) => question.options.map((option) => ({
    id: `option:${question.code}:${option.code}`,
    questionId: `question:${question.code}`,
    code: option.code,
    value: option.value,
    order: option.order,
    metadata: option.metadata,
  })));
  return {
    test: {
      id: testId,
      slug: snapshot.test.slug,
      status: snapshot.test.status,
      isActive: snapshot.test.is_active,
      scoringMethod: snapshot.test.scoring_method,
      metadata: snapshot.test.metadata,
    },
    questions,
    options,
    snapshot,
    snapshotErrors: validateRuntimeContractSnapshot(snapshot).errors,
  };
}

export function buildEmptyGdt01ObservedState(): Gdt01ObservedState {
  return {
    organizations: [],
    teams: [],
    participants: [],
    memberships: [],
    runtime: null,
    assignments: [],
    wrappers: [],
    attempts: [],
    responses: [],
    selections: [],
    dimensionScoreIds: [],
    memberScoreIds: [],
    aggregationIds: [],
    reportSelectionDraftIds: [],
    reportSelectionMemberIds: [],
    teamReportIds: [],
    attemptReportIds: [],
    teamFitReports: [],
    ambientAssignments: [],
  };
}

function finding(
  code: string,
  message: string,
  entity?: string,
  expected?: unknown,
  observed?: unknown,
): Gdt01ContractFinding {
  return {
    code,
    message,
    category: findingCategory(code),
    ...(entity ? { entity } : {}),
    ...(expected !== undefined ? { expected } : {}),
    ...(observed !== undefined ? { observed } : {}),
  };
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function addUnique(target: Gdt01ContractFinding[], item: Gdt01ContractFinding): void {
  if (!target.some((existing) => existing.code === item.code && existing.entity === item.entity && existing.message === item.message)) {
    target.push(item);
  }
}

function findingCategory(code: string): Gdt01ContractFinding["category"] {
  if (
    new Set([
      "organization_missing",
      "organization_duplicate",
      "organization_inactive",
      "team_missing",
      "team_duplicate",
      "team_organization_mismatch",
      "team_archived",
      "participant_missing",
      "participant_duplicate",
      "participant_organization_mismatch",
      "participant_identity_mismatch",
      "participant_inactive",
      "membership_missing",
      "membership_duplicate",
      "membership_inactive",
    ]).has(code)
  ) {
    return "foundation";
  }
  if (code === "canonical_contract_invalid" || code.startsWith("runtime_")) return "runtime";
  if (
    code.startsWith("response") ||
    code.startsWith("sjt_") ||
    code.startsWith("orphan_target_") ||
    code.startsWith("seed_") ||
    code === "physical_selection_count_mismatch"
  ) {
    return "target_persistence";
  }
  return "target_graph";
}

export function classifyGdt01DbState(
  contract: Gdt01DbContract,
  observed: Gdt01ObservedState,
): Gdt01InspectionResult {
  const conflicts: Gdt01ContractFinding[] = [];
  const partials: Gdt01ContractFinding[] = [];
  const diagnostics: Array<{ code: string; message: string; entity?: string }> = [];

  for (const error of [...contract.runtimeValidationErrors, ...contract.fixtureValidationErrors]) {
    addUnique(conflicts, finding("canonical_contract_invalid", error, "contract"));
  }
  if (!observed.runtime) {
    addUnique(conflicts, finding("runtime_missing", "Canonical runtime observation is missing.", "tests"));
  } else {
    if (!observed.runtime.test || observed.runtime.test.slug !== GDT_01_PACKAGE_SLUG) {
      addUnique(conflicts, finding("runtime_slug_mismatch", "Observed runtime is not the canonical final Team Dynamics test.", "tests", GDT_01_PACKAGE_SLUG, observed.runtime.test?.slug ?? null));
    }
    if (observed.runtime.snapshot?.checksum !== GDT_01_RUNTIME_CHECKSUM) {
      addUnique(conflicts, finding("runtime_checksum_mismatch", "Observed runtime checksum differs from the locked contract.", "tests", GDT_01_RUNTIME_CHECKSUM, observed.runtime.snapshot?.checksum ?? null));
    }
    if (observed.runtime.snapshotErrors.length > 0) {
      for (const error of observed.runtime.snapshotErrors) addUnique(conflicts, finding("runtime_contract_invalid", error, "tests"));
    }
    if (observed.runtime.questions.filter((question) => question.isActive).length !== GDT_01_COUNTS.questionsPerMember) {
      addUnique(conflicts, finding("runtime_question_count_mismatch", "Observed active runtime does not contain 48 questions.", "questions", GDT_01_COUNTS.questionsPerMember, observed.runtime.questions.filter((question) => question.isActive).length));
    }
  }

  const organizations = observed.organizations.filter((organization) => organization.name === GDT_01_ORGANIZATION_NAME);
  if (organizations.length === 0) {
    addUnique(partials, finding("organization_missing", "Canonical organization was not found.", "organizations"));
  } else if (organizations.length > 1) {
    addUnique(conflicts, finding("organization_duplicate", "Multiple canonical organizations were found.", "organizations", 1, organizations.length));
  }
  const organization = organizations[0] ?? null;
  if (organization && organization.status !== "active") {
    addUnique(conflicts, finding("organization_inactive", "Canonical organization is not active.", "organizations", "active", organization.status));
  }

  const teams = observed.teams.filter((team) => team.name === GDT_01_TEAM_NAME);
  if (teams.length === 0) {
    addUnique(partials, finding("team_missing", "Canonical GDT-01 team was not found.", "teams"));
  } else if (teams.length > 1) {
    addUnique(conflicts, finding("team_duplicate", "Multiple canonical GDT-01 teams were found.", "teams", 1, teams.length));
  }
  const team = teams[0] ?? null;
  if (team && organization && team.organizationId !== organization.id) {
    addUnique(conflicts, finding("team_organization_mismatch", "GDT-01 team belongs to a different organization.", "teams", organization.id, team.organizationId));
  }
  if (team && team.archivedAt !== null) addUnique(conflicts, finding("team_archived", "GDT-01 team is archived.", "teams"));

  const expectedMemberById = new Map(contract.members.map((member) => [member.candidateId, member]));
  const participantById = new Map(observed.participants.map((participant) => [participant.id, participant]));
  const participantByEmail = new Map(observed.participants.map((participant) => [normalizedEmail(participant.email), participant]));
  const targetParticipants = new Map<string, Gdt01ObservedParticipant>();
  for (const expectedMember of contract.members) {
    const sameEmailParticipants = observed.participants.filter((participant) => normalizedEmail(participant.email) === normalizedEmail(expectedMember.email));
    if (sameEmailParticipants.length > 1) addUnique(conflicts, finding("participant_duplicate", `Multiple participants match canonical member ${expectedMember.candidateId}.`, "participants", 1, sameEmailParticipants.length));
    const participant = participantByEmail.get(normalizedEmail(expectedMember.email));
    if (!participant) {
      addUnique(partials, finding("participant_missing", `Participant ${expectedMember.candidateId} was not found by canonical email.`, "participants", expectedMember.email));
      continue;
    }
    targetParticipants.set(expectedMember.candidateId, participant);
    if (organization && participant.organizationId !== organization.id) addUnique(conflicts, finding("participant_organization_mismatch", `Participant ${expectedMember.candidateId} belongs to another organization.`, "participants", organization.id, participant.organizationId));
    if (normalizedName(participant.fullName) !== normalizedName(expectedMember.displayName)) addUnique(conflicts, finding("participant_identity_mismatch", `Participant ${expectedMember.candidateId} name differs from the canonical fixture.`, "participants", expectedMember.displayName, participant.fullName));
    if (participant.status !== "active") addUnique(conflicts, finding("participant_inactive", `Participant ${expectedMember.candidateId} is not active.`, "participants", "active", participant.status));
  }

  const membershipsByParticipant = new Map<string, Gdt01ObservedMembership[]>();
  for (const membership of observed.memberships) {
    membershipsByParticipant.set(membership.participantId, [...(membershipsByParticipant.get(membership.participantId) ?? []), membership]);
  }
  const targetMemberships = new Map<string, Gdt01ObservedMembership>();
  for (const [candidateId, participant] of targetParticipants) {
    const memberships = (membershipsByParticipant.get(participant.id) ?? []).filter((membership) => !team || membership.teamId === team.id);
    if (memberships.length === 0) {
      addUnique(partials, finding("membership_missing", `Active GDT-01 membership is missing for ${candidateId}.`, "team_memberships"));
      continue;
    }
    if (memberships.length > 1) addUnique(conflicts, finding("membership_duplicate", `Multiple GDT-01 memberships exist for ${candidateId}.`, "team_memberships", 1, memberships.length));
    const membership = memberships[0];
    targetMemberships.set(candidateId, membership);
    if (!membership.isActive || membership.leftAt !== null) addUnique(conflicts, finding("membership_inactive", `GDT-01 membership is not active for ${candidateId}.`, "team_memberships"));
  }

  const targetTeamId = team?.id ?? null;
  const targetAssignments = observed.assignments.filter((assignment) => assignment.teamId === targetTeamId && assignment.packageSlug === GDT_01_PACKAGE_SLUG);
  const nonCanonicalTargetAssignments = observed.assignments.filter((assignment) => assignment.teamId === targetTeamId && assignment.packageSlug !== GDT_01_PACKAGE_SLUG);
  if (targetAssignments.length > 1) addUnique(conflicts, finding("assignment_duplicate", "More than one canonical target assignment exists.", "team_assessment_assignments", 1, targetAssignments.length));
  if (nonCanonicalTargetAssignments.length > 0) {
    for (const assignment of nonCanonicalTargetAssignments) {
      addUnique(conflicts, finding("noncanonical_target_assignment", "A noncanonical assignment occupies the GDT-01 target team space.", "team_assessment_assignments", GDT_01_PACKAGE_SLUG, assignment.packageSlug));
    }
  }
  const assignment = targetAssignments[0] ?? null;
  if (assignment) {
    if (assignment.status !== contract.lifecycle.assignmentStatus) addUnique(conflicts, finding("assignment_status_mismatch", "Canonical assignment has an unexpected seed status.", "team_assessment_assignments", contract.lifecycle.assignmentStatus, assignment.status));
  }

  const targetParticipantIds = new Set([...targetParticipants.values()].map((participant) => participant.id));
  const targetAssignmentIds = new Set(targetAssignments.map((item) => item.id));
  const allAssignments = [...observed.assignments, ...observed.ambientAssignments];
  const targetLikeAssignmentIds = new Set(
    allAssignments
      .filter(
        (candidate) =>
          (candidate.packageSlug === GDT_01_PACKAGE_SLUG || candidate.packageSlug === GDT_01_LEGACY_PACKAGE_SLUG) &&
          (candidate.teamId === targetTeamId || observed.wrappers.some((wrapper) => wrapper.assignmentId === candidate.id && targetParticipantIds.has(wrapper.participantId))),
      )
      .map((candidate) => candidate.id),
  );
  const wrappers = observed.wrappers.filter((wrapper) => targetAssignmentIds.has(wrapper.assignmentId));
  const targetLikeWrappers = observed.wrappers.filter((wrapper) => targetLikeAssignmentIds.has(wrapper.assignmentId));
  for (const wrapper of targetLikeWrappers) {
    if (targetParticipantIds.has(wrapper.participantId) && !targetAssignmentIds.has(wrapper.assignmentId)) {
      addUnique(conflicts, finding("orphan_target_wrapper", "Target participant has a wrapper outside the canonical GDT-01 assignment.", "team_assessment_participants", undefined, wrapper.id));
    }
  }
  const wrappersByCandidate = new Map<string, Gdt01ObservedWrapper>();
  for (const wrapper of wrappers) {
    const participant = participantById.get(wrapper.participantId);
    const candidateId = contract.members.find((member) => participant && normalizedEmail(member.email) === normalizedEmail(participant.email))?.candidateId;
    if (!candidateId) {
      addUnique(conflicts, finding("wrapper_unknown_participant", "Target wrapper points to an unknown participant.", "team_assessment_participants", undefined, wrapper.participantId));
      continue;
    }
    if (wrappersByCandidate.has(candidateId)) addUnique(conflicts, finding("wrapper_duplicate", `Duplicate wrapper exists for ${candidateId}.`, "team_assessment_participants"));
    wrappersByCandidate.set(candidateId, wrapper);
    const membership = targetMemberships.get(candidateId);
    if (!membership || wrapper.membershipId !== membership.id) addUnique(conflicts, finding("wrapper_membership_mismatch", `Wrapper membership differs for ${candidateId}.`, "team_assessment_participants"));
    if (wrapper.status !== contract.lifecycle.wrapperStatus || wrapper.startedAt !== null || wrapper.completedAt !== null) addUnique(conflicts, finding("wrapper_lifecycle_mismatch", `Wrapper lifecycle differs for ${candidateId}.`, "team_assessment_participants", contract.lifecycle.wrapperStatus, wrapper.status));
  }
  if (assignment) {
    for (const member of contract.members) if (!wrappersByCandidate.has(member.candidateId)) addUnique(partials, finding("wrapper_missing", `Expected wrapper is missing for ${member.candidateId}.`, "team_assessment_participants"));
    for (const wrapper of wrappers) if (wrapper.participantId && ![...targetParticipants.values()].some((participant) => participant.id === wrapper.participantId)) addUnique(conflicts, finding("wrapper_extra", "Extra wrapper exists in the canonical target assignment.", "team_assessment_participants"));
  } else if (wrappers.length > 0) addUnique(conflicts, finding("orphan_wrapper", "Wrapper rows exist without a canonical target assignment.", "team_assessment_participants"));

  const attemptIds = new Set<string>();
  for (const wrapper of wrappers) {
    if (!wrapper.attemptId) {
      addUnique(partials, finding("attempt_link_missing", "Target wrapper has no linked attempt.", "team_assessment_participants", "non-null", null));
      continue;
    }
    attemptIds.add(wrapper.attemptId);
    const attempt = observed.attempts.find((item) => item.id === wrapper.attemptId);
    const candidateId = [...wrappersByCandidate.entries()].find(([, value]) => value.id === wrapper.id)?.[0] ?? null;
    if (!attempt) {
      addUnique(partials, finding("attempt_missing", `Linked attempt is missing for ${candidateId ?? wrapper.id}.`, "attempts"));
      continue;
    }
    if (attempt.testSlug !== GDT_01_PACKAGE_SLUG) addUnique(conflicts, finding("attempt_test_slug_mismatch", `Attempt uses a noncanonical Team Dynamics slug for ${candidateId ?? wrapper.id}.`, "attempts", GDT_01_PACKAGE_SLUG, attempt.testSlug));
    if (!observed.runtime?.test || attempt.testId !== observed.runtime.test.id) addUnique(conflicts, finding("attempt_test_id_mismatch", `Attempt is not linked to the canonical runtime test for ${candidateId ?? wrapper.id}.`, "attempts"));
    if (organization && attempt.organizationId !== organization.id) addUnique(conflicts, finding("attempt_organization_mismatch", `Attempt organization differs for ${candidateId ?? wrapper.id}.`, "attempts"));
    const participant = candidateId ? targetParticipants.get(candidateId) : null;
    if (participant && attempt.participantId !== participant.id) addUnique(conflicts, finding("attempt_participant_mismatch", `Attempt participant differs for ${candidateId}.`, "attempts"));
    if (attempt.locale !== contract.lifecycle.locale) addUnique(conflicts, finding("attempt_locale_mismatch", `Attempt locale differs for ${candidateId ?? wrapper.id}.`, "attempts", contract.lifecycle.locale, attempt.locale));
    if (attempt.status !== contract.lifecycle.attemptStatus || attempt.completedAt !== null) addUnique(conflicts, finding("attempt_lifecycle_mismatch", `Attempt lifecycle differs for ${candidateId ?? wrapper.id}.`, "attempts", contract.lifecycle.attemptStatus, attempt.status));
  }
  const targetLikeAttemptIds = new Set(attemptIds);
  for (const wrapper of targetLikeWrappers) {
    if (wrapper.attemptId) {
      targetLikeAttemptIds.add(wrapper.attemptId);
    }
  }
  for (const attempt of observed.attempts) {
    if (
      targetParticipantIds.has(attempt.participantId ?? "") &&
      (attempt.testId === observed.runtime?.test?.id ||
        attempt.testSlug === GDT_01_PACKAGE_SLUG ||
        attempt.testSlug === GDT_01_LEGACY_PACKAGE_SLUG)
    ) {
      targetLikeAttemptIds.add(attempt.id);
    }
  }
  for (const attempt of observed.attempts) {
    if (targetLikeAttemptIds.has(attempt.id) && !attemptIds.has(attempt.id)) addUnique(conflicts, finding("orphan_target_attempt", "Target participant has a Team Dynamics attempt not linked to a target wrapper.", "attempts", undefined, attempt.id));
  }

  const questionById = new Map((observed.runtime?.questions ?? []).map((question) => [question.id, question]));
  const optionById = new Map((observed.runtime?.options ?? []).map((option) => [option.id, option]));
  const expectedResponseByCandidate = new Map<string, Map<string, Gdt01ExpectedResponse>>();
  for (const response of contract.responses) expectedResponseByCandidate.set(response.candidateId, new Map([...(expectedResponseByCandidate.get(response.candidateId)?.entries() ?? []), [response.questionCode, response]]));
  const responseById = new Map<string, Gdt01ObservedResponse>();
  const selectionsByResponse = new Map<string, Gdt01ObservedSelection[]>();
  for (const selection of observed.selections) selectionsByResponse.set(selection.responseId, [...(selectionsByResponse.get(selection.responseId) ?? []), selection]);
  const targetResponses = observed.responses.filter((response) => attemptIds.has(response.attemptId));
  for (const response of observed.responses) {
    if (!attemptIds.has(response.attemptId) && targetLikeAttemptIds.has(response.attemptId)) {
      addUnique(conflicts, finding("orphan_target_response", "Target participant has a response not linked to a canonical target wrapper.", "responses", undefined, response.id));
    }
  }
  const responseIdentity = new Map<string, string>();
  for (const response of targetResponses) {
    if (responseById.has(response.id)) addUnique(conflicts, finding("response_duplicate_id", "Duplicate response id observed.", "responses", undefined, response.id));
    const identity = `${response.attemptId}\u0000${response.questionId}`;
    if (responseIdentity.has(identity)) addUnique(conflicts, finding("response_duplicate_question", "More than one response exists for the same attempt/question identity.", "responses", undefined, identity));
    responseIdentity.set(identity, response.id);
    responseById.set(response.id, response);
    const question = questionById.get(response.questionId);
    const candidateId = [...wrappersByCandidate.entries()].find(([, wrapper]) => wrapper.attemptId === response.attemptId)?.[0] ?? null;
    const expectedMap = candidateId ? expectedResponseByCandidate.get(candidateId) : null;
    const expected = expectedMap?.get(response.questionCode ?? "");
    if (!question || !expected) {
      addUnique(conflicts, finding("unknown_response_question", "Response points to an unknown or extra canonical question.", "responses", undefined, response.questionCode ?? response.questionId));
      continue;
    }
    if (question.code !== response.questionCode) addUnique(conflicts, finding("response_question_mismatch", "Response question id/code mapping is inconsistent.", "responses", question.code, response.questionCode));
    if (response.responseKind !== (expected.responseType === "likert_single" ? "single_choice" : "best_worst")) addUnique(conflicts, finding("response_kind_mismatch", `Response kind differs for ${candidateId}/${expected.questionCode}.`, "responses", expected.responseType === "likert_single" ? "single_choice" : "best_worst", response.responseKind));
    if (response.rawValue !== null || response.scoredValue !== null) addUnique(conflicts, finding("seed_scoring_value_present", "Seed response contains raw or scored value.", "responses", { rawValue: null, scoredValue: null }, { rawValue: response.rawValue, scoredValue: response.scoredValue }));
    const responseSelections = selectionsByResponse.get(response.id) ?? [];
    if (expected.responseType === "likert_single") {
      if (response.answerOptionId === null || response.optionQuestionId !== question.id || response.optionCode !== expected.optionCode || response.optionValue !== expected.optionValue) addUnique(conflicts, finding("likert_option_mismatch", `Likert option differs for ${candidateId}/${expected.questionCode}.`, "responses", { questionId: question.id, optionCode: expected.optionCode }, { questionId: response.optionQuestionId, optionCode: response.optionCode }));
      if (responseSelections.length > 0) addUnique(conflicts, finding("likert_selection_extra", `Likert response has unexpected response_selections rows for ${candidateId}/${expected.questionCode}.`, "response_selections"));
    } else {
      if (response.answerOptionId !== null) addUnique(conflicts, finding("sjt_response_option_present", `SJT response must not use answer_option_id for ${candidateId}/${expected.questionCode}.`, "responses", null, response.answerOptionId));
      const roles = new Map<string, Gdt01ObservedSelection[]>();
      for (const selection of responseSelections) roles.set(selection.selectionRole ?? "<null>", [...(roles.get(selection.selectionRole ?? "<null>") ?? []), selection]);
      const hasDuplicateOrExtraRole = responseSelections.length > 2 || [...roles.entries()].some(([role, roleRows]) => role !== "best" && role !== "worst" || roleRows.length > 1);
      if (hasDuplicateOrExtraRole) addUnique(conflicts, finding("sjt_selection_duplicate_or_extra", `SJT response has duplicate or extra selection roles for ${candidateId}/${expected.questionCode}.`, "response_selections", { best: 1, worst: 1 }, responseSelections.map((selection) => selection.selectionRole)));
      else if (responseSelections.length !== 2 || roles.get("best")?.length !== 1 || roles.get("worst")?.length !== 1) addUnique(partials, finding("sjt_selection_pair_missing", `SJT response does not have exactly one best and one worst selection for ${candidateId}/${expected.questionCode}.`, "response_selections", { best: 1, worst: 1 }, responseSelections.map((selection) => selection.selectionRole)));
      const best = roles.get("best")?.[0];
      const worst = roles.get("worst")?.[0];
      if (best && (best.optionQuestionId !== question.id || best.optionCode !== expected.bestOptionCode || best.questionCode !== expected.questionCode)) addUnique(conflicts, finding("sjt_best_option_mismatch", `SJT best option differs for ${candidateId}/${expected.questionCode}.`, "response_selections", { questionId: question.id, optionCode: expected.bestOptionCode }, { questionId: best.optionQuestionId, optionCode: best.optionCode }));
      if (worst && (worst.optionQuestionId !== question.id || worst.optionCode !== expected.worstOptionCode || worst.questionCode !== expected.questionCode)) addUnique(conflicts, finding("sjt_worst_option_mismatch", `SJT worst option differs for ${candidateId}/${expected.questionCode}.`, "response_selections", { questionId: question.id, optionCode: expected.worstOptionCode }, { questionId: worst.optionQuestionId, optionCode: worst.optionCode }));
      if (best && worst && best.answerOptionId === worst.answerOptionId) addUnique(conflicts, finding("sjt_same_option", `SJT best and worst use the same option for ${candidateId}/${expected.questionCode}.`, "response_selections"));
    }
  }
  for (const attemptId of attemptIds) {
    const candidateId = [...wrappersByCandidate.entries()].find(([, wrapper]) => wrapper.attemptId === attemptId)?.[0] ?? null;
    const expectedMap = candidateId ? expectedResponseByCandidate.get(candidateId) : null;
    const actualResponses = targetResponses.filter((response) => response.attemptId === attemptId);
    if (actualResponses.length !== GDT_01_COUNTS.responsesPerMember) addUnique(partials, finding("response_count_mismatch", `Expected 48 responses for ${candidateId ?? attemptId}.`, "responses", GDT_01_COUNTS.responsesPerMember, actualResponses.length));
    for (const questionCode of expectedMap?.keys() ?? []) if (!actualResponses.some((response) => response.questionCode === questionCode)) addUnique(partials, finding("response_missing", `Expected response is missing for ${candidateId}/${questionCode}.`, "responses"));
  }
  const targetSelections = observed.selections.filter((selection) => responseById.has(selection.responseId));
  const targetLikeResponseIds = new Set(observed.responses.filter((response) => targetLikeAttemptIds.has(response.attemptId)).map((response) => response.id));
  for (const selection of observed.selections) {
    if (targetLikeResponseIds.has(selection.responseId) && !responseById.has(selection.responseId)) {
      addUnique(conflicts, finding("orphan_target_selection", "Target participant has a selection not attached to a canonical target response.", "response_selections", undefined, selection.id));
    }
  }
  if (targetSelections.length !== GDT_01_COUNTS.totalPhysicalSjtSelections && attemptIds.size === GDT_01_COUNTS.members) addUnique(partials, finding("physical_selection_count_mismatch", "Total physical SJT selection count differs from the canonical seed graph.", "response_selections", GDT_01_COUNTS.totalPhysicalSjtSelections, targetSelections.length));
  const logicalSelections = targetResponses.reduce((count, response) => count + (response.responseKind === "single_choice" ? 1 : 0), 0) + targetSelections.length;

  if (observed.memberScoreIds.length > 0 || observed.dimensionScoreIds.length > 0) addUnique(conflicts, finding("seed_score_artifact", "Seed target contains score artifacts.", "scores"));
  if (observed.aggregationIds.length > 0) addUnique(conflicts, finding("seed_aggregation_artifact", "Seed target contains aggregation artifacts.", "team_assessment_aggregation_snapshots"));
  if (observed.reportSelectionDraftIds.length > 0 || observed.reportSelectionMemberIds.length > 0) addUnique(conflicts, finding("seed_report_selection_artifact", "Seed target contains report selection artifacts.", "team_assessment_report_selection_drafts"));
  if (observed.teamReportIds.length > 0) addUnique(conflicts, finding("seed_team_report_artifact", "Seed target contains Team Dynamics report artifacts.", "team_assessment_reports"));
  if (observed.attemptReportIds.length > 0) addUnique(conflicts, finding("seed_attempt_report_artifact", "Seed target contains attempt report artifacts.", "attempt_reports"));

  for (const report of observed.teamFitReports) {
    if (report.lineage === "direct") addUnique(conflicts, finding("direct_team_fit_artifact", "A directly target-linked Team Fit report exists.", "team_fit_reports", "none", report.id));
    else diagnostics.push({ code: "ambient_team_fit_report", message: "Team Fit report exists without proven target assignment lineage.", entity: report.id });
  }
  for (const ambientAssignment of observed.ambientAssignments) diagnostics.push({ code: "ambient_team_dynamics_assignment", message: "Unrelated Team Dynamics assignment exists in the same organization but outside GDT-01.", entity: ambientAssignment.id });

  const hasTargetGraph = targetAssignments.length > 0 || wrappers.length > 0 || attemptIds.size > 0 || targetResponses.length > 0 || targetSelections.length > 0;
  let state: Gdt01InspectionResult["state"];
  if (conflicts.length > 0) state = "CONFLICT";
  else if (partials.length > 0) state = "PARTIAL";
  else if (!hasTargetGraph) state = "EMPTY";
  else if (assignment && wrappersByCandidate.size === GDT_01_COUNTS.members && attemptIds.size === GDT_01_COUNTS.members && targetResponses.length === GDT_01_COUNTS.totalResponses && targetSelections.length === GDT_01_COUNTS.totalPhysicalSjtSelections && logicalSelections === GDT_01_COUNTS.totalLogicalSelections) state = "EXACT_MATCH";
  else state = "PARTIAL";

  const blockingFindings = [...conflicts, ...partials];
  return {
    target: {
      organization: GDT_01_ORGANIZATION_NAME,
      teamId: GDT_01_TEAM_ID,
      packageSlug: GDT_01_PACKAGE_SLUG,
      runtimeChecksum: GDT_01_RUNTIME_CHECKSUM,
    },
    state,
    writerEligible: state === "EMPTY" && blockingFindings.length === 0,
    counts: {
      membersExpected: GDT_01_COUNTS.members,
      wrappersObserved: wrappers.length,
      attemptsObserved: attemptIds.size,
      responsesExpected: GDT_01_COUNTS.totalResponses,
      responsesObserved: targetResponses.length,
      physicalSjtSelectionsExpected: GDT_01_COUNTS.totalPhysicalSjtSelections,
      physicalSjtSelectionsObserved: targetSelections.length,
      logicalSelectionsExpected: GDT_01_COUNTS.totalLogicalSelections,
      logicalSelectionsObserved: logicalSelections,
    },
    blockingFindings,
    diagnosticFindings: diagnostics,
    safety: {
      readOnly: true,
      databaseWrites: false,
      rpcCalls: false,
      scoringExecuted: false,
      aggregationExecuted: false,
      reportsGenerated: false,
      openaiCalled: false,
    },
  };
}

export function loadGdt01DbContractFromRepo(projectRoot: string): Gdt01DbContract {
  return loadGdt01DbContract(projectRoot);
}
