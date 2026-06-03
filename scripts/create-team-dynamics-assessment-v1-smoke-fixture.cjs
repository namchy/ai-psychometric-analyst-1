const { createClient } = require("@supabase/supabase-js");

const TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG = "team_dynamics_assessment_v1";
const FIXTURE = {
  organizationName: "TD Mixed Preview Smoke Org",
  organizationSlug: "td-mixed-preview-smoke",
  teamName: "TD Mixed Preview Smoke Team",
  teamDescription: "Final Team Dynamics mixed-format preview smoke fixture",
  hrEmail: "td-mixed-preview-hr@example.test",
  memberAEmail: "td-mixed-preview-member-a@example.test",
  memberBEmail: "td-mixed-preview-member-b@example.test",
  hrName: "TD Mixed Preview HR",
  memberAName: "TD Mixed Preview Member A",
  memberBName: "TD Mixed Preview Member B",
  defaultPassword: "TdMixedPreview123!",
};

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function createAdminSupabaseClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function normalizeAddressingForm(value) {
  return value === "feminine" ? "feminine" : "masculine";
}

function getSmokePassword() {
  return process.env.TEAM_DYNAMICS_SMOKE_PASSWORD || FIXTURE.defaultPassword;
}

function getAppUrl() {
  return (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}

async function listAuthUsersByEmails(supabase, emails) {
  const targetEmails = new Set(emails.map((email) => email.toLowerCase()));
  const usersByEmail = new Map();
  let page = 1;

  while (targetEmails.size > usersByEmail.size && page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    for (const user of data.users) {
      const email = user.email?.toLowerCase();

      if (email && targetEmails.has(email)) {
        usersByEmail.set(email, user);
      }
    }

    if (data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return usersByEmail;
}

async function ensureAuthUser(supabase, input) {
  const password = getSmokePassword();
  const existingUsers = await listAuthUsersByEmails(supabase, [input.email]);
  const existingUser = existingUsers.get(input.email.toLowerCase()) ?? null;

  if (existingUser?.id) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      password,
      user_metadata: {
        ...(existingUser.user_metadata ?? {}),
        role: input.role,
        smoke_fixture: "team_dynamics_assessment_v1",
      },
    });

    if (error || !data?.user?.id) {
      throw new Error(`Failed to update auth user ${input.email}: ${error?.message ?? "unknown error"}`);
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: {
      role: input.role,
      smoke_fixture: "team_dynamics_assessment_v1",
    },
  });

  if (error || !data?.user?.id) {
    throw new Error(`Failed to create auth user ${input.email}: ${error?.message ?? "unknown error"}`);
  }

  return data.user;
}

async function ensureOrganization(supabase) {
  async function loadExistingOrganization() {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug, status")
      .eq("slug", FIXTURE.organizationSlug)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      throw new Error(`Failed to load smoke organization: ${error.message}`);
    }

    return data?.[0] ?? null;
  }

  const existing = await loadExistingOrganization();

  if (existing?.id) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("organizations")
      .update({
        name: FIXTURE.organizationName,
        status: "active",
      })
      .eq("id", existing.id)
      .select("id, name, slug, status")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(`Failed to update smoke organization: ${updateError?.message ?? "unknown error"}`);
    }

    return updatedRows[0];
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("organizations")
    .insert({
      name: FIXTURE.organizationName,
      slug: FIXTURE.organizationSlug,
      status: "active",
    })
    .select("id, name, slug, status")
    .limit(1);

  if (insertError?.message?.includes("organizations_slug_key")) {
    const concurrentRow = await loadExistingOrganization();

    if (concurrentRow?.id) {
      return concurrentRow;
    }
  }

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(`Failed to create smoke organization: ${insertError?.message ?? "unknown error"}`);
  }

  return insertedRows[0];
}

async function ensureOrganizationMembership(supabase, input) {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("id, organization_id, user_id, role, status")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load smoke HR organization membership: ${error.message}`);
  }

  const existing = data?.[0] ?? null;

  if (existing?.id) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("organization_memberships")
      .update({
        role: "hr_admin",
        status: "active",
      })
      .eq("id", existing.id)
      .select("id, organization_id, user_id, role, status")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(
        `Failed to update smoke HR organization membership: ${updateError?.message ?? "unknown error"}`,
      );
    }

    return updatedRows[0];
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("organization_memberships")
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      role: "hr_admin",
      status: "active",
    })
    .select("id, organization_id, user_id, role, status")
    .limit(1);

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(
      `Failed to create smoke HR organization membership: ${insertError?.message ?? "unknown error"}`,
    );
  }

  return insertedRows[0];
}

async function ensureParticipant(supabase, input) {
  const { data, error } = await supabase
    .from("participants")
    .select("id, organization_id, user_id, email, full_name, status, addressing_form")
    .eq("organization_id", input.organizationId)
    .eq("email", input.email)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load smoke participant ${input.email}: ${error.message}`);
  }

  const payload = {
    organization_id: input.organizationId,
    user_id: input.userId,
    email: input.email,
    full_name: input.fullName,
    participant_type: "employee",
    status: "active",
    addressing_form: input.addressingForm,
  };

  if (data?.[0]?.id) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("participants")
      .update(payload)
      .eq("id", data[0].id)
      .select("id, organization_id, user_id, email, full_name, status, addressing_form")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(`Failed to update smoke participant ${input.email}: ${updateError?.message ?? "unknown error"}`);
    }

    return updatedRows[0];
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("participants")
    .insert(payload)
    .select("id, organization_id, user_id, email, full_name, status, addressing_form")
    .limit(1);

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(`Failed to create smoke participant ${input.email}: ${insertError?.message ?? "unknown error"}`);
  }

  return insertedRows[0];
}

async function ensureTeam(supabase, input) {
  const { data, error } = await supabase
    .from("teams")
    .select("id, organization_id, name, description, archived_at")
    .eq("organization_id", input.organizationId)
    .eq("name", FIXTURE.teamName)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load smoke team: ${error.message}`);
  }

  if (data?.[0]?.id) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("teams")
      .update({
        description: FIXTURE.teamDescription,
        created_by_user_id: input.createdByUserId,
        archived_at: null,
      })
      .eq("id", data[0].id)
      .select("id, organization_id, name, description, archived_at")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(`Failed to update smoke team: ${updateError?.message ?? "unknown error"}`);
    }

    return updatedRows[0];
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("teams")
    .insert({
      organization_id: input.organizationId,
      name: FIXTURE.teamName,
      description: FIXTURE.teamDescription,
      created_by_user_id: input.createdByUserId,
    })
    .select("id, organization_id, name, description, archived_at")
    .limit(1);

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(`Failed to create smoke team: ${insertError?.message ?? "unknown error"}`);
  }

  return insertedRows[0];
}

async function ensureTeamMembership(supabase, input) {
  const { data, error } = await supabase
    .from("team_memberships")
    .select("id, team_id, participant_id, role, is_active, left_at")
    .eq("team_id", input.teamId)
    .eq("participant_id", input.participantId)
    .order("joined_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load smoke team membership: ${error.message}`);
  }

  if (data?.[0]?.id) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("team_memberships")
      .update({
        role: input.role,
        is_active: true,
        left_at: null,
      })
      .eq("id", data[0].id)
      .select("id, team_id, participant_id, role, is_active, left_at")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(`Failed to update smoke team membership: ${updateError?.message ?? "unknown error"}`);
    }

    return updatedRows[0];
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("team_memberships")
    .insert({
      team_id: input.teamId,
      participant_id: input.participantId,
      role: input.role,
      is_active: true,
    })
    .select("id, team_id, participant_id, role, is_active, left_at")
    .limit(1);

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(`Failed to create smoke team membership: ${insertError?.message ?? "unknown error"}`);
  }

  return insertedRows[0];
}

async function ensureFinalTestReady(supabase) {
  const { data, error } = await supabase
    .from("tests")
    .select("id, slug, name, status, is_active, scoring_method")
    .eq("slug", TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load final Team Dynamics test: ${error.message}`);
  }

  const test = data?.[0] ?? null;

  if (!test?.id) {
    throw new Error(`Missing test row for slug ${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}.`);
  }

  if (test.scoring_method !== "mixed_v1") {
    throw new Error(
      `Expected ${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG} scoring_method to be mixed_v1, received ${JSON.stringify(test.scoring_method)}.`,
    );
  }

  let finalTest = test;

  if (test.status !== "active" || test.is_active !== true) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("tests")
      .update({
        status: "active",
        is_active: true,
      })
      .eq("id", test.id)
      .select("id, slug, name, status, is_active, scoring_method")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(`Failed to activate final Team Dynamics test: ${updateError?.message ?? "unknown error"}`);
    }

    finalTest = updatedRows[0];
  }

  const { data: questionRows, error: questionError } = await supabase
    .from("questions")
    .select("id")
    .eq("test_id", finalTest.id)
    .eq("is_active", true);

  if (questionError) {
    throw new Error(`Failed to load final Team Dynamics active questions: ${questionError.message}`);
  }

  const questionIds = (questionRows ?? []).map((row) => row.id);

  if (questionIds.length === 0) {
    throw new Error(`Final Team Dynamics test ${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG} has no active questions.`);
  }

  const { data: optionRows, error: optionError } = await supabase
    .from("answer_options")
    .select("question_id")
    .in("question_id", questionIds);

  if (optionError) {
    throw new Error(`Failed to load final Team Dynamics answer options: ${optionError.message}`);
  }

  const questionIdsWithOptions = new Set(
    (optionRows ?? []).flatMap((row) => (row.question_id ? [row.question_id] : [])),
  );
  const missingOptionQuestionIds = questionIds.filter((questionId) => !questionIdsWithOptions.has(questionId));

  if (missingOptionQuestionIds.length > 0) {
    throw new Error(
      `Final Team Dynamics test ${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG} is missing answer options for ${missingOptionQuestionIds.length} active questions.`,
    );
  }

  return {
    ...finalTest,
    activeQuestionCount: questionIds.length,
  };
}

async function ensureFinalAssignment(supabase, input) {
  const { data, error } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug, status, created_by_user_id, opened_at, closed_at")
    .eq("team_id", input.teamId)
    .eq("package_slug", TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load final Team Dynamics smoke assignment: ${error.message}`);
  }

  if (data?.[0]?.id) {
    return data[0];
  }

  const now = new Date().toISOString();
  const { data: insertedRows, error: insertError } = await supabase
    .from("team_assessment_assignments")
    .insert({
      team_id: input.teamId,
      package_slug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
      status: "active",
      created_by_user_id: input.createdByUserId,
      opened_at: now,
      closed_at: null,
    })
    .select("id, team_id, package_slug, status, created_by_user_id, opened_at, closed_at")
    .limit(1);

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(`Failed to create final Team Dynamics smoke assignment: ${insertError?.message ?? "unknown error"}`);
  }

  return insertedRows[0];
}

async function ensureWrapperRows(supabase, input) {
  const { data: existingRows, error: existingError } = await supabase
    .from("team_assessment_participants")
    .select("id, team_assessment_assignment_id, team_membership_id, participant_id, attempt_id, status, started_at, completed_at")
    .eq("team_assessment_assignment_id", input.assignmentId)
    .order("created_at", { ascending: true });

  if (existingError) {
    throw new Error(`Failed to load final Team Dynamics smoke wrappers: ${existingError.message}`);
  }

  const existingByMembershipId = new Map(
    (existingRows ?? []).map((row) => [row.team_membership_id, row]),
  );
  const wrapperInserts = input.memberships
    .filter((membership) => !existingByMembershipId.has(membership.id))
    .map((membership) => ({
      team_assessment_assignment_id: input.assignmentId,
      team_membership_id: membership.id,
      participant_id: membership.participant_id,
      status: "invited",
      invited_at: new Date().toISOString(),
    }));

  if (wrapperInserts.length > 0) {
    const { error: insertError } = await supabase
      .from("team_assessment_participants")
      .insert(wrapperInserts);

    if (insertError) {
      throw new Error(`Failed to create final Team Dynamics smoke wrappers: ${insertError.message}`);
    }
  }

  const { data: reloadedRows, error: reloadError } = await supabase
    .from("team_assessment_participants")
    .select("id, team_assessment_assignment_id, team_membership_id, participant_id, attempt_id, status, started_at, completed_at")
    .eq("team_assessment_assignment_id", input.assignmentId)
    .order("created_at", { ascending: true });

  if (reloadError) {
    throw new Error(`Failed to reload final Team Dynamics smoke wrappers: ${reloadError.message}`);
  }

  for (const row of reloadedRows ?? []) {
    if (row.status !== "invited" || row.started_at !== null || row.completed_at !== null) {
      const { error: resetError } = await supabase
        .from("team_assessment_participants")
        .update({
          status: "invited",
          started_at: null,
          completed_at: null,
        })
        .eq("id", row.id);

      if (resetError) {
        throw new Error(`Failed to reset smoke wrapper ${row.id} to invited: ${resetError.message}`);
      }
    }
  }

  const { data: finalRows, error: finalError } = await supabase
    .from("team_assessment_participants")
    .select("id, team_assessment_assignment_id, team_membership_id, participant_id, attempt_id, status")
    .eq("team_assessment_assignment_id", input.assignmentId)
    .order("created_at", { ascending: true });

  if (finalError) {
    throw new Error(`Failed to load final smoke wrapper state: ${finalError.message}`);
  }

  return finalRows ?? [];
}

async function ensureSmokeAttempts(supabase, input) {
  const wrappers = await ensureWrapperRows(supabase, {
    assignmentId: input.assignmentId,
    memberships: input.memberships,
  });
  const wrappersById = new Map(wrappers.map((wrapper) => [wrapper.id, wrapper]));
  const linkedAttemptIds = wrappers.flatMap((wrapper) => (wrapper.attempt_id ? [wrapper.attempt_id] : []));
  let attemptsById = new Map();

  if (linkedAttemptIds.length > 0) {
    const { data: attemptRows, error: attemptError } = await supabase
      .from("attempts")
      .select("id, test_id, user_id, organization_id, participant_id, locale, status, completed_at")
      .in("id", linkedAttemptIds);

    if (attemptError) {
      throw new Error(`Failed to load linked smoke attempts: ${attemptError.message}`);
    }

    attemptsById = new Map((attemptRows ?? []).map((attempt) => [attempt.id, attempt]));
  }

  for (const membership of input.memberships) {
    const participant = input.participantsById.get(membership.participant_id);
    const wrapper = wrappers.find((entry) => entry.team_membership_id === membership.id) ?? null;

    if (!participant?.id || !wrapper?.id) {
      throw new Error(`Smoke fixture is missing participant/wrapper for membership ${membership.id}.`);
    }

    const linkedAttempt = wrapper.attempt_id ? attemptsById.get(wrapper.attempt_id) ?? null : null;
    const shouldCreateAttempt =
      !linkedAttempt ||
      linkedAttempt.test_id !== input.testId ||
      linkedAttempt.organization_id !== input.organizationId ||
      linkedAttempt.participant_id !== participant.id ||
      linkedAttempt.user_id !== participant.user_id ||
      linkedAttempt.status !== "in_progress" ||
      linkedAttempt.completed_at !== null;

    let finalAttemptId = linkedAttempt?.id ?? null;

    if (shouldCreateAttempt) {
      const { data: insertedRows, error: insertError } = await supabase
        .from("attempts")
        .insert({
          test_id: input.testId,
          user_id: participant.user_id,
          organization_id: input.organizationId,
          participant_id: participant.id,
          locale: "bs",
          addressing_form_snapshot: normalizeAddressingForm(participant.addressing_form),
          status: "in_progress",
          started_at: new Date().toISOString(),
          completed_at: null,
        })
        .select("id")
        .limit(1);

      if (insertError || !insertedRows?.[0]?.id) {
        throw new Error(`Failed to create smoke attempt for participant ${participant.id}: ${insertError?.message ?? "unknown error"}`);
      }

      finalAttemptId = insertedRows[0].id;
    } else if (linkedAttempt?.id) {
      const { error: resetAttemptError } = await supabase
        .from("attempts")
        .update({
          status: "in_progress",
          completed_at: null,
        })
        .eq("id", linkedAttempt.id);

      if (resetAttemptError) {
        throw new Error(`Failed to normalize smoke attempt ${linkedAttempt.id}: ${resetAttemptError.message}`);
      }
    }

    if (!finalAttemptId) {
      throw new Error(`Smoke fixture attempt is missing for wrapper ${wrapper.id}.`);
    }

    if (wrapper.attempt_id !== finalAttemptId) {
      const { error: updateWrapperError } = await supabase
        .from("team_assessment_participants")
        .update({
          attempt_id: finalAttemptId,
          status: "invited",
          started_at: null,
          completed_at: null,
        })
        .eq("id", wrapper.id);

      if (updateWrapperError) {
        throw new Error(`Failed to link smoke attempt ${finalAttemptId} to wrapper ${wrapper.id}: ${updateWrapperError.message}`);
      }
    }
  }

  const { data: finalWrappers, error: wrapperError } = await supabase
    .from("team_assessment_participants")
    .select("id, team_assessment_assignment_id, team_membership_id, participant_id, attempt_id, status")
    .eq("team_assessment_assignment_id", input.assignmentId)
    .order("created_at", { ascending: true });

  if (wrapperError) {
    throw new Error(`Failed to reload smoke wrappers after attempt linking: ${wrapperError.message}`);
  }

  const finalAttemptIds = (finalWrappers ?? []).flatMap((wrapper) => (wrapper.attempt_id ? [wrapper.attempt_id] : []));
  const { data: finalAttempts, error: finalAttemptError } = await supabase
    .from("attempts")
    .select("id, test_id, user_id, organization_id, participant_id, locale, status")
    .in("id", finalAttemptIds)
    .order("started_at", { ascending: true });

  if (finalAttemptError) {
    throw new Error(`Failed to reload smoke attempts after linking: ${finalAttemptError.message}`);
  }

  return {
    wrappers: finalWrappers ?? [],
    attempts: finalAttempts ?? [],
  };
}

async function ensureTeamDynamicsAssessmentV1SmokeFixture() {
  const supabase = createAdminSupabaseClient();
  const hrUser = await ensureAuthUser(supabase, {
    email: FIXTURE.hrEmail,
    role: "hr_admin",
  });
  const memberAUser = await ensureAuthUser(supabase, {
    email: FIXTURE.memberAEmail,
    role: "participant",
  });
  const memberBUser = await ensureAuthUser(supabase, {
    email: FIXTURE.memberBEmail,
    role: "participant",
  });
  const organization = await ensureOrganization(supabase);

  await ensureOrganizationMembership(supabase, {
    organizationId: organization.id,
    userId: hrUser.id,
  });

  const memberAParticipant = await ensureParticipant(supabase, {
    organizationId: organization.id,
    userId: memberAUser.id,
    email: FIXTURE.memberAEmail,
    fullName: FIXTURE.memberAName,
    addressingForm: "feminine",
  });
  const memberBParticipant = await ensureParticipant(supabase, {
    organizationId: organization.id,
    userId: memberBUser.id,
    email: FIXTURE.memberBEmail,
    fullName: FIXTURE.memberBName,
    addressingForm: "masculine",
  });
  const team = await ensureTeam(supabase, {
    organizationId: organization.id,
    createdByUserId: hrUser.id,
  });
  const membershipLead = await ensureTeamMembership(supabase, {
    teamId: team.id,
    participantId: memberAParticipant.id,
    role: "lead",
  });
  const membershipMember = await ensureTeamMembership(supabase, {
    teamId: team.id,
    participantId: memberBParticipant.id,
    role: "member",
  });
  const test = await ensureFinalTestReady(supabase);
  const assignment = await ensureFinalAssignment(supabase, {
    teamId: team.id,
    createdByUserId: hrUser.id,
  });
  const attemptsAndWrappers = await ensureSmokeAttempts(supabase, {
    assignmentId: assignment.id,
    testId: test.id,
    organizationId: organization.id,
    memberships: [membershipLead, membershipMember],
    participantsById: new Map([
      [memberAParticipant.id, memberAParticipant],
      [memberBParticipant.id, memberBParticipant],
    ]),
  });
  const wrappersByMembershipId = new Map(
    attemptsAndWrappers.wrappers.map((wrapper) => [wrapper.team_membership_id, wrapper]),
  );
  const appUrl = getAppUrl();

  const participants = [
    {
      label: "lead",
      fullName: memberAParticipant.full_name,
      email: memberAParticipant.email,
      userId: memberAUser.id,
      participantId: memberAParticipant.id,
      teamMembershipId: membershipLead.id,
      wrapper: wrappersByMembershipId.get(membershipLead.id) ?? null,
    },
    {
      label: "member",
      fullName: memberBParticipant.full_name,
      email: memberBParticipant.email,
      userId: memberBUser.id,
      participantId: memberBParticipant.id,
      teamMembershipId: membershipMember.id,
      wrapper: wrappersByMembershipId.get(membershipMember.id) ?? null,
    },
  ].map((entry) => {
    if (!entry.wrapper?.id) {
      throw new Error(`Smoke fixture wrapper is missing for membership ${entry.teamMembershipId}.`);
    }

    return {
      label: entry.label,
      fullName: entry.fullName,
      email: entry.email,
      userId: entry.userId,
      participantId: entry.participantId,
      teamMembershipId: entry.teamMembershipId,
      teamAssessmentParticipantId: entry.wrapper.id,
      introPath: `/app/team-assessments/${entry.wrapper.id}`,
      runPath: `/app/team-assessments/${entry.wrapper.id}/run`,
      introUrl: `${appUrl}/app/team-assessments/${entry.wrapper.id}`,
      runUrl: `${appUrl}/app/team-assessments/${entry.wrapper.id}/run`,
    };
  });

  return {
    fixtureMode: "dedicated_smoke_fixture",
    appUrl,
    credentials: {
      hr: {
        email: FIXTURE.hrEmail,
        password: getSmokePassword(),
      },
      participants: [
        {
          email: FIXTURE.memberAEmail,
          password: getSmokePassword(),
        },
        {
          email: FIXTURE.memberBEmail,
          password: getSmokePassword(),
        },
      ],
    },
    organization: {
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
    },
    team: {
      id: team.id,
      name: team.name,
      description: team.description,
    },
    assignment: {
      id: assignment.id,
      packageSlug: assignment.package_slug,
      status: assignment.status,
    },
    test: {
      id: test.id,
      slug: test.slug,
      name: test.name,
      status: test.status,
      isActive: test.is_active,
      scoringMethod: test.scoring_method,
      activeQuestionCount: test.activeQuestionCount,
    },
    participants,
  };
}

async function main() {
  const result = await ensureTeamDynamicsAssessmentV1SmokeFixture();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
  ensureTeamDynamicsAssessmentV1SmokeFixture,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
