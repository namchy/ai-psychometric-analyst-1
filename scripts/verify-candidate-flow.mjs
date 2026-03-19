import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { encodeReply } from "next/dist/compiled/react-server-dom-webpack/client.edge.js";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3100";
const HEALTH_URL = `${APP_URL}/api/health`;
const EXPECTED_ACTIVE_TEST_SLUG = "ipip50-hr-v1";
const ACCESS_COOKIE_NAME = "sb-access-token";
const REFRESH_COOKIE_NAME = "sb-refresh-token";
const PROTECTED_RUN_CHUNK_PATH =
  "/_next/static/chunks/app/(protected)/app/attempts/%5BattemptId%5D/run/page.js";

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    fail(message);
  }
}

function assertVisibleQuestion(html, expectedQuestionNumber, expectedQuestionText, message) {
  const match = html.match(
    /<p class="assessment-step-card__kicker">Pitanje\s*(?:<!-- -->)?(\d+)<\/p><h3>([^<]+)<\/h3>/,
  );

  if (!match) {
    fail(`Unable to parse the visible protected run question. ${message}`);
  }

  const [, renderedQuestionNumber, renderedQuestionText] = match;
  if (
    Number(renderedQuestionNumber) !== expectedQuestionNumber ||
    renderedQuestionText !== expectedQuestionText
  ) {
    fail(
      `${message} Expected visible question ${expectedQuestionNumber} (${expectedQuestionText}), received ${renderedQuestionNumber} (${renderedQuestionText}).`,
    );
  }
}

async function waitForServer() {
  let lastDetail = `No response from ${HEALTH_URL}.`;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(HEALTH_URL);

      if (response.ok) {
        return;
      }

      lastDetail = `HTTP ${response.status} from ${HEALTH_URL}.`;
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error);
    }

    await delay(1000);
  }

  fail(`Next.js server did not become ready at ${HEALTH_URL}. Last check: ${lastDetail}`);
}

async function waitForSupabase(supabaseUrl, serviceRoleKey) {
  const healthUrl = `${supabaseUrl}/rest/v1/tests?select=id&limit=1`;
  let lastDetail = `No response from ${healthUrl}.`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(healthUrl, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });

      if (response.ok) {
        return;
      }

      lastDetail = `HTTP ${response.status} from ${healthUrl}.`;
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error);
    }

    await delay(500);
  }

  fail(`Local Supabase did not become reachable at ${supabaseUrl}. Last check: ${lastDetail}`);
}

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    fail(`Missing required env var: ${name}.`);
  }

  return value;
}

function getCookieHeader(session) {
  return `${ACCESS_COOKIE_NAME}=${session.access_token}; ${REFRESH_COOKIE_NAME}=${session.refresh_token}`;
}

async function fetchProtectedPage(pathname, session, init = {}) {
  const response = await fetch(`${APP_URL}${pathname}`, {
    redirect: "manual",
    ...init,
    headers: {
      cookie: getCookieHeader(session),
      ...(init.headers ?? {}),
    },
  });

  return response;
}

async function fetchProtectedHtml(pathname, session) {
  const response = await fetchProtectedPage(pathname, session);

  if (!response.ok) {
    fail(`Request to ${pathname} failed with status ${response.status}.`);
  }

  return response.text();
}

async function loadProtectedRunActionIds() {
  const response = await fetch(`${APP_URL}${PROTECTED_RUN_CHUNK_PATH}`);

  if (!response.ok) {
    fail(`Unable to load protected run chunk: HTTP ${response.status}.`);
  }

  const chunk = await response.text();
  const match = chunk.match(/__next_internal_action_entry_do_not_use__\s+(\{[^}]+\})/);

  if (!match) {
    fail("Unable to discover protected run action ids from the client chunk.");
  }

  const actionEntries = JSON.parse(match[1]);
  const actionIdsByName = Object.fromEntries(
    Object.entries(actionEntries).map(([actionId, actionName]) => [actionName, actionId]),
  );

  const saveActionId = actionIdsByName.saveProtectedAssessmentProgress;
  const completeActionId = actionIdsByName.completeProtectedAssessmentAttempt;

  if (!saveActionId || !completeActionId) {
    fail("Protected save/complete action ids are missing from the client chunk.");
  }

  return {
    saveActionId,
    completeActionId,
  };
}

function parseServerActionResult(payload) {
  const resultLine = payload
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("1:"));

  if (!resultLine) {
    fail(`Unable to parse server action result payload: ${payload.slice(0, 400)}.`);
  }

  return JSON.parse(resultLine.slice(2));
}

async function invokeProtectedServerAction(pathname, session, actionId, input) {
  const body = await encodeReply([input]);
  const response = await fetchProtectedPage(pathname, session, {
    method: "POST",
    headers: {
      Accept: "text/x-component",
      "Next-Action": actionId,
    },
    body,
  });

  if (!response.ok) {
    fail(`Protected server action ${actionId} failed with status ${response.status}.`);
  }

  return parseServerActionResult(await response.text());
}

async function createPasswordUser(serviceSupabase, email, password) {
  const { data, error } = await serviceSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    fail(`Unable to create auth user ${email}: ${error?.message ?? "Unknown error"}`);
  }

  return data.user;
}

async function signInWithPassword(authSupabase, email, password) {
  const { data, error } = await authSupabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    fail(`Unable to sign in verification user ${email}: ${error?.message ?? "Unknown error"}`);
  }

  return data.session;
}

async function loadActiveTest(supabase) {
  const { data, error } = await supabase
    .from("tests")
    .select("id, slug")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    fail(`Unable to load active test: ${error?.message ?? "Unknown error"}`);
  }

  if (data.slug !== EXPECTED_ACTIVE_TEST_SLUG) {
    fail(`Expected active test ${EXPECTED_ACTIVE_TEST_SLUG}, received ${data.slug}.`);
  }

  return data;
}

async function loadRequiredQuestionsWithOptions(supabase, testId) {
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, text, question_type, is_required")
    .eq("test_id", testId)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (questionsError || !questions) {
    fail(`Unable to load active questions: ${questionsError?.message ?? "Unknown error"}`);
  }

  const requiredQuestions = questions.filter((question) => question.is_required);
  const nonTextQuestionIds = requiredQuestions
    .filter((question) => question.question_type !== "text")
    .map((question) => question.id);

  const { data: answerOptions, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("id, question_id, option_order")
    .in("question_id", nonTextQuestionIds)
    .order("question_id", { ascending: true })
    .order("option_order", { ascending: true });

  if (answerOptionsError) {
    fail(`Unable to load answer options: ${answerOptionsError.message}`);
  }

  const answerOptionsByQuestionId = (answerOptions ?? []).reduce((grouped, option) => {
    const questionOptions = grouped.get(option.question_id) ?? [];
    questionOptions.push(option);
    grouped.set(option.question_id, questionOptions);
    return grouped;
  }, new Map());

  return { requiredQuestions, answerOptionsByQuestionId };
}

async function insertSingleChoiceResponse(supabase, attemptId, question, answerOptionsByQuestionId, optionIndex = 0) {
  const options = answerOptionsByQuestionId.get(question.id) ?? [];
  const selectedOption = options[optionIndex] ?? options[0];

  if (!selectedOption) {
    fail(`Unable to find answer option for ${question.code}.`);
  }

  const { error } = await supabase.from("responses").insert({
    attempt_id: attemptId,
    question_id: question.id,
    response_kind: "single_choice",
    answer_option_id: selectedOption.id,
  });

  if (error) {
    fail(`Unable to create response for ${question.code}: ${error.message}`);
  }
}

async function fillCompletedAttempt(supabase, attemptId, requiredQuestions, answerOptionsByQuestionId) {
  for (const [index, question] of requiredQuestions.entries()) {
    if (question.question_type !== "single_choice") {
      fail("Candidate verification expects required questions to be single_choice for stable seeding.");
    }

    await insertSingleChoiceResponse(
      supabase,
      attemptId,
      question,
      answerOptionsByQuestionId,
      index % 5,
    );
  }
}

function buildSingleChoiceSelections(requiredQuestions, answerOptionsByQuestionId) {
  return Object.fromEntries(
    requiredQuestions.map((question, index) => {
      if (question.question_type !== "single_choice") {
        fail("Candidate verification expects required questions to be single_choice for stable action coverage.");
      }

      const options = answerOptionsByQuestionId.get(question.id) ?? [];
      const selectedOption = options[index % 5] ?? options[0];

      if (!selectedOption) {
        fail(`Unable to find answer option for ${question.code}.`);
      }

      return [question.id, selectedOption.id];
    }),
  );
}

async function createOrganization(supabase, slug, name) {
  const { data, error } = await supabase
    .from("organizations")
    .insert({ slug, name })
    .select("id")
    .single();

  if (error || !data) {
    fail(`Unable to create verification organization: ${error?.message ?? "Unknown error"}`);
  }

  return data.id;
}

async function createParticipant(supabase, input) {
  const { data, error } = await supabase
    .from("participants")
    .insert(input)
    .select("id")
    .single();

  if (error || !data) {
    fail(`Unable to create verification participant: ${error?.message ?? "Unknown error"}`);
  }

  return data.id;
}

async function createAttempt(supabase, input) {
  const { data, error } = await supabase
    .from("attempts")
    .insert(input)
    .select("id")
    .single();

  if (error || !data) {
    fail(`Unable to create verification attempt: ${error?.message ?? "Unknown error"}`);
  }

  return data.id;
}

async function seedUnavailableReport(supabase, attemptId, testSlug) {
  const { error } = await supabase.from("attempt_reports").upsert({
    attempt_id: attemptId,
    test_slug: testSlug,
    generator_type: "mock",
    generated_at: new Date().toISOString(),
    report_status: "unavailable",
    failure_code: "verification_unavailable",
    failure_reason: "Seeded verification report state.",
    report_snapshot: null,
  });

  if (error) {
    fail(`Unable to seed attempt report for ${attemptId}: ${error.message}`);
  }
}

async function updateAttemptStatus(supabase, attemptId, status) {
  const patch = { status };

  const { error } = await supabase
    .from("attempts")
    .update(patch)
    .eq("id", attemptId);

  if (error) {
    fail(`Unable to update attempt ${attemptId} to ${status}: ${error.message}`);
  }
}

async function loadAttemptResponses(supabase, attemptId) {
  const { data, error } = await supabase
    .from("responses")
    .select("question_id, answer_option_id, text_value")
    .eq("attempt_id", attemptId);

  if (error) {
    fail(`Unable to inspect responses for ${attemptId}: ${error.message}`);
  }

  return data ?? [];
}

async function loadAttemptRecord(supabase, attemptId) {
  const { data, error } = await supabase
    .from("attempts")
    .select("id, status, completed_at")
    .eq("id", attemptId)
    .maybeSingle();

  if (error) {
    fail(`Unable to inspect attempt ${attemptId}: ${error.message}`);
  }

  return data;
}

async function loadDimensionScores(supabase, attemptId) {
  const { data, error } = await supabase
    .from("dimension_scores")
    .select("dimension")
    .eq("attempt_id", attemptId);

  if (error) {
    fail(`Unable to inspect dimension scores for ${attemptId}: ${error.message}`);
  }

  return data ?? [];
}

async function main() {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const authSupabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const createdAttemptIds = [];
  const createdParticipantIds = [];
  const createdOrganizationIds = [];
  const createdUserIds = [];

  try {
    await waitForServer();
    await waitForSupabase(supabaseUrl, serviceRoleKey);

    const activeTest = await loadActiveTest(serviceSupabase);
    const { requiredQuestions, answerOptionsByQuestionId } = await loadRequiredQuestionsWithOptions(
      serviceSupabase,
      activeTest.id,
    );

    assert(requiredQuestions.length > 0, "Active test must contain required questions.");

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const candidateEmail = `candidate-flow-${uniqueSuffix}@example.com`;
    const candidatePassword = `CandidateFlow!${uniqueSuffix}`;
    const outsiderEmail = `candidate-flow-outsider-${uniqueSuffix}@example.com`;
    const outsiderPassword = `CandidateFlowOutsider!${uniqueSuffix}`;

    const candidateUser = await createPasswordUser(serviceSupabase, candidateEmail, candidatePassword);
    const outsiderUser = await createPasswordUser(serviceSupabase, outsiderEmail, outsiderPassword);
    createdUserIds.push(candidateUser.id, outsiderUser.id);

    const organizationId = await createOrganization(
      serviceSupabase,
      `candidate-flow-${uniqueSuffix}`,
      `Candidate Flow Verification ${uniqueSuffix}`,
    );
    createdOrganizationIds.push(organizationId);

    const candidateParticipantId = await createParticipant(serviceSupabase, {
      organization_id: organizationId,
      user_id: candidateUser.id,
      email: candidateEmail,
      full_name: "Candidate Flow Verification",
      participant_type: "candidate",
    });
    const outsiderParticipantId = await createParticipant(serviceSupabase, {
      organization_id: organizationId,
      user_id: outsiderUser.id,
      email: outsiderEmail,
      full_name: "Outsider Verification",
      participant_type: "candidate",
    });
    createdParticipantIds.push(candidateParticipantId, outsiderParticipantId);

    const inProgressAttemptId = await createAttempt(serviceSupabase, {
      test_id: activeTest.id,
      user_id: candidateUser.id,
      organization_id: organizationId,
      participant_id: candidateParticipantId,
      status: "in_progress",
    });
    const protectedFlowAttemptId = await createAttempt(serviceSupabase, {
      test_id: activeTest.id,
      user_id: candidateUser.id,
      organization_id: organizationId,
      participant_id: candidateParticipantId,
      status: "in_progress",
    });
    const notStartedAttemptId = await createAttempt(serviceSupabase, {
      test_id: activeTest.id,
      user_id: candidateUser.id,
      organization_id: organizationId,
      participant_id: candidateParticipantId,
      status: "in_progress",
    });
    const oldCompletedAttemptId = await createAttempt(serviceSupabase, {
      test_id: activeTest.id,
      user_id: candidateUser.id,
      organization_id: organizationId,
      participant_id: candidateParticipantId,
      status: "completed",
      completed_at: "2026-01-10T09:00:00.000Z",
    });
    const latestCompletedAttemptId = await createAttempt(serviceSupabase, {
      test_id: activeTest.id,
      user_id: candidateUser.id,
      organization_id: organizationId,
      participant_id: candidateParticipantId,
      status: "completed",
      completed_at: "2026-02-10T09:00:00.000Z",
    });
    const forbiddenAttemptId = await createAttempt(serviceSupabase, {
      test_id: activeTest.id,
      user_id: outsiderUser.id,
      organization_id: organizationId,
      participant_id: outsiderParticipantId,
      status: "in_progress",
    });

    createdAttemptIds.push(
      inProgressAttemptId,
      protectedFlowAttemptId,
      notStartedAttemptId,
      oldCompletedAttemptId,
      latestCompletedAttemptId,
      forbiddenAttemptId,
    );

    await insertSingleChoiceResponse(
      serviceSupabase,
      inProgressAttemptId,
      requiredQuestions[0],
      answerOptionsByQuestionId,
      3,
    );
    await fillCompletedAttempt(
      serviceSupabase,
      oldCompletedAttemptId,
      requiredQuestions,
      answerOptionsByQuestionId,
    );
    await fillCompletedAttempt(
      serviceSupabase,
      latestCompletedAttemptId,
      requiredQuestions,
      answerOptionsByQuestionId,
    );
    await seedUnavailableReport(serviceSupabase, oldCompletedAttemptId, activeTest.slug);
    await seedUnavailableReport(serviceSupabase, latestCompletedAttemptId, activeTest.slug);

    const candidateSession = await signInWithPassword(authSupabase, candidateEmail, candidatePassword);
    const { saveActionId, completeActionId } = await loadProtectedRunActionIds();
    const { data: candidateMemberships, error: membershipsError } = await serviceSupabase
      .from("organization_memberships")
      .select("id")
      .eq("user_id", candidateUser.id);

    if (membershipsError) {
      fail(`Unable to inspect candidate memberships: ${membershipsError.message}`);
    }

    assert(
      (candidateMemberships ?? []).length === 0,
      "Candidate verification user should not have an active organization membership.",
    );

    const homeWithInProgressHtml = await fetchProtectedHtml("/app", candidateSession);
    assertIncludes(homeWithInProgressHtml, "Candidate Home", "Expected candidate home page to render.");
    assertIncludes(homeWithInProgressHtml, "Dostupne procjene", "Expected multi-attempt state heading to render.");
    assertIncludes(homeWithInProgressHtml, "Nastavi test", "Expected in-progress CTA to render.");
    assertIncludes(homeWithInProgressHtml, "Započni test", "Expected multi-attempt state to list the untouched open attempt.");
    assertIncludes(
      homeWithInProgressHtml,
      `/app/attempts/${inProgressAttemptId}/run`,
      "Expected candidate home to expose the in-progress attempt action.",
    );
    assertIncludes(
      homeWithInProgressHtml,
      `/app/attempts/${notStartedAttemptId}`,
      "Expected candidate home to expose the not-started attempt action when multiple open attempts exist.",
    );

    const introHtml = await fetchProtectedHtml(`/app/attempts/${notStartedAttemptId}`, candidateSession);
    assertIncludes(introHtml, "Spremno za početak", "Expected intro route to render the ready state.");
    assertIncludes(introHtml, "Šta možeš očekivati", "Expected intro route to render the guidance sections.");
    assertIncludes(
      introHtml,
      `/app/attempts/${notStartedAttemptId}/run`,
      "Expected intro route CTA to point to the candidate run route.",
    );

    const protectedRunPath = `/app/attempts/${protectedFlowAttemptId}/run`;
    const protectedRunHtml = await fetchProtectedHtml(protectedRunPath, candidateSession);
    assertIncludes(
      protectedRunHtml,
      "Candidate Flow Verification",
      "Protected run verification should render the candidate shell for a user without organization membership.",
    );
    assertVisibleQuestion(
      protectedRunHtml,
      1,
      requiredQuestions[0].text,
      "Protected run verification should render the first required question before any answers are saved.",
    );

    const protectedSaveResult = await invokeProtectedServerAction(
      protectedRunPath,
      candidateSession,
      saveActionId,
      {
        attemptId: protectedFlowAttemptId,
        testId: activeTest.id,
        selections: {
          [requiredQuestions[0].id]: (answerOptionsByQuestionId.get(requiredQuestions[0].id) ?? [])[2]
            ?.id ?? fail(`Unable to find save option for ${requiredQuestions[0].code}.`),
        },
      },
    );
    assert(
      protectedSaveResult.ok === true,
      `Protected save should succeed for the candidate without organization membership: ${JSON.stringify(protectedSaveResult)}.`,
    );
    assert(
      protectedSaveResult.attemptId === protectedFlowAttemptId,
      "Protected save should keep using the assigned attempt id.",
    );

    const protectedSavedResponses = await loadAttemptResponses(serviceSupabase, protectedFlowAttemptId);
    assert(
      protectedSavedResponses.length === 1 &&
        protectedSavedResponses[0].question_id === requiredQuestions[0].id,
      "Protected save should persist exactly the saved candidate response.",
    );

    const protectedRunAfterRefreshHtml = await fetchProtectedHtml(protectedRunPath, candidateSession);
    assertVisibleQuestion(
      protectedRunAfterRefreshHtml,
      2,
      requiredQuestions[1].text,
      "Refreshing the protected run route should resume on the next unanswered question.",
    );

    const protectedCompletionResult = await invokeProtectedServerAction(
      protectedRunPath,
      candidateSession,
      completeActionId,
      {
        attemptId: protectedFlowAttemptId,
        testId: activeTest.id,
        selections: buildSingleChoiceSelections(requiredQuestions, answerOptionsByQuestionId),
      },
    );
    assert(
      protectedCompletionResult.ok === true,
      `Protected completion should succeed for the candidate without organization membership: ${JSON.stringify(protectedCompletionResult)}.`,
    );
    assert(
      protectedCompletionResult.attemptId === protectedFlowAttemptId,
      "Protected completion should return the assigned attempt id.",
    );

    const completedProtectedAttempt = await loadAttemptRecord(serviceSupabase, protectedFlowAttemptId);
    assert(
      completedProtectedAttempt?.status === "completed" && !!completedProtectedAttempt.completed_at,
      "Protected completion should persist a completed attempt state.",
    );

    const protectedDimensionScores = await loadDimensionScores(serviceSupabase, protectedFlowAttemptId);
    assert(
      protectedDimensionScores.length > 0,
      "Protected completion should persist dimension scores for the completed attempt.",
    );

    const protectedReportHtml = await fetchProtectedHtml(
      `/app/attempts/${protectedFlowAttemptId}/report`,
      candidateSession,
    );
    assertIncludes(
      protectedReportHtml,
      "Izvještaj procjene",
      "Protected completion should land on a readable candidate report route.",
    );
    assertIncludes(
      protectedReportHtml,
      "Pregled dimenzija",
      "Protected report route should render scored dimensions after protected completion.",
    );

    await serviceSupabase.from("attempts").delete().eq("id", protectedFlowAttemptId);

    await updateAttemptStatus(serviceSupabase, inProgressAttemptId, "abandoned");

    const homeWithNotStartedHtml = await fetchProtectedHtml("/app", candidateSession);
    assertIncludes(homeWithNotStartedHtml, "Započni test", "Expected not-started CTA to render.");
    assertIncludes(
      homeWithNotStartedHtml,
      `/app/attempts/${notStartedAttemptId}`,
      "Expected candidate home to fall back to the untouched open attempt.",
    );

    await updateAttemptStatus(serviceSupabase, notStartedAttemptId, "abandoned");

    const homeWithCompletedHtml = await fetchProtectedHtml("/app", candidateSession);
    assertIncludes(homeWithCompletedHtml, "Pogledaj izvještaj", "Expected completed CTA to render.");
    assertIncludes(
      homeWithCompletedHtml,
      `/app/attempts/${latestCompletedAttemptId}/report`,
      "Expected candidate home to fall back to the latest completed attempt when no open work remains.",
    );

    const forbiddenIntroResponse = await fetchProtectedPage(
      `/app/attempts/${forbiddenAttemptId}`,
      candidateSession,
    );
    assert(
      forbiddenIntroResponse.status === 404,
      `Expected forbidden candidate intro route to return 404, received ${forbiddenIntroResponse.status}.`,
    );

    await updateAttemptStatus(serviceSupabase, inProgressAttemptId, "in_progress");

    const runHtml = await fetchProtectedHtml(`/app/attempts/${inProgressAttemptId}/run`, candidateSession);
    assertIncludes(
      runHtml,
      "Candidate Flow Verification",
      "Expected candidate run route to render the candidate assessment shell.",
    );
    assertIncludes(
      runHtml,
      `/app/attempts/${inProgressAttemptId}/report`,
      "Expected candidate run route to use the candidate report redirect path.",
    );

    const reportHtml = await fetchProtectedHtml(
      `/app/attempts/${latestCompletedAttemptId}/report`,
      candidateSession,
    );
    assertIncludes(reportHtml, "Izvještaj procjene", "Expected candidate report route to render the report shell.");
    assertIncludes(reportHtml, "Pregled dimenzija", "Expected candidate report route to render scored results.");

    console.log("Verified candidate flow:");
    console.log("- /app renders empty, single-action and multi-attempt candidate states without becoming a dashboard.");
    console.log("- single-action heuristic remains stable: in-progress with responses, then untouched open attempt, then latest completed report.");
    console.log("- /app/attempts/[attemptId] respects candidate ownership and returns 404 for a foreign attempt.");
    console.log("- a candidate without organization membership can open an assigned protected attempt, save through the protected server action, refresh into persisted progress, and complete successfully.");
    console.log("- /app/attempts/[attemptId]/run renders through the candidate namespace.");
    console.log("- /app/attempts/[attemptId]/report renders through the candidate namespace.");
  } finally {
    if (createdAttemptIds.length > 0) {
      await serviceSupabase.from("attempts").delete().in("id", createdAttemptIds);
    }

    if (createdParticipantIds.length > 0) {
      await serviceSupabase.from("participants").delete().in("id", createdParticipantIds);
    }

    if (createdOrganizationIds.length > 0) {
      await serviceSupabase.from("organizations").delete().in("id", createdOrganizationIds);
    }

    for (const userId of createdUserIds) {
      await serviceSupabase.auth.admin.deleteUser(userId);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
