"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { processTeamFitReportAction } from "@/app/actions/team-assessments";
import { DpButton } from "@/components/dashboard/primitives";

type TeamFitReportProcessActionProps = {
  teamFitReportId: string;
  teamId: string;
  participantId: string;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

export function TeamFitReportProcessAction({
  teamFitReportId,
  teamId,
  participantId,
}: TeamFitReportProcessActionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  function handleProcessReport() {
    setFeedback(null);

    startTransition(async () => {
      const result = await processTeamFitReportAction({
        teamFitReportId,
        teamId,
        participantId,
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
      <DpButton
        disabled={isPending}
        onClick={handleProcessReport}
        size="sm"
        type="button"
        variant={isPending ? "disabled" : "secondary"}
      >
        {isPending ? "Priprema u toku" : "Pripremi Team Fit izvještaj"}
      </DpButton>
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
