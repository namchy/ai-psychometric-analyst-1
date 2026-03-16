"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  completeProtectedAssessmentAttempt,
  completeAssessmentAttempt,
  saveProtectedAssessmentProgress,
  saveAssessmentProgress,
} from "@/app/actions/assessment";
import { CompletedAssessmentSummary } from "@/components/assessment/completed-assessment-summary";
import type { AssessmentCompletionState } from "@/lib/assessment/completion";
import { getAssessmentCompletionState, isQuestionAnswered } from "@/lib/assessment/completion";
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
  layoutMode?: "classic" | "step";
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
type ProtectedCompletionUiPhase = "processing" | "redirecting" | null;

type ProtectedCompletionUiContent = {
  eyebrow: string;
  title: string;
  description: string;
  liveMessage: string;
};

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

function getInitialQuestionIndex(
  questions: TestQuestion[],
  selections: AssessmentSelectionsInput,
): number {
  const firstUnansweredIndex = questions.findIndex(
    (question) => !isQuestionAnswered(question.question_type, selections[question.id]),
  );

  if (firstUnansweredIndex >= 0) {
    return firstUnansweredIndex;
  }

  return Math.max(questions.length - 1, 0);
}

function getQuestionValidationMessage(question: TestQuestion): string {
  if (question.question_type === "text") {
    return "Unesite odgovor prije nastavka.";
  }

  if (question.question_type === "multiple_choice") {
    return "Odaberite najmanje jednu opciju prije nastavka.";
  }

  return "Odaberite jedan odgovor prije nastavka.";
}

function getStepCompletionValidationMessage(completionState: AssessmentCompletionState): string {
  const missingCount = completionState.missingRequiredQuestionIds.length;

  if (missingCount <= 0) {
    return "";
  }

  if (missingCount === 1) {
    return "Vratite se i odgovorite na preostalo obavezno pitanje prije završetka.";
  }

  return `Vratite se i odgovorite na preostala ${missingCount} obavezna pitanja prije završetka.`;
}

function isLikertScaleQuestion(question: TestQuestion, options: TestAnswerOption[]): boolean {
  return question.question_type === "single_choice" && options.length === 5;
}

function getProtectedCompletionUiContent(
  phase: Exclude<ProtectedCompletionUiPhase, null>,
): ProtectedCompletionUiContent {
  if (phase === "redirecting") {
    return {
      eyebrow: "Procjena završena",
      title: "Analiziramo tvoje rezultate",
      description: "Odgovori su zaprimljeni, a personalizovani izvještaj je spreman za prikaz.",
      liveMessage: "Analiza je završena. Otvaramo rezultate.",
    };
  }

  return {
    eyebrow: "Procjena završena",
    title: "Analiziramo tvoje rezultate",
    description:
      "Odgovori su uspješno zaprimljeni. Pripremamo tvoj personalizovani izvještaj.",
    liveMessage: "Procjena je završena. Analiza rezultata je u toku.",
  };
}

export function AssessmentForm({
  executionMode = "public",
  layoutMode = "classic",
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() =>
    getInitialQuestionIndex(questions, initialSelections),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    initialAttemptStatus === "completed" ? "completed" : "idle",
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(
    initialAttemptStatus === "completed"
      ? "Assessment completed. Your answers are locked."
      : null,
  );
  const [protectedCompletionUiPhase, setProtectedCompletionUiPhase] =
    useState<ProtectedCompletionUiPhase>(null);
  const [stepValidationMessage, setStepValidationMessage] = useState<string | null>(null);
  const requestInFlightRef = useRef(false);

  const isCompleted = attemptStatus === "completed";
  const isBusy = saveStatus === "saving" || saveStatus === "completing";
  const isStepLayout = layoutMode === "step";
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
  const currentQuestion = questions[currentQuestionIndex] ?? null;
  const currentSelection = currentQuestion ? selections[currentQuestion.id] : undefined;
  const answeredQuestionCount = questions.filter((question) =>
    isQuestionAnswered(question.question_type, selections[question.id]),
  ).length;
  const progressPercent =
    questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
  const isInteractionLocked = isBusy || requestInFlightRef.current;

  async function persistSelections(
    nextSelections: SelectionState,
    options?: {
      successMessage?: string | null;
    },
  ): Promise<boolean> {
    if (isCompleted || requestInFlightRef.current) {
      return false;
    }

    requestInFlightRef.current = true;
    setSaveStatus("saving");
    setSaveMessage(null);

    try {
      const result = await saveAction({
        attemptId,
        testId,
        selections: getSerializableSelections(nextSelections),
      });

      if (!result.ok) {
        setSaveStatus("error");
        setSaveMessage(result.message);
        return false;
      }

      setAttemptId(result.attemptId);
      setAttemptStatus("in_progress");
      setCompletedAt(null);
      setResults(null);
      setReportState(null);
      setSaveStatus("saved");
      setSaveMessage(options?.successMessage ?? null);
      return true;
    } catch {
      setSaveStatus("error");
      setSaveMessage("Unable to save progress right now. Please try again.");
      return false;
    } finally {
      requestInFlightRef.current = false;
    }
  }

  async function handleSave() {
    await persistSelections(selections, {
      successMessage: "Progress saved.",
    });
  }

  async function handleComplete() {
    if (isCompleted || !canComplete || requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;
    setSaveStatus("completing");
    setSaveMessage(null);
    setProtectedCompletionUiPhase(executionMode === "protected" ? "processing" : null);

    try {
      const result = await completeAction({
        attemptId,
        testId,
        selections: getSerializableSelections(selections),
      });

      if (!result.ok) {
        setSaveStatus("error");
        setSaveMessage(result.message);
        setProtectedCompletionUiPhase(null);
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
        setProtectedCompletionUiPhase("redirecting");
        router.push(completionRedirectPath);
        router.refresh();
        return;
      }

      setProtectedCompletionUiPhase(null);
    } catch {
      setSaveStatus("error");
      setSaveMessage("Unable to complete the assessment right now. Please try again.");
      setProtectedCompletionUiPhase(null);
    } finally {
      requestInFlightRef.current = false;
    }
  }

  function updateSelection(questionId: string, value: AssessmentSelectionValue): SelectionState {
    const nextSelections = {
      ...selections,
      [questionId]: value,
    };

    setSelections(nextSelections);
    setStepValidationMessage(null);
    resetSaveFeedback(setSaveStatus, setSaveMessage);
    return nextSelections;
  }

  async function handleSingleChoiceStepSelection(optionId: string) {
    if (!currentQuestion || isInteractionLocked) {
      return;
    }

    const nextSelections = updateSelection(currentQuestion.id, optionId);
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const didSave = await persistSelections(nextSelections);

    if (!didSave || isLastQuestion) {
      return;
    }

    setCurrentQuestionIndex((currentIndex) => Math.min(currentIndex + 1, questions.length - 1));
  }

  function handleBack() {
    if (isInteractionLocked) {
      return;
    }

    setCurrentQuestionIndex((currentIndex) => Math.max(currentIndex - 1, 0));
    setStepValidationMessage(null);
  }

  async function handleAdvance() {
    if (!currentQuestion || isInteractionLocked) {
      return;
    }

    if (!isQuestionAnswered(currentQuestion.question_type, currentSelection)) {
      setStepValidationMessage(getQuestionValidationMessage(currentQuestion));
      return;
    }

    setStepValidationMessage(null);

    if (currentQuestionIndex === questions.length - 1) {
      if (!canComplete) {
        setStepValidationMessage(getStepCompletionValidationMessage(completionState));
        return;
      }

      await handleComplete();
      return;
    }

    setCurrentQuestionIndex((currentIndex) => Math.min(currentIndex + 1, questions.length - 1));
  }

  if (questions.length === 0) {
    return <p>No questions available.</p>;
  }

  if (executionMode === "protected" && protectedCompletionUiPhase) {
    const completionUi = getProtectedCompletionUiContent(protectedCompletionUiPhase);

    return (
      <section
        aria-live="polite"
        aria-busy="true"
        className="assessment-completion-state"
        role="status"
      >
        <div className="assessment-completion-state__hero stack-sm">
          <p className="assessment-eyebrow">{completionUi.eyebrow}</p>
          <h2>{completionUi.title}</h2>
          <p className="assessment-completion-state__description">{completionUi.description}</p>
        </div>

        <div aria-hidden="true" className="assessment-completion-state__indicator">
          <span className="assessment-completion-state__indicator-orbit">
            <span className="assessment-completion-state__indicator-core" />
          </span>
          <span className="assessment-completion-state__indicator-bar" />
        </div>

        <p className="assessment-completion-state__status" aria-label={completionUi.liveMessage}>
          Rezultati će se otvoriti automatski čim obrada bude završena.
        </p>
      </section>
    );
  }

  if (isStepLayout && !isCompleted && currentQuestion) {
    const options = answerOptionsByQuestionId[currentQuestion.id] ?? [];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const isLikertQuestion = isLikertScaleQuestion(currentQuestion, options);
    const selectedLikertOption = isLikertQuestion
      ? options.find((option) => option.id === currentSelection) ?? null
      : null;
    const shouldAutoAdvance = isLikertQuestion && !isLastQuestion;
    const shouldShowContinueButton = !shouldAutoAdvance;
    const stepActionsClassName = shouldShowContinueButton
      ? "assessment-step-actions"
      : "assessment-step-actions assessment-step-actions--compact";

    return (
      <div className="assessment-run stack-md">
        <div className="assessment-progress stack-sm">
          <div className="assessment-progress__header">
            <div>
              <p className="assessment-eyebrow">Protected assessment</p>
              <h2>Pitanje {currentQuestionIndex + 1} od {questions.length}</h2>
            </div>
            <p className="assessment-progress__meta">
              Odgovoreno {answeredQuestionCount} / {questions.length}
            </p>
          </div>

          <div
            aria-hidden="true"
            className="assessment-progress__track"
          >
            <div
              className="assessment-progress__fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <section className="assessment-step-card">
          <div
            className="assessment-step-card__header stack-sm"
          >
            <div
              className={`assessment-step-card__question-region stack-xs${
                isLikertQuestion ? " assessment-step-card__question-region--stable" : ""
              }`}
            >
              <p className="assessment-step-card__kicker">
                Korak {currentQuestionIndex + 1}
              </p>
              <h3>{currentQuestion.text}</h3>
            </div>

            {isLikertQuestion ? (
              <div className="assessment-step-card__meta stack-xs">
                <p className="assessment-step-card__hint">Skala odgovora 1-5</p>
                {!isLastQuestion ? (
                  <p className="assessment-step-card__autoflow">
                    Odabir odgovora automatski otvara sljedeće pitanje.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <fieldset className="assessment-step-card__fieldset" disabled={isInteractionLocked}>
            <legend className="sr-only">{currentQuestion.text}</legend>

            {currentQuestion.question_type === "text" ? (
              <textarea
                className="assessment-textarea"
                value={typeof currentSelection === "string" ? currentSelection : ""}
                onChange={(event) => {
                  updateSelection(currentQuestion.id, event.target.value);
                }}
                rows={4}
              />
            ) : isLikertQuestion ? (
              <div className="assessment-likert stack-sm">
                <div className="assessment-likert__labels" aria-hidden="true">
                  <span>{options[0]?.label}</span>
                  <span>{options[options.length - 1]?.label}</span>
                </div>

                <ol className="assessment-likert__options">
                  {options.map((option) => {
                    const inputId = `${currentQuestion.id}-${option.option_order}`;
                    const isSelected = currentSelection === option.id;

                    return (
                      <li key={option.id}>
                        <label
                          className={`assessment-likert-option${
                            isSelected ? " assessment-likert-option--selected" : ""
                          }`}
                          htmlFor={inputId}
                        >
                          <input
                            id={inputId}
                            type="radio"
                            name={currentQuestion.id}
                            checked={isSelected}
                            onChange={() => {
                              void handleSingleChoiceStepSelection(option.id);
                            }}
                          />
                          <span className="assessment-likert-option__value">
                            {option.option_order}
                          </span>
                          <span className="sr-only">{option.label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ol>

                {selectedLikertOption ? (
                  <p className="assessment-likert__selected-label">
                    Odabrano: {selectedLikertOption.label}
                  </p>
                ) : null}
              </div>
            ) : options.length > 0 ? (
              <ol className="assessment-options">
                {options.map((option) => {
                  const inputId = `${currentQuestion.id}-${option.option_order}`;

                  if (currentQuestion.question_type === "multiple_choice") {
                    const selectedOptionIds = Array.isArray(currentSelection)
                      ? currentSelection
                      : [];

                    return (
                      <li key={option.id}>
                        <label className="assessment-option" htmlFor={inputId}>
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={selectedOptionIds.includes(option.id)}
                            onChange={(event) => {
                              const isChecked = event.target.checked;
                              const currentValue = Array.isArray(currentSelection)
                                ? currentSelection
                                : [];
                              const nextOptionIds = isChecked
                                ? [...currentValue, option.id]
                                : currentValue.filter((optionId) => optionId !== option.id);

                              updateSelection(currentQuestion.id, nextOptionIds);
                            }}
                          />
                          <span className="assessment-option__marker">
                            {option.option_order}
                          </span>
                          <span className="assessment-option__label">{option.label}</span>
                        </label>
                      </li>
                    );
                  }

                  return (
                    <li key={option.id}>
                      <label className="assessment-option" htmlFor={inputId}>
                        <input
                          id={inputId}
                          type="radio"
                          name={currentQuestion.id}
                          checked={currentSelection === option.id}
                          onChange={() => {
                            updateSelection(currentQuestion.id, option.id);
                          }}
                        />
                        <span className="assessment-option__marker">{option.option_order}</span>
                        <span className="assessment-option__label">{option.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p>No answer options available for this question.</p>
            )}
          </fieldset>

          {stepValidationMessage ? (
            <p className="assessment-inline-message assessment-inline-message--error">
              {stepValidationMessage}
            </p>
          ) : null}

          {saveMessage ? (
            <p
              className={`assessment-inline-message ${
                saveStatus === "error"
                  ? "assessment-inline-message--error"
                  : "assessment-inline-message--success"
              }`}
            >
              {saveMessage}
            </p>
          ) : null}
        </section>

        <div className={stepActionsClassName}>
          <button
            className="button-secondary"
            type="button"
            onClick={handleBack}
            disabled={isInteractionLocked || currentQuestionIndex === 0}
          >
            Nazad
          </button>

          <button
            className="button-secondary"
            type="button"
            onClick={handleSave}
            disabled={isInteractionLocked}
          >
            {saveStatus === "saving" ? "Sačuvavanje..." : "Sačuvaj"}
          </button>

          {shouldShowContinueButton ? (
            <button type="button" onClick={handleAdvance} disabled={isInteractionLocked}>
              {saveStatus === "completing"
                ? "Završavanje..."
                : isLastQuestion
                  ? "Završi procjenu"
                  : "Nastavi"}
            </button>
          ) : null}
        </div>

        {!canComplete && currentQuestionIndex === questions.length - 1 ? (
          <p className="assessment-progress-note">{incompleteRequiredAnswersMessage}</p>
        ) : null}
      </div>
    );
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
                      updateSelection(question.id, event.target.value);
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
                                  const currentOptionIds = Array.isArray(selection)
                                    ? selection
                                    : [];
                                  const nextOptionIds = isChecked
                                    ? [...currentOptionIds, option.id]
                                    : currentOptionIds.filter(
                                        (optionId) => optionId !== option.id,
                                      );

                                  updateSelection(question.id, nextOptionIds);
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
                                updateSelection(question.id, option.id);
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
