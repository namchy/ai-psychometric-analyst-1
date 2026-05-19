const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
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
  if (request === "server-only" || request === "@/lib/supabase/admin") {
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

const {
  buildTeamDynamicsCreatePlan,
  buildTeamDynamicsRunReadiness,
  createTeamDynamicsAssessmentForTeam,
  TEAM_DYNAMICS_TEST_NOT_READY,
  TeamDynamicsTestNotReadyError,
} = require("../lib/assessment/team-assessments.ts");
const { TEAM_DYNAMICS_TEST_SLUG } = require("../lib/assessment/team-dynamics.ts");

const baseTeam = {
  id: "team-1",
  organization_id: "org-1",
  archived_at: null,
};

const memberships = [
  {
    id: "membership-1",
    team_id: "team-1",
    participant_id: "participant-1",
    is_active: true,
    left_at: null,
    participants: {
      id: "participant-1",
      organization_id: "org-1",
      user_id: "user-1",
      addressing_form: "feminine",
      status: "active",
    },
  },
  {
    id: "membership-2",
    team_id: "team-1",
    participant_id: "participant-2",
    is_active: true,
    left_at: null,
    participants: {
      id: "participant-2",
      organization_id: "org-1",
      user_id: null,
      addressing_form: null,
      status: "active",
    },
  },
];

const createPlan = buildTeamDynamicsCreatePlan({
  organizationId: "org-1",
  team: baseTeam,
  memberships,
  createdByUserId: "hr-user-1",
  testId: "test-team-dynamics",
  locale: "bs",
  createdAt: "2026-05-19T11:00:00.000Z",
});

assert.equal(createPlan.assignment.mode, "create");
assert.deepEqual(createPlan.assignment.insert, {
  team_id: "team-1",
  package_slug: TEAM_DYNAMICS_TEST_SLUG,
  status: "active",
  created_by_user_id: "hr-user-1",
  opened_at: "2026-05-19T11:00:00.000Z",
  closed_at: null,
});
assert.equal(createPlan.participantInserts.length, 2);
assert.equal(createPlan.attemptInserts.length, 2);
assert.equal(createPlan.attemptTargets.length, 2);
assert.deepEqual(
  createPlan.participantInserts.map((row) => row.team_membership_id),
  ["membership-1", "membership-2"],
);
assert.deepEqual(
  createPlan.attemptInserts.map((row) => row.participant_id),
  ["participant-1", "participant-2"],
);

const reusePlan = buildTeamDynamicsCreatePlan({
  organizationId: "org-1",
  team: baseTeam,
  memberships,
  createdByUserId: "hr-user-1",
  testId: "test-team-dynamics",
  locale: "bs",
  createdAt: "2026-05-19T11:00:00.000Z",
  existingActiveAssignment: {
    id: "assignment-1",
    team_id: "team-1",
    package_slug: TEAM_DYNAMICS_TEST_SLUG,
    status: "active",
  },
  existingParticipants: [
    {
      id: "tap-1",
      team_assessment_assignment_id: "assignment-1",
      team_membership_id: "membership-1",
      participant_id: "participant-1",
      attempt_id: "attempt-1",
      status: "invited",
      invited_at: "2026-05-19T11:00:00.000Z",
      started_at: null,
      completed_at: null,
    },
  ],
});

assert.equal(reusePlan.assignment.mode, "reuse");
assert.equal(reusePlan.assignment.insert, null);
assert.equal(reusePlan.assignment.existingAssignmentId, "assignment-1");
assert.deepEqual(reusePlan.participantInserts, [
  {
    team_assessment_assignment_id: "assignment-1",
    team_membership_id: "membership-2",
    participant_id: "participant-2",
    status: "invited",
    invited_at: "2026-05-19T11:00:00.000Z",
  },
]);
assert.deepEqual(reusePlan.attemptTargets, [
  {
    team_membership_id: "membership-2",
    participant_id: "participant-2",
  },
]);
assert.deepEqual(reusePlan.attemptInserts, [
  {
    test_id: "test-team-dynamics",
    user_id: null,
    organization_id: "org-1",
    participant_id: "participant-2",
    locale: "bs",
    addressing_form_snapshot: "masculine",
    status: "in_progress",
    started_at: "2026-05-19T11:00:00.000Z",
  },
]);

assert.deepEqual(
  buildTeamDynamicsRunReadiness({
    test: null,
    activeQuestionIds: [],
  }),
  {
    isReady: false,
    testId: null,
    activeQuestionIds: [],
    questionIdsWithOptions: [],
    questionIdsMissingOptions: [],
    failureCode: TEAM_DYNAMICS_TEST_NOT_READY,
    reason: "test_missing",
  },
);

assert.deepEqual(
  buildTeamDynamicsRunReadiness({
    test: {
      id: "test-team-dynamics",
      slug: TEAM_DYNAMICS_TEST_SLUG,
      status: "active",
      is_active: true,
    },
    activeQuestionIds: ["question-1"],
    questionIdsWithOptions: [],
  }),
  {
    isReady: false,
    testId: "test-team-dynamics",
    activeQuestionIds: ["question-1"],
    questionIdsWithOptions: [],
    questionIdsMissingOptions: ["question-1"],
    failureCode: TEAM_DYNAMICS_TEST_NOT_READY,
    reason: "missing_question_options",
  },
);

assert.deepEqual(
  buildTeamDynamicsRunReadiness({
    test: {
      id: "test-team-dynamics",
      slug: TEAM_DYNAMICS_TEST_SLUG,
      status: "active",
      is_active: true,
    },
    activeQuestionIds: ["question-1"],
    questionIdsWithOptions: ["question-1"],
  }),
  {
    isReady: true,
    testId: "test-team-dynamics",
    activeQuestionIds: ["question-1"],
    questionIdsWithOptions: ["question-1"],
    questionIdsMissingOptions: [],
    failureCode: null,
    reason: null,
  },
);

function createSupabaseStub(config) {
  const operations = [];
  const createdParticipants = [];
  const createdAttempts = [];

  function matchesFilters(row, filters) {
    return filters.every((filter) => {
      const value = row[filter.column];

      if (filter.type === "eq") {
        return value === filter.value;
      }

      if (filter.type === "is") {
        return value === filter.value;
      }

      if (filter.type === "in") {
        return filter.value.includes(value);
      }

      return true;
    });
  }

  function resolveRead(table, filters) {
    switch (table) {
      case "tests": {
        const test = config.test ?? null;
        const rows = test ? [test] : [];
        return rows.filter((row) => matchesFilters(row, filters));
      }
      case "questions": {
        const rows = config.questions ?? [];
        return rows.filter((row) => matchesFilters(row, filters));
      }
      case "answer_options": {
        const rows = config.answerOptions ?? [];
        return rows.filter((row) => matchesFilters(row, filters));
      }
      case "teams": {
        const rows = config.team ? [config.team] : [];
        return rows.filter((row) => matchesFilters(row, filters));
      }
      case "team_memberships": {
        const rows = config.memberships ?? [];
        return rows.filter((row) => matchesFilters(row, filters));
      }
      case "team_assessment_assignments": {
        const rows = config.existingAssignments ?? [];
        return rows.filter((row) => matchesFilters(row, filters));
      }
      case "team_assessment_participants": {
        const rows = [...(config.existingParticipants ?? []), ...createdParticipants];
        return rows.filter((row) => matchesFilters(row, filters));
      }
      default:
        throw new Error(`Unhandled read table ${table}`);
    }
  }

  function createQuery(table) {
    const state = {
      table,
      filters: [],
      mutation: null,
      payload: null,
    };

    const query = {
      select() {
        return this;
      },
      eq(column, value) {
        state.filters.push({ type: "eq", column, value });
        return this;
      },
      is(column, value) {
        state.filters.push({ type: "is", column, value });
        return this;
      },
      in(column, value) {
        state.filters.push({ type: "in", column, value });
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      insert(payload) {
        state.mutation = "insert";
        state.payload = payload;
        operations.push({ type: "insert", table, payload });
        return this;
      },
      update(payload) {
        state.mutation = "update";
        state.payload = payload;
        operations.push({ type: "update", table, payload });
        return this;
      },
      delete() {
        state.mutation = "delete";
        operations.push({ type: "delete", table });
        return this;
      },
      maybeSingle() {
        const rows = resolveRead(table, state.filters);
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      single() {
        return this._execute().then((result) => ({
          data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
          error: result.error,
        }));
      },
      _execute() {
        if (state.mutation === "insert") {
          if (table === "team_assessment_assignments") {
            return Promise.resolve({ data: [{ id: "assignment-created-1" }], error: null });
          }

          if (table === "team_assessment_participants") {
            const rows = state.payload.map((row, index) => ({
              id: `team-participant-${index + 1}`,
              attempt_id: null,
              started_at: null,
              completed_at: null,
              ...row,
            }));
            createdParticipants.push(...rows);
            return Promise.resolve({ data: rows, error: null });
          }

          if (table === "attempts") {
            const rows = state.payload.map((row, index) => ({
              id: `attempt-${index + 1}`,
              participant_id: row.participant_id,
            }));
            createdAttempts.push(...rows);
            return Promise.resolve({ data: rows, error: null });
          }
        }

        if (state.mutation === "update") {
          if (table === "team_assessment_participants") {
            const target = createdParticipants.find((row) => matchesFilters(row, state.filters));

            if (target) {
              Object.assign(target, state.payload);
            }
          }

          return Promise.resolve({ data: [], error: null });
        }

        if (state.mutation === "delete") {
          return Promise.resolve({ data: [], error: null });
        }

        return Promise.resolve({ data: resolveRead(table, state.filters), error: null });
      },
      then(resolve, reject) {
        return this._execute().then(resolve, reject);
      },
    };

    return query;
  }

  return {
    operations,
    createdParticipants,
    createdAttempts,
    from(table) {
      return createQuery(table);
    },
  };
}

async function expectNotReady(config, expectedReason) {
  const supabase = createSupabaseStub(config);

  await assert.rejects(
    () =>
      createTeamDynamicsAssessmentForTeam({
        organizationId: "org-1",
        teamId: "team-1",
        createdByUserId: "hr-user-1",
        locale: "bs",
        supabase,
      }),
    (error) => {
      assert.equal(error instanceof TeamDynamicsTestNotReadyError, true);
      assert.equal(error.code, TEAM_DYNAMICS_TEST_NOT_READY);
      assert.match(error.message, new RegExp(expectedReason));
      return true;
    },
  );

  assert.equal(
    supabase.operations.some(
      (operation) =>
        operation.table === "team_assessment_assignments" ||
        operation.table === "team_assessment_participants" ||
        operation.table === "attempts",
    ),
    false,
  );
}

async function main() {
  await expectNotReady(
    {
      test: null,
    },
    "imported",
  );

  await expectNotReady(
    {
      test: {
        id: "test-team-dynamics",
        slug: TEAM_DYNAMICS_TEST_SLUG,
        status: "active",
        is_active: true,
      },
      questions: [],
    },
    "missing_active_questions",
  );

  const readySupabase = createSupabaseStub({
    test: {
      id: "test-team-dynamics",
      slug: TEAM_DYNAMICS_TEST_SLUG,
      status: "active",
      is_active: true,
    },
    questions: [{ id: "question-1", test_id: "test-team-dynamics", is_active: true }],
    answerOptions: [{ question_id: "question-1" }],
    team: baseTeam,
    memberships,
    existingAssignments: [],
    existingParticipants: [],
  });

  const createResult = await createTeamDynamicsAssessmentForTeam({
    organizationId: "org-1",
    teamId: "team-1",
    createdByUserId: "hr-user-1",
    locale: "bs",
    supabase: readySupabase,
  });

  assert.deepEqual(createResult, {
    assignmentId: "assignment-created-1",
    assignmentAction: "created",
    participantsCreated: 2,
    attemptsCreated: 2,
    attemptMappingsCreated: 2,
  });
  assert.equal(
    readySupabase.operations.filter((operation) => operation.type === "insert").length >= 3,
    true,
  );

  const source = fs.readFileSync(
    path.join(projectRoot, "lib", "assessment", "team-assessments.ts"),
    "utf8",
  );
  assert.match(source, /if \(plan\.assignment\.mode === "create"\)/);
  assert.match(source, /if \(plan\.participantInserts\.length > 0\)/);
  assert.match(source, /if \(plan\.attemptInserts\.length > 0\)/);
  assert.match(source, /assignmentAction: createdAssignment \? "created" : "reused"/);
  assert.match(source, /TEAM_DYNAMICS_TEST_NOT_READY/);
  assert.match(source, /assertTeamDynamicsRunReadiness\(readiness\);[\s\S]+return readiness\.testId;/);

  console.log("Team Dynamics create flow helper tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
