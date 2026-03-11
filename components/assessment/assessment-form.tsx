"use client";

import { useState } from "react";
import { saveAssessmentProgress } from "@/app/actions/assessment";
import type { AssessmentSelectionValue } from "@/lib/assessment/types";
import type { TestAnswerOption, TestQuestion } from "@/lib/assessment/tests";

type AssessmentFormProps = {
  testId: string;
  questions: TestQuestion[];
  answerOptionsByQuestionId: Record<string, TestAnswerOption[]>;
};

type SelectionState = Record<string, AssessmentSelectionValue | undefined>;
type SaveStatus = "idle" | "saving" | "saved" | "error";

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
}: AssessmentFormProps) {
  const [selections, setSelections] = useState<SelectionState>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function handleSave() {
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
      setSaveStatus("saved");
      setSaveMessage(result.message);
    } catch {
      setSaveStatus("error");
      setSaveMessage("Unable to save progress right now. Please try again.");
    }
  }

  if (questions.length === 0) {
    return <p>No questions available.</p>;
  }

  return (
    <>
      <ol>
        {questions.map((question) => {
          const options = answerOptionsByQuestionId[question.id] ?? [];
          const selection = selections[question.id];

          return (
            <li key={question.id}>
              <fieldset>
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

      <button type="button" onClick={handleSave} disabled={saveStatus === "saving"}>
        {saveStatus === "saving" ? "Saving..." : "Save progress"}
      </button>

      {saveMessage ? <p>{saveMessage}</p> : null}
    </>
  );
}
