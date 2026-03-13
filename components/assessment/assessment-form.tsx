"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  completeProtectedAssessmentAttempt,
  completeAssessmentAttempt,
  saveProtectedAssessmentProgress,
  saveAssessmentProgress,
} from "@/app/actions/assessment";
import { CompletedAssessmentSummary } from "@/components/assessment/completed-assessment-summary";
import type { AssessmentCompletionState } from "@/lib/assessment/completion";
import { getAssessmentCompletionState } from "@/lib/assessment/completion";
import type { CompletedAssessmentReportState } from "@/lib/assessment/reports";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import type {
  AssessmentSelectionsInput,
  AssessmentSelectionValue,
  AttemptStatus,
} from "@/lib/assessment/types";
import type { TestAnswerOption, TestQuestion } from "@/lib/assessment/tests";

type AssessmentFormProps = {
  executionMode?: "public" | "protected";
  completionRedirectPath?: string | null;
  testId: string;
  questions: TestQuestion[];
  answerOptionsByQuestionId: Record<string, TestAnswerOption[]>;
  initialSelections: AssessmentSelectionsInput;
  initialAttemptId: string | null;
  initialAttemptStatus: AttemptStatus | null;
  initialCompletedAt: string | null;
  initialResults: CompletedAssessmentResults | null;
  initialReport: CompletedAssessmentReportState | null;
};

type SelectionState = Record<string, AssessmentSelectionValue | undefined>;
type SaveStatus = "idle" | "saving" | "saved" | "completing" | "completed" | "error";

function getSerializableSelections(
  selections: SelectionState,
): Record<string, AssessmentSelectionValue> {
  const entries = Object.entries(selections).filter(
    (entry): entry is [string, AssessmentSelectionValue] => entry[1] !== undefined,
  );

  return Object.fromEntries(entries);
}

function resetSaveFeedback(
  setSaveStatus: (status: SaveStatus) => void,
  setSaveMessage: (message: string | null) => void,
) {
  setSaveStatus("idle");
  setSaveMessage(null);
}

function getIncompleteRequiredAnswersMessage(completionState: AssessmentCompletionState): string {
  const missingCount = completionState.missingRequiredQuestionIds.length;

  if (missingCount === 0) {
    return "";
  }

  if (missingCount === 1) {
    return "Answer the remaining required question to enable completion.";
  }

  return `Answer the remaining ${missingCount} required questions to enable completion.`;
}

export function AssessmentForm({
  executionMode = "public",
  completionRedirectPath = null,
  testId,
  questions,
  answerOptionsByQuestionId,
  initialSelections,
  initialAttemptId,
  initialAttemptStatus,
  initialCompletedAt,
  initialResults,
  initialReport,
}: AssessmentFormProps) {
  const router = useRouter();
  const [selections, setSelections] = useState<SelectionState>(initialSelections);
  const [attemptId, setAttemptId] = useState<string | null>(initialAttemptId);
  const [attemptStatus, setAttemptStatus] = useState<AttemptStatus | null>(initialAttemptStatus);
  const [completedAt, setCompletedAt] = useState<string | null>(initialCompletedAt);
  const [results, setResults] = useState<CompletedAssessmentResults | null>(initialResults);
  const [reportState, setReportState] = useState<CompletedAssessmentReportState | null>(
    initialReport,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    initialAttemptStatus === "completed" ? "completed" : "idle",
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(
    initialAttemptStatus === "completed"
      ? "Assessment completed. Your answers are locked."
      : null,
  );

  const isCompleted = attemptStatus === "completed";
  const isBusy = saveStatus === "saving" || saveStatus === "completing";
  const completionState = getAssessmentCompletionState(
    questions,
    getSerializableSelections(selections),
  );
  const canComplete = completionState.isComplete;
  const incompleteRequiredAnswersMessage = isCompleted
    ? null
    : getIncompleteRequiredAnswersMessage(completionState);
  const saveAction =
    executionMode === "protected" ? saveProtectedAssessmentProgress : saveAssessmentProgress;
  const completeAction =
    executionMode === "protected"
      ? completeProtectedAssessmentAttempt
      : completeAssessmentAttempt;

  async function handleSave() {
    if (isCompleted) {
      return;
    }

    setSaveStatus("saving");
    setSaveMessage(null);

    try {
      const result = await saveAction({
        attemptId,
        testId,
        selections: getSerializableSelections(selections),
      });

      if (!result.ok) {
        setSaveStatus("error");
        setSaveMessage(result.message);
        return;
      }

      setAttemptId(result.attemptId);
      setAttemptStatus("in_progress");
      setCompletedAt(null);
      setResults(null);
      setReportState(null);
      setSaveStatus("saved");
      setSaveMessage(result.message);
    } catch {
      setSaveStatus("error");
      setSaveMessage("Unable to save progress right now. Please try again.");
    }
  }

  async function handleComplete() {
    if (isCompleted || !canComplete) {
      return;
    }

    setSaveStatus("completing");
    setSaveMessage(null);

    try {
      const result = await completeAction({
        attemptId,
        testId,
        selections: getSerializableSelections(selections),
      });

      if (!result.ok) {
        setSaveStatus("error");
        setSaveMessage(result.message);
        return;
      }

      setAttemptId(result.attemptId);
      setAttemptStatus("completed");
      setCompletedAt(result.completedAt);
      setResults(result.results);
      setReportState(result.report);
      setSaveStatus("completed");
      setSaveMessage(result.message);

      if (executionMode === "protected" && completionRedirectPath) {
        router.push(completionRedirectPath);
        router.refresh();
      }
    } catch {
      setSaveStatus("error");
      setSaveMessage("Unable to complete the assessment right now. Please try again.");
    }
  }

  if (questions.length === 0) {
    return <p>No questions available.</p>;
  }

  return (
    <>
      {isCompleted ? (
        <CompletedAssessmentSummary
          completedAt={completedAt}
          results={results}
          reportState={reportState}
        />
      ) : null}

      <ol>
        {questions.map((question) => {
          const options = answerOptionsByQuestionId[question.id] ?? [];
          const selection = selections[question.id];

          return (
            <li key={question.id}>
              <fieldset disabled={isCompleted}>
                <legend>{question.text}</legend>

                {question.question_type === "text" ? (
                  <textarea
                    value={typeof selection === "string" ? selection : ""}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setSelections((currentSelections) => ({
                        ...currentSelections,
                        [question.id]: nextValue,
                      }));
                      resetSaveFeedback(setSaveStatus, setSaveMessage);
                    }}
                    rows={3}
                  />
                ) : options.length > 0 ? (
                  <ol>
                    {options.map((option) => {
                      const inputId = `${question.id}-${option.option_order}`;

                      if (question.question_type === "multiple_choice") {
                        const selectedOptionIds = Array.isArray(selection) ? selection : [];

                        return (
                          <li key={option.id}>
                            <label htmlFor={inputId}>
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={selectedOptionIds.includes(option.id)}
                                onChange={(event) => {
                                  const isChecked = event.target.checked;
                                  setSelections((currentSelections) => {
                                    const currentValue = currentSelections[question.id];
                                    const currentOptionIds = Array.isArray(currentValue)
                                      ? currentValue
                                      : [];
                                    const nextOptionIds = isChecked
                                      ? [...currentOptionIds, option.id]
                                      : currentOptionIds.filter(
                                          (optionId) => optionId !== option.id,
                                        );

                                    return {
                                      ...currentSelections,
                                      [question.id]: nextOptionIds,
                                    };
                                  });
                                  resetSaveFeedback(setSaveStatus, setSaveMessage);
                                }}
                              />
                              {option.label}
                            </label>
                          </li>
                        );
                      }

                      return (
                        <li key={option.id}>
                          <label htmlFor={inputId}>
                            <input
                              id={inputId}
                              type="radio"
                              name={question.id}
                              checked={selection === option.id}
                              onChange={() => {
                                setSelections((currentSelections) => ({
                                  ...currentSelections,
                                  [question.id]: option.id,
                                }));
                                resetSaveFeedback(setSaveStatus, setSaveMessage);
                              }}
                            />
                            {option.label}
                          </label>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p>No answer options available for this question.</p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {!isCompleted ? (
        <>
          <button type="button" onClick={handleSave} disabled={isBusy}>
            {saveStatus === "saving" ? "Saving..." : "Save progress"}
          </button>

          <button type="button" onClick={handleComplete} disabled={isBusy || !canComplete}>
            {saveStatus === "completing" ? "Completing..." : "Complete assessment"}
          </button>

          {incompleteRequiredAnswersMessage ? <p>{incompleteRequiredAnswersMessage}</p> : null}
        </>
      ) : null}

      {saveMessage ? <p>{saveMessage}</p> : null}
    </>
  );
}
