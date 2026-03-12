"use client";

import { useState } from "react";
import {
  completeAssessmentAttempt,
  saveAssessmentProgress,
} from "@/app/actions/assessment";
import type {
  AssessmentSelectionsInput,
  AssessmentSelectionValue,
  AttemptStatus,
} from "@/lib/assessment/types";
import type { TestAnswerOption, TestQuestion } from "@/lib/assessment/tests";

type AssessmentFormProps = {
  testId: string;
  questions: TestQuestion[];
  answerOptionsByQuestionId: Record<string, TestAnswerOption[]>;
  initialSelections: AssessmentSelectionsInput;
  initialAttemptId: string | null;
  initialAttemptStatus: AttemptStatus | null;
  initialCompletedAt: string | null;
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

export function AssessmentForm({
  testId,
  questions,
  answerOptionsByQuestionId,
  initialSelections,
  initialAttemptId,
  initialAttemptStatus,
  initialCompletedAt,
}: AssessmentFormProps) {
  const [selections, setSelections] = useState<SelectionState>(initialSelections);
  const [attemptId, setAttemptId] = useState<string | null>(initialAttemptId);
  const [attemptStatus, setAttemptStatus] = useState<AttemptStatus | null>(initialAttemptStatus);
  const [completedAt, setCompletedAt] = useState<string | null>(initialCompletedAt);
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

  async function handleSave() {
    if (isCompleted) {
      return;
    }

    setSaveStatus("saving");
    setSaveMessage(null);

    try {
      const result = await saveAssessmentProgress({
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
      setSaveStatus("saved");
      setSaveMessage(result.message);
    } catch {
      setSaveStatus("error");
      setSaveMessage("Unable to save progress right now. Please try again.");
    }
  }

  async function handleComplete() {
    if (isCompleted) {
      return;
    }

    setSaveStatus("completing");
    setSaveMessage(null);

    try {
      const result = await completeAssessmentAttempt({
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
      setSaveStatus("completed");
      setSaveMessage(result.message);
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
        <p>
          Assessment completed.
          {completedAt ? ` Completed at ${new Date(completedAt).toLocaleString()}.` : ""} Your
          answers are now read-only.
        </p>
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
                      const inputId = `${question.id}-${option.id}`;

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

          <button type="button" onClick={handleComplete} disabled={isBusy}>
            {saveStatus === "completing" ? "Completing..." : "Complete assessment"}
          </button>
        </>
      ) : null}

      {saveMessage ? <p>{saveMessage}</p> : null}
    </>
  );
}
