import { notFound, redirect } from "next/navigation";
import { SafranPracticeExampleView } from "@/components/assessment/safran-practice-example";
import { getSafranScoredRunHref } from "@/lib/assessment/attempt-lifecycle";
import { getSafranPracticeExample } from "@/lib/assessment/safran-practice";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCandidateAttemptForUser } from "@/lib/candidate/attempts";

type CandidateAttemptPracticeExamplePageProps = {
  params: {
    attemptId: string;
    exampleIndex: string;
  };
};

function isSafranAssessmentSlug(slug: string | null | undefined): boolean {
  return slug === "safran_v1";
}

export const dynamic = "force-dynamic";

export default async function CandidateAttemptPracticeExamplePage({
  params,
}: CandidateAttemptPracticeExamplePageProps) {
  const user = await requireAuthenticatedUser();
  const attempt = await getCandidateAttemptForUser(user.id, params.attemptId);

  if (!attempt) {
    notFound();
  }

  if (!isSafranAssessmentSlug(attempt.tests?.slug)) {
    redirect(`/app/attempts/${attempt.id}`);
  }

  if (attempt.status === "completed") {
    redirect(`/app/attempts/${attempt.id}/report`);
  }

  if (attempt.status === "abandoned") {
    redirect(`/app/attempts/${attempt.id}`);
  }

  if (attempt.lifecycle !== "not_started") {
    redirect(getSafranScoredRunHref(attempt.id));
  }

  const example = getSafranPracticeExample(params.exampleIndex);

  if (!example) {
    redirect(`/app/attempts/${attempt.id}/practice`);
  }

  return <SafranPracticeExampleView attemptId={attempt.id} example={example} />;
}
