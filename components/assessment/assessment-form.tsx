"use client";

import { useState } from "react";
import type { TestAnswerOption, TestQuestion } from "@/lib/assessment/tests";

type AssessmentFormProps = {
  questions: TestQuestion[];
  answerOptionsByQuestionId: Record<string, TestAnswerOption[]>;
};

type SelectionState = Record<string, string | string[] | undefined>;

function getSelectedOptions(value: SelectionState[string]): string[] {
  return Array.isArray(value) ? value : [];
}

export function AssessmentForm({
  questions,
  answerOptionsByQuestionId,
}: AssessmentFormProps) {
  const [selections, setSelections] = useState<SelectionState>({});

  if (questions.length === 0) {
    return <p>No questions available.</p>;
  }

  return (
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
                  }}
                  rows={3}
                />
              ) : options.length > 0 ? (
                <ol>
                  {options.map((option) => {
                    const inputId = `${question.id}-${option.id}`;

                    if (question.question_type === "multiple_choice") {
                      const selectedOptions = getSelectedOptions(selection);

                      return (
                        <li key={option.id}>
                          <label htmlFor={inputId}>
                            <input
                              id={inputId}
                              type="checkbox"
                              checked={selectedOptions.includes(option.id)}
                              onChange={(event) => {
                                setSelections((currentSelections) => {
                                  const currentValue = getSelectedOptions(
                                    currentSelections[question.id],
                                  );

                                  const nextValue = event.target.checked
                                    ? [...currentValue, option.id]
                                    : currentValue.filter(
                                        (selectedOptionId: string) =>
                                          selectedOptionId !== option.id,
                                      );

                                  return {
                                    ...currentSelections,
                                    [question.id]: nextValue,
                                  };
                                });
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
  );
}
