"use server";

import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUserForAction } from "@/lib/auth/session";
import type { CreateAssessmentModalState } from "@/components/dashboard/create-assessment-modal-state";
import { normalizeAssessmentLocale } from "@/lib/assessment/locale";
import {
  planStandardAssessmentBatteryCreation,
  STANDARD_ASSESSMENT_BATTERY_SLUGS,
  type StandardBatteryExistingAttemptRow,
  type StandardBatteryTestRow,
} from "@/lib/assessment/standard-battery";
import { getActiveOrganizationForUser, getParticipantForOrganization } from "@/lib/b2b/organizations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ParticipantType = "employee" | "candidate";
type ParticipantStatus = "active" | "inactive";
const PARTICIPANT_CREDENTIALS_COOKIE = "participant-provisioning-flash";

function getFieldValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function withOpenAttemptFor(path: string, participantId: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}openAttemptFor=${encodeURIComponent(participantId)}`;
}

function isParticipantType(value: string): value is ParticipantType {
  return value === "employee" || value === "candidate";
}

function isParticipantStatus(value: string): value is ParticipantStatus {
  return value === "active" || value === "inactive";
}

function generateTemporaryPassword(length = 14): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*()-_=+?";
  const allCharacters = `${uppercase}${lowercase}${digits}${symbols}`;

  const requiredCharacters = [
    uppercase[randomInt(0, uppercase.length)],
    lowercase[randomInt(0, lowercase.length)],
    digits[randomInt(0, digits.length)],
    symbols[randomInt(0, symbols.length)],
  ];

  while (requiredCharacters.length < length) {
    requiredCharacters.push(allCharacters[randomInt(0, allCharacters.length)]);
  }

  for (let index = requiredCharacters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [requiredCharacters[index], requiredCharacters[swapIndex]] = [
      requiredCharacters[swapIndex],
      requiredCharacters[index],
    ];
  }

  return requiredCharacters.join("");
}

type CreateParticipantResult =
  | {
      success: true;
      message: string;
      participantId?: string;
      participantName?: string;
      credentials: {
        email: string;
        temporaryPassword: string;
      };
    }
  | {
      success: false;
      message: string;
      credentials?: undefined;
    };

function setParticipantProvisioningCookie(result: CreateParticipantResult) {
  cookies().set(
    PARTICIPANT_CREDENTIALS_COOKIE,
    JSON.stringify(result),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/dashboard",
      maxAge: 180,
    },
  );
}

type ParticipantProvisioningContext = {
  organizationId: string;
};

type ParticipantProvisioningSuccessResult = Extract<CreateParticipantResult, { success: true }> & {
  participantId: string;
  participantName: string;
};

function getCreateParticipantInput(formData: FormData): {
  fullName: string;
  email: string;
  participantType: ParticipantType;
  status: ParticipantStatus;
} {
  const fullName = getFieldValue(formData, "fullName");
  const email = getFieldValue(formData, "email").toLowerCase();
  const participantType = getFieldValue(formData, "participantType") || "candidate";
  const status = getFieldValue(formData, "status") || "active";

  if (!fullName) {
    throw new Error("Ime i prezime je obavezno.");
  }

  if (!email) {
    throw new Error("Email je obavezan.");
  }

  if (!isParticipantType(participantType)) {
    throw new Error("Tip kandidata nije validan.");
  }

  if (!isParticipantStatus(status)) {
    throw new Error("Status kandidata nije validan.");
  }

  return {
    fullName,
    email,
    participantType,
    status,
  };
}

async function createParticipantProvisioningResultForOrganization(
  formData: FormData,
  context: ParticipantProvisioningContext,
): Promise<ParticipantProvisioningSuccessResult> {
  const { fullName, email, participantType, status } = getCreateParticipantInput(formData);
  const supabase = createSupabaseAdminClient();
  const { data: existingParticipant, error: existingParticipantError } = await supabase
    .from("participants")
    .select("id")
    .eq("organization_id", context.organizationId)
    .ilike("email", email)
    .maybeSingle();

  if (existingParticipantError) {
    throw new Error("Nije moguće provjeriti da li kandidat već postoji.");
  }

  if (existingParticipant) {
    throw new Error("Kandidat sa ovom email adresom već postoji u aktivnoj organizaciji.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "participant",
    },
  });

  const authUserId = authData.user?.id;

  if (createUserError || !authUserId) {
    throw new Error(createUserError?.message ?? "Nije moguće kreirati auth korisnika za kandidata.");
  }

  const { data: participantData, error } = await supabase
    .from("participants")
    .insert({
      organization_id: context.organizationId,
      user_id: authUserId,
      full_name: fullName,
      email,
      participant_type: participantType,
      status,
    })
    .select("id")
    .single();

  if (error || !participantData?.id) {
    const { error: rollbackError } = await supabase.auth.admin.deleteUser(authUserId);

    if (rollbackError) {
      throw new Error(
        "Auth korisnik je kreiran, ali participant zapis nije sačuvan i rollback nije uspio. Potrebna je ručna provjera.",
      );
    }

    throw new Error(`Participant zapis nije kreiran: ${error?.message ?? "unknown error"}`);
  }

  return {
    success: true,
    participantId: participantData.id,
    participantName: fullName,
    message: "Kandidat je uspješno kreiran.",
    credentials: {
      email,
      temporaryPassword,
    },
  };
}

async function createStandardAssessmentBatteryForParticipant(params: {
  organizationId: string;
  participantId: string;
  locale: string | null | undefined;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const participant = await getParticipantForOrganization(params.organizationId, params.participantId);

  if (!participant) {
    throw new Error("Kandidat nije pronađen u aktivnoj organizaciji.");
  }

  const { data: batteryTestsData, error: batteryTestsError } = await supabase
    .from("tests")
    .select("id, slug, status, is_active")
    .in("slug", [...STANDARD_ASSESSMENT_BATTERY_SLUGS]);

  if (batteryTestsError) {
    throw new Error(batteryTestsError.message);
  }

  const batteryTests = (batteryTestsData ?? []) as StandardBatteryTestRow[];
  const candidateTests = batteryTests.filter((test) => test.status === "active" && test.is_active === true);

  let activeQuestionTestIds = new Set<string>();

  if (candidateTests.length > 0) {
    const { data: questionRows, error: questionError } = await supabase
      .from("questions")
      .select("test_id")
      .in(
        "test_id",
        candidateTests.map((test) => test.id),
      )
      .eq("is_active", true);

    if (questionError) {
      throw new Error(questionError.message);
    }

    activeQuestionTestIds = new Set((questionRows ?? []).map((row) => String(row.test_id)));
  }

  let existingAttemptsData: StandardBatteryExistingAttemptRow[] = [];

  if (candidateTests.length > 0) {
    const { data, error: existingAttemptsError } = await supabase
      .from("attempts")
      .select("id, test_id, status")
      .eq("organization_id", params.organizationId)
      .eq("participant_id", participant.id)
      .in(
        "test_id",
        candidateTests.map((test) => test.id),
      )
      .in("status", ["in_progress", "completed"]);

    if (existingAttemptsError) {
      throw new Error(existingAttemptsError.message);
    }

    existingAttemptsData = (data ?? []) as StandardBatteryExistingAttemptRow[];
  }

  const batteryPlan = planStandardAssessmentBatteryCreation({
    availableTests: batteryTests,
    activeQuestionTestIds,
    existingAttempts: existingAttemptsData,
    organizationId: params.organizationId,
    participantId: participant.id,
    participantUserId: participant.user_id,
    locale: params.locale,
    startedAt: new Date().toISOString(),
  });

  if (batteryPlan.outcome === "battery-no-runnable-tests") {
    throw new Error("Trenutno nema aktivnih testova spremnih za standardnu procjenu.");
  }

  if (batteryPlan.attemptIdsToAbandon.length > 0) {
    const { error: abandonError } = await supabase
      .from("attempts")
      .update({ status: "abandoned" })
      .in("id", batteryPlan.attemptIdsToAbandon)
      .eq("organization_id", params.organizationId)
      .eq("participant_id", participant.id)
      .eq("status", "in_progress");

    if (abandonError) {
      throw new Error(abandonError.message);
    }
  }

  const { error: insertError } = await supabase.from("attempts").insert(batteryPlan.attemptsToInsert);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function createParticipantProvisioningResult(
  formData: FormData,
): Promise<CreateParticipantResult> {
  const user = await requireAuthenticatedUserForAction();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    redirect("/dashboard?error=no-active-organization");
  }

  let result: ParticipantProvisioningSuccessResult;

  try {
    result = await createParticipantProvisioningResultForOrganization(formData, {
      organizationId: organization.id,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Nije moguće kreirati kandidata.";
    redirect(`/dashboard?error=create-participant-failed&detail=${encodeURIComponent(detail)}`);
  }

  setParticipantProvisioningCookie(result);
  return result;
}

export async function createParticipant(formData: FormData): Promise<void> {
  await createParticipantProvisioningResult(formData);
  redirect("/dashboard?success=participant-created");
}

export async function createCandidateAssessment(
  _previousState: CreateAssessmentModalState,
  formData: FormData,
): Promise<CreateAssessmentModalState> {
  const user = await requireAuthenticatedUserForAction();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    return {
      status: "error",
      message: "Aktivna organizacija nije dostupna za ovaj nalog.",
    };
  }

  try {
    const participantResult = await createParticipantProvisioningResultForOrganization(formData, {
      organizationId: organization.id,
    });

    try {
      await createStandardAssessmentBatteryForParticipant({
        organizationId: organization.id,
        participantId: participantResult.participantId,
        locale: getFieldValue(formData, "locale"),
      });
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? `Kandidat je kreiran, ali procjena nije dodijeljena: ${error.message}`
            : "Kandidat je kreiran, ali procjena nije dodijeljena.",
      };
    }

    revalidatePath("/dashboard");

    return {
      status: "success",
      participantName: participantResult.participantName,
      email: participantResult.credentials.email,
      temporaryPassword: participantResult.credentials.temporaryPassword,
      assignedTests: ["IPIP-NEO-120", "SAFRAN", "MWMS"],
      message: "Procjena je kreirana.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Nije moguće kreirati procjenu.",
    };
  }
}

export async function createAssessmentAttempt(formData: FormData) {
  const user = await requireAuthenticatedUserForAction();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    redirect("/dashboard?error=no-active-organization");
  }

  const participantId = getFieldValue(formData, "participantId");
  const testId = getFieldValue(formData, "testId");
  const locale = normalizeAssessmentLocale(getFieldValue(formData, "locale"));

  if (!participantId) {
    redirect("/dashboard?error=attempt-participant-required");
  }

  if (!testId) {
    redirect(`/dashboard?error=attempt-test-required&openAttemptFor=${encodeURIComponent(participantId)}`);
  }

  const participant = await getParticipantForOrganization(organization.id, participantId);

  if (!participant) {
    redirect(`/dashboard?error=participant-not-found&openAttemptFor=${encodeURIComponent(participantId)}`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: testAccess, error: testAccessError } = await supabase
    .from("organization_test_access")
    .select("test_id")
    .eq("organization_id", organization.id)
    .eq("test_id", testId)
    .maybeSingle();

  if (testAccessError) {
    redirect(
      `/dashboard?error=attempt-test-access-check-failed&openAttemptFor=${encodeURIComponent(participantId)}`,
    );
  }

  if (!testAccess) {
    redirect(`/dashboard?error=attempt-test-not-available&openAttemptFor=${encodeURIComponent(participantId)}`);
  }

  const { error } = await supabase.from("attempts").insert({
    organization_id: organization.id,
    participant_id: participant.id,
    test_id: testId,
    locale,
    user_id: participant.user_id,
    status: "in_progress",
    started_at: new Date().toISOString(),
  });

  if (error) {
    redirect(
      `/dashboard?error=create-attempt-failed&openAttemptFor=${encodeURIComponent(participantId)}&detail=${encodeURIComponent(error.message)}`,
    );
  }

  redirect("/dashboard?success=attempt-created");
}

export async function createStandardAssessmentBattery(formData: FormData) {
  const user = await requireAuthenticatedUserForAction();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    redirect("/dashboard?error=no-active-organization");
  }

  const participantId = getFieldValue(formData, "participantId");
  const rawLocale = getFieldValue(formData, "locale");

  if (!participantId) {
    redirect("/dashboard?error=attempt-participant-required");
  }

  const participant = await getParticipantForOrganization(organization.id, participantId);

  if (!participant) {
    redirect(withOpenAttemptFor("/dashboard?error=participant-not-found", participantId));
  }

  const supabase = createSupabaseAdminClient();
  const { data: batteryTestsData, error: batteryTestsError } = await supabase
    .from("tests")
    .select("id, slug, status, is_active")
    .in("slug", [...STANDARD_ASSESSMENT_BATTERY_SLUGS]);

  if (batteryTestsError) {
    redirect(
      withOpenAttemptFor(
        `/dashboard?error=battery-create-failed&detail=${encodeURIComponent(batteryTestsError.message)}`,
        participantId,
      ),
    );
  }

  const batteryTests = (batteryTestsData ?? []) as StandardBatteryTestRow[];
  const candidateTests = batteryTests.filter(
    (test) => test.status === "active" && test.is_active === true,
  );

  let activeQuestionTestIds = new Set<string>();

  if (candidateTests.length > 0) {
    const { data: questionRows, error: questionError } = await supabase
      .from("questions")
      .select("test_id")
      .in(
        "test_id",
        candidateTests.map((test) => test.id),
      )
      .eq("is_active", true);

    if (questionError) {
      redirect(
        withOpenAttemptFor(
          `/dashboard?error=battery-create-failed&detail=${encodeURIComponent(questionError.message)}`,
          participantId,
        ),
      );
    }

    activeQuestionTestIds = new Set((questionRows ?? []).map((row) => String(row.test_id)));
  }

  let existingAttemptsData: StandardBatteryExistingAttemptRow[] = [];

  if (candidateTests.length > 0) {
    const { data, error: existingAttemptsError } = await supabase
      .from("attempts")
      .select("id, test_id, status")
      .eq("organization_id", organization.id)
      .eq("participant_id", participant.id)
      .in(
        "test_id",
        candidateTests.map((test) => test.id),
      )
      .in("status", ["in_progress", "completed"]);

    if (existingAttemptsError) {
      redirect(
        withOpenAttemptFor(
          `/dashboard?error=battery-create-failed&detail=${encodeURIComponent(existingAttemptsError.message)}`,
          participantId,
        ),
      );
    }

    existingAttemptsData = (data ?? []) as StandardBatteryExistingAttemptRow[];
  }

  const batteryPlan = planStandardAssessmentBatteryCreation({
    availableTests: batteryTests,
    activeQuestionTestIds,
    existingAttempts: existingAttemptsData,
    organizationId: organization.id,
    participantId: participant.id,
    participantUserId: participant.user_id,
    locale: rawLocale,
    startedAt: new Date().toISOString(),
  });

  if (batteryPlan.outcome === "battery-no-runnable-tests") {
    redirect(withOpenAttemptFor("/dashboard?error=battery-no-runnable-tests", participantId));
  }

  if (batteryPlan.attemptIdsToAbandon.length > 0) {
    const { error: abandonError } = await supabase
      .from("attempts")
      .update({ status: "abandoned" })
      .in("id", batteryPlan.attemptIdsToAbandon)
      .eq("organization_id", organization.id)
      .eq("participant_id", participant.id)
      .eq("status", "in_progress");

    if (abandonError) {
      redirect(
        withOpenAttemptFor(
          `/dashboard?error=battery-create-failed&detail=${encodeURIComponent(abandonError.message)}`,
          participantId,
        ),
      );
    }
  }

  const { error: insertError } = await supabase.from("attempts").insert(batteryPlan.attemptsToInsert);

  if (insertError) {
    redirect(
      withOpenAttemptFor(
        `/dashboard?error=battery-create-failed&detail=${encodeURIComponent(insertError.message)}`,
        participantId,
      ),
    );
  }

  redirect(withOpenAttemptFor("/dashboard?success=battery-created", participantId));
}
