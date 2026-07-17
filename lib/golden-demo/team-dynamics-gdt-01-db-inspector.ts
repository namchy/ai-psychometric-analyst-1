import fs from "node:fs";

import {
  buildRuntimeContractSnapshot,
  validateRuntimeContractSnapshot,
  type RuntimeContractRow,
} from "./team-dynamics-runtime-contract";
import {
  GDT_01_LEGACY_PACKAGE_SLUG,
  GDT_01_ORGANIZATION_NAME,
  GDT_01_PACKAGE_SLUG,
  GDT_01_TEAM_NAME,
  buildGdt01DbContract,
  classifyGdt01DbState,
  loadGdt01DbContract,
  type Gdt01DbContract,
  type Gdt01ObservedAssignment,
  type Gdt01ObservedState,
  type Gdt01ObservedTeamFitReport,
} from "./team-dynamics-gdt-01-db-contract";

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type ReadQuery<T> = PromiseLike<QueryResult<T>>;

type ReadQueryBuilder<T> = {
  select(columns: string): ReadQueryBuilder<T> & ReadQuery<T>;
  eq(column: string, value: unknown): ReadQueryBuilder<T> & ReadQuery<T>;
  in(column: string, values: unknown[]): ReadQueryBuilder<T> & ReadQuery<T>;
  is(column: string, value: null): ReadQueryBuilder<T> & ReadQuery<T>;
};

export type Gdt01SupabaseReadClient = {
  from<T = Record<string, unknown>>(table: string): ReadQueryBuilder<T>;
};

export type Gdt01ReadRepository = {
  readState(): Promise<Gdt01ObservedState>;
};

type RawTest = {
  id: string;
  slug: string;
  status: string;
  is_active: boolean;
  scoring_method: string | null;
  metadata: unknown;
};

type RawDimension = {
  code: string;
  display_order: number;
  is_active: boolean;
  metadata: unknown;
  test_id: string;
};

type RawQuestion = {
  id: string;
  test_id: string;
  code: string;
  question_order: number;
  question_type: string;
  is_required: boolean;
  is_active: boolean;
  metadata: unknown;
};

type RawOption = {
  id: string;
  question_id: string;
  code: string | null;
  value: number | string | null;
  option_order: number;
  metadata: unknown;
};

type RawOrganization = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type RawTeam = {
  id: string;
  organization_id: string;
  name: string;
  archived_at: string | null;
};

type RawParticipant = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  participant_type: string;
  status: string;
};

type RawMembership = {
  id: string;
  team_id: string;
  participant_id: string;
  is_active: boolean;
  left_at: string | null;
};

type RawAssignment = {
  id: string;
  team_id: string;
  package_slug: string;
  status: string;
};

type RawWrapper = {
  id: string;
  team_assessment_assignment_id: string;
  team_membership_id: string;
  participant_id: string;
  attempt_id: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
};

type RawAttempt = {
  id: string;
  test_id: string;
  user_id: string | null;
  organization_id: string | null;
  participant_id: string | null;
  locale: string | null;
  status: string;
  completed_at: string | null;
};

type RawResponse = {
  id: string;
  attempt_id: string;
  question_id: string;
  response_kind: string | null;
  answer_option_id: string | null;
  raw_value: number | null;
  scored_value: number | null;
};

type RawSelection = {
  response_id: string;
  question_id: string;
  answer_option_id: string;
  selection_role: string | null;
};

type RawTeamFitReport = {
  id: string;
  organization_id: string;
  team_id: string;
  participant_id: string;
  candidate_source_type: string;
  candidate_source_id: string | null;
  team_source_type: string;
  team_source_id: string | null;
};

async function readRows<T>(
  supabase: Gdt01SupabaseReadClient,
  table: string,
  columns: string,
  configure?: (query: ReadQueryBuilder<T>) => ReadQueryBuilder<T> & ReadQuery<T>,
): Promise<T[]> {
  let query = supabase.from<T>(table).select(columns) as ReadQueryBuilder<T> & ReadQuery<T>;
  if (configure) query = configure(query);
  const result = await query;
  if (result.error) throw new Error(`Failed to read ${table}: ${result.error.message}`);
  return result.data ?? [];
}

async function readByIds<T extends { id: string }>(
  supabase: Gdt01SupabaseReadClient,
  table: string,
  columns: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  return readRows<T>(supabase, table, columns, (query) => query.in("id", ids));
}

async function readByForeignKeys<T>(
  supabase: Gdt01SupabaseReadClient,
  table: string,
  columns: string,
  column: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  return readRows<T>(supabase, table, columns, (query) => query.in(column, ids));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function buildObservedRuntime(
  tests: RawTest[],
  dimensions: RawDimension[],
  questions: RawQuestion[],
  options: RawOption[],
): Gdt01ObservedState["runtime"] {
  const finalTests = tests.filter(
    (test) =>
      test.slug === GDT_01_PACKAGE_SLUG &&
      test.status === "active" &&
      test.is_active === true &&
      test.scoring_method === "mixed_v1" &&
      (test.metadata as { assessment_key?: unknown } | null)?.assessment_key === GDT_01_PACKAGE_SLUG,
  );
  const finalTest = finalTests.length === 1 ? finalTests[0] : null;
  if (!finalTest) {
    return {
      test: null,
      questions: [],
      options: [],
      snapshot: null,
      snapshotErrors: ["Expected exactly one active imported final Team Dynamics runtime."],
    };
  }

  const runtimeRows: RuntimeContractRow = {
    test: finalTest,
    dimensions: dimensions.filter((dimension) => dimension.test_id === finalTest.id),
    questions: questions.filter((question) => question.test_id === finalTest.id),
    options: options.filter((option) => questions.some((question) => question.id === option.question_id && question.test_id === finalTest.id)),
  };
  const snapshot = buildRuntimeContractSnapshot(runtimeRows);
  const validation = validateRuntimeContractSnapshot(snapshot);
  const finalQuestions = questions
    .filter((question) => question.test_id === finalTest.id)
    .map((question) => ({
      id: question.id,
      testId: question.test_id,
      code: question.code,
      order: question.question_order,
      questionType: question.question_type,
      required: question.is_required,
      isActive: question.is_active,
      metadata: question.metadata,
    }));
  const finalQuestionIds = new Set(finalQuestions.map((question) => question.id));
  return {
    test: {
      id: finalTest.id,
      slug: finalTest.slug,
      status: finalTest.status,
      isActive: finalTest.is_active,
      scoringMethod: finalTest.scoring_method,
      metadata: finalTest.metadata,
    },
    questions: finalQuestions,
    options: options
      .filter((option) => finalQuestionIds.has(option.question_id))
      .map((option) => ({
        id: option.id,
        questionId: option.question_id,
        code: option.code ?? "",
        value: option.value,
        order: option.option_order,
        metadata: option.metadata,
      })),
    snapshot,
    snapshotErrors: validation.errors,
  };
}

function mapAssignments(assignments: RawAssignment[]): Gdt01ObservedAssignment[] {
  return assignments.map((assignment) => ({
    id: assignment.id,
    teamId: assignment.team_id,
    packageSlug: assignment.package_slug,
    status: assignment.status,
  }));
}

export function createGdt01SupabaseReadRepository(
  supabase: Gdt01SupabaseReadClient,
): Gdt01ReadRepository {
  return {
    async readState(): Promise<Gdt01ObservedState> {
      const tests = await readRows<RawTest>(
        supabase,
        "tests",
        "id, slug, status, is_active, scoring_method, metadata",
        (query) => query.in("slug", [GDT_01_PACKAGE_SLUG, GDT_01_LEGACY_PACKAGE_SLUG]),
      );
      const testIds = unique(tests.map((test) => test.id));
      const dimensions = await readByForeignKeys<RawDimension>(
        supabase,
        "test_dimensions",
        "test_id, code, display_order, is_active, metadata",
        "test_id",
        testIds,
      );
      const questions = await readByForeignKeys<RawQuestion>(
        supabase,
        "questions",
        "id, test_id, code, question_order, question_type, is_required, is_active, metadata",
        "test_id",
        testIds,
      );
      const options = await readByForeignKeys<RawOption>(
        supabase,
        "answer_options",
        "id, question_id, code, value, option_order, metadata",
        "question_id",
        questions.map((question) => question.id),
      );

      const organizations = await readRows<RawOrganization>(
        supabase,
        "organizations",
        "id, name, slug, status",
        (query) => query.eq("name", GDT_01_ORGANIZATION_NAME),
      );
      const organizationIds = unique(organizations.map((organization) => organization.id));
      const teams = await readByForeignKeys<RawTeam>(
        supabase,
        "teams",
        "id, organization_id, name, archived_at",
        "organization_id",
        organizationIds,
      );
      const teamIds = unique(teams.map((team) => team.id));
      const participants = await readByForeignKeys<RawParticipant>(
        supabase,
        "participants",
        "id, organization_id, email, full_name, participant_type, status",
        "organization_id",
        organizationIds,
      );
      const participantIds = unique(participants.map((participant) => participant.id));
      const memberships = await readByForeignKeys<RawMembership>(
        supabase,
        "team_memberships",
        "id, team_id, participant_id, is_active, left_at",
        "team_id",
        teamIds,
      );
      const allAssignments = await readByForeignKeys<RawAssignment>(
        supabase,
        "team_assessment_assignments",
        "id, team_id, package_slug, status",
        "team_id",
        teamIds,
      );
      const assignmentIds = unique(allAssignments.map((assignment) => assignment.id));
      const wrappers = await readByForeignKeys<RawWrapper>(
        supabase,
        "team_assessment_participants",
        "id, team_assessment_assignment_id, team_membership_id, participant_id, attempt_id, status, started_at, completed_at",
        "team_assessment_assignment_id",
        assignmentIds,
      );
      const wrapperAttemptIds = unique(wrappers.map((wrapper) => wrapper.attempt_id ?? ""));
      const attemptsByParticipant = await readByForeignKeys<RawAttempt>(
        supabase,
        "attempts",
        "id, test_id, user_id, organization_id, participant_id, locale, status, completed_at",
        "participant_id",
        participantIds,
      );
      const attemptsByWrapper = await readByIds<RawAttempt>(
        supabase,
        "attempts",
        "id, test_id, user_id, organization_id, participant_id, locale, status, completed_at",
        wrapperAttemptIds,
      );
      const rawAttempts = [...new Map([...attemptsByParticipant, ...attemptsByWrapper].map((attempt) => [attempt.id, attempt])).values()];
      const attemptIds = unique(rawAttempts.map((attempt) => attempt.id));
      const responses = await readByForeignKeys<RawResponse>(
        supabase,
        "responses",
        "id, attempt_id, question_id, response_kind, answer_option_id, raw_value, scored_value",
        "attempt_id",
        attemptIds,
      );
      const responseIds = unique(responses.map((response) => response.id));
      const selections = await readByForeignKeys<RawSelection>(
        supabase,
        "response_selections",
        "response_id, question_id, answer_option_id, selection_role",
        "response_id",
        responseIds,
      );
      const targetAssignmentIds = allAssignments
        .filter((assignment) => assignment.package_slug === GDT_01_PACKAGE_SLUG && teams.some((team) => team.id === assignment.team_id && team.name === GDT_01_TEAM_NAME))
        .map((assignment) => assignment.id);
      const targetWrapperIds = wrappers.filter((wrapper) => targetAssignmentIds.includes(wrapper.team_assessment_assignment_id)).map((wrapper) => wrapper.id);
      const targetAttemptIds = rawAttempts.filter((attempt) => targetWrapperIds.some((wrapperId) => wrappers.find((wrapper) => wrapper.id === wrapperId)?.attempt_id === attempt.id)).map((attempt) => attempt.id);
      const scoreRows = await readByForeignKeys<{ id: string }>(
        supabase,
        "team_assessment_participant_scores",
        "id",
        "team_assessment_participant_id",
        targetWrapperIds,
      );
      const dimensionScoreRows = await readByForeignKeys<{ id: string }>(
        supabase,
        "dimension_scores",
        "id",
        "attempt_id",
        targetAttemptIds,
      );
      const aggregationRows = await readByForeignKeys<{ id: string }>(
        supabase,
        "team_assessment_aggregation_snapshots",
        "id",
        "team_assessment_assignment_id",
        targetAssignmentIds,
      );
      const selectionDraftRows = await readByForeignKeys<{ id: string }>(
        supabase,
        "team_assessment_report_selection_drafts",
        "id",
        "team_assessment_assignment_id",
        targetAssignmentIds,
      );
      const selectionMemberRows = await readByForeignKeys<{ id: string }>(
        supabase,
        "team_assessment_report_selection_members",
        "id",
        "team_assessment_participant_id",
        targetWrapperIds,
      );
      const teamReportRows = await readByForeignKeys<{ id: string }>(
        supabase,
        "team_assessment_reports",
        "id",
        "team_assessment_assignment_id",
        targetAssignmentIds,
      );
      const attemptReportRows = await readByForeignKeys<{ id: string }>(
        supabase,
        "attempt_reports",
        "id",
        "attempt_id",
        targetAttemptIds,
      );
      const teamFitRows = await readByForeignKeys<RawTeamFitReport>(
        supabase,
        "team_fit_reports",
        "id, organization_id, team_id, participant_id, candidate_source_type, candidate_source_id, team_source_type, team_source_id",
        "organization_id",
        organizationIds,
      );
      const targetTeamIds = new Set(teams.filter((team) => team.name === GDT_01_TEAM_NAME).map((team) => team.id));
      const targetAggregationIds = new Set(aggregationRows.map((row) => row.id));
      const targetAttemptIdSet = new Set(targetAttemptIds);
      const teamFitReports: Gdt01ObservedTeamFitReport[] = teamFitRows.map((report) => ({
        id: report.id,
        organizationId: report.organization_id,
        teamId: report.team_id,
        participantId: report.participant_id,
        candidateSourceType: report.candidate_source_type,
        candidateSourceId: report.candidate_source_id,
        teamSourceType: report.team_source_type,
        teamSourceId: report.team_source_id,
        lineage: targetAggregationIds.has(report.team_source_id ?? "") || targetAttemptIdSet.has(report.candidate_source_id ?? "")
          ? "direct"
          : targetTeamIds.has(report.team_id)
            ? "ambient"
            : "unknown",
      }));
      const testSlugById = new Map(tests.map((test) => [test.id, test.slug]));
      const questionById = new Map(questions.map((question) => [question.id, question]));
      const optionById = new Map(options.map((option) => [option.id, option]));
      const runtime = buildObservedRuntime(tests, dimensions, questions, options);
      return {
        organizations: organizations.map((organization) => ({ id: organization.id, name: organization.name, slug: organization.slug, status: organization.status })),
        teams: teams.map((team) => ({ id: team.id, organizationId: team.organization_id, name: team.name, archivedAt: team.archived_at })),
        participants: participants.map((participant) => ({ id: participant.id, organizationId: participant.organization_id, email: participant.email, fullName: participant.full_name, participantType: participant.participant_type, status: participant.status })),
        memberships: memberships.map((membership) => ({ id: membership.id, teamId: membership.team_id, participantId: membership.participant_id, isActive: membership.is_active, leftAt: membership.left_at })),
        runtime,
        assignments: mapAssignments(allAssignments.filter((assignment) => assignment.team_id === (teams.find((team) => team.name === GDT_01_TEAM_NAME)?.id ?? ""))),
        ambientAssignments: mapAssignments(allAssignments.filter((assignment) => !targetTeamIds.has(assignment.team_id))),
        wrappers: wrappers.map((wrapper) => ({ id: wrapper.id, assignmentId: wrapper.team_assessment_assignment_id, membershipId: wrapper.team_membership_id, participantId: wrapper.participant_id, attemptId: wrapper.attempt_id, status: wrapper.status, startedAt: wrapper.started_at, completedAt: wrapper.completed_at })),
        attempts: rawAttempts.map((attempt) => ({ id: attempt.id, testId: attempt.test_id, testSlug: testSlugById.get(attempt.test_id) ?? null, organizationId: attempt.organization_id, participantId: attempt.participant_id, userId: attempt.user_id, locale: attempt.locale, status: attempt.status, completedAt: attempt.completed_at })),
        responses: responses.map((response) => ({ id: response.id, attemptId: response.attempt_id, questionId: response.question_id, questionCode: questionById.get(response.question_id)?.code ?? null, responseKind: response.response_kind, answerOptionId: response.answer_option_id, optionCode: response.answer_option_id ? optionById.get(response.answer_option_id)?.code ?? null : null, optionValue: response.answer_option_id ? optionById.get(response.answer_option_id)?.value ?? null : null, optionQuestionId: response.answer_option_id ? optionById.get(response.answer_option_id)?.question_id ?? null : null, rawValue: response.raw_value, scoredValue: response.scored_value })),
        selections: selections.map((selection, index) => ({ id: `${selection.response_id}:${selection.answer_option_id}:${index}`, responseId: selection.response_id, questionId: selection.question_id, questionCode: questionById.get(selection.question_id)?.code ?? null, answerOptionId: selection.answer_option_id, optionCode: optionById.get(selection.answer_option_id)?.code ?? null, optionQuestionId: optionById.get(selection.answer_option_id)?.question_id ?? null, selectionRole: selection.selection_role })),
        dimensionScoreIds: dimensionScoreRows.map((row) => row.id),
        memberScoreIds: scoreRows.map((row) => row.id),
        aggregationIds: aggregationRows.map((row) => row.id),
        reportSelectionDraftIds: selectionDraftRows.map((row) => row.id),
        reportSelectionMemberIds: selectionMemberRows.map((row) => row.id),
        teamReportIds: teamReportRows.map((row) => row.id),
        attemptReportIds: attemptReportRows.map((row) => row.id),
        teamFitReports,
      };
    },
  };
}

export async function inspectGdt01DbState(input: {
  projectRoot: string;
  repository: Gdt01ReadRepository;
  contract?: Gdt01DbContract;
}) {
  const contract = input.contract ?? loadGdt01DbContract(input.projectRoot);
  const observed = await input.repository.readState();
  return classifyGdt01DbState(contract, observed);
}

export function loadGdt01ContractFromFiles(projectRoot: string): Gdt01DbContract {
  return loadGdt01DbContract(projectRoot);
}

export function buildGdt01ContractFromInputs(input: {
  fixture: unknown;
  memberRows: Array<Record<string, string>>;
  runtimeSnapshot: unknown;
}): Gdt01DbContract {
  return buildGdt01DbContract(input);
}

export function loadEnvFileIfPresent(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const name = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

export function requireEnvironment(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function redactInspectorError(error: unknown, env: NodeJS.ProcessEnv = process.env): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (env[name]) message = message.split(env[name] as string).join(`[${name}]`);
  }
  return message;
}
