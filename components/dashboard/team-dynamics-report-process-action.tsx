"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { processTeamDynamicsExecutiveOverviewReportAction } from "@/app/actions/team-assessments";
import { getDashboardCtaClassName } from "@/components/dashboard/primitives";

type TeamDynamicsReportProcessActionProps = {
  teamAssessmentReportId: string;
  teamId: string;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

export function TeamDynamicsReportProcessAction({
  teamAssessmentReportId,
  teamId,
}: TeamDynamicsReportProcessActionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  function handleProcessReport() {
    setFeedback(null);

    startTransition(async () => {
      const result = await processTeamDynamicsExecutiveOverviewReportAction({
        teamAssessmentReportId,
        teamId,
      });

      setFeedback({
        tone: result.ok ? "success" : "error",
        message: result.message,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 pt-1">
      <button
        type="button"
        className={getDashboardCtaClassName({
          variant: isPending ? "disabled" : "secondary",
          size: "sm",
        })}
        disabled={isPending}
        onClick={handleProcessReport}
      >
        {isPending ? "Obrada u toku" : "Obradi izvještaj"}
      </button>
      {feedback ? (
        <p
          className={
            feedback.tone === "success"
              ? "text-xs leading-5 text-emerald-700"
              : "text-xs leading-5 text-rose-700"
          }
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
