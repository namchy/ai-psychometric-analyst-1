"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  completeProtectedAssessmentAttempt,
  completeAssessmentAttempt,
  saveProtectedAssessmentProgress,
  saveAssessmentProgress,
} from "@/app/actions/assessment";
import { CompletedAssessmentSummary } from "@/components/assessment/completed-assessment-summary";
import { ReportGenerationLoadingScreen } from "@/components/assessment/report-generation-loading-screen";
import type { AssessmentCompletionState } from "@/lib/assessment/completion";
import { getAssessmentCompletionState, isQuestionAnswered } from "@/lib/assessment/completion";
import type { CompletedAssessmentReportState } from "@/lib/assessment/reports";
import { MWMS_V1_TEST_SLUG } from "@/lib/assessment/mwms-scoring";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import {
  DEFAULT_ASSESSMENT_LOCALE,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
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
  assessmentDisplayName?: string | null;
  participantDisplayName?: string | null;
  testSlug?: string | null;
  testId: string;
  locale?: AssessmentLocale;
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
const MANUAL_SAVE_SUCCESS_DURATION_MS = 1600;
const MWMS_SHARED_STEM = "Zašto ulažeš trud u svoj posao?";
const MWMS_REASON_LABEL = "Mogući razlog";
const MWMS_SCALE_INSTRUCTION = "U kojoj mjeri se ovaj razlog odnosi na tebe?";

function getSerializableSelections(
  selections: SelectionState,
): Record<string, AssessmentSelectionValue> {
  const entries = Object.entries(selections).filter(
    (entry): entry is [string, AssessmentSelectionValue] => entry[1] !== undefined,
  );

  return Object.fromEntries(entries);
}

function getEffectiveSelections(
  selections: SelectionState,
): Record<string, AssessmentSelectionValue> {
  return getSerializableSelections(selections);
}

function getQuestionSelectionDelta(
  selections: SelectionState,
  questionId: string,
): Record<string, AssessmentSelectionValue> {
  const effectiveSelections = getEffectiveSelections(selections);
  const selection = effectiveSelections[questionId];

  return selection === undefined ? {} : { [questionId]: selection };
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
    (question) => !isQuestionAnswered(question, selections[question.id]),
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
  return (
    question.question_type === "single_choice" &&
    options.length >= 5 &&
    options.length <= 7 &&
    options.every((option) => typeof option.value === "number" && !option.image_path)
  );
}

function isImageChoiceQuestion(question: TestQuestion, options: TestAnswerOption[]): boolean {
  return (
    question.renderer_type === "image_choice" ||
    !!question.stimulus_image_path ||
    !!question.stimulus_secondary_image_path ||
    options.some((option) => !!option.image_path)
  );
}

function getVisibleQuestionText(question: TestQuestion): string | null {
  const text = question.text.trim();
  const code = question.code.trim();

  if (!text || text === code || /^[A-Z]{2}\d{2,}$/i.test(text)) {
    return null;
  }

  return text;
}

function isIntermediateNumericInputValue(value: string): boolean {
  return /^-?(?:\d+(?:[.,]\d*)?)?$/.test(value);
}

function getNextNumericInputValue(rawValue: string): string | null {
  return isIntermediateNumericInputValue(rawValue) ? rawValue : null;
}

function getLikertAssessmentCode(assessmentDisplayName?: string | null): string | null {
  const name = assessmentDisplayName?.trim();

  if (!name) {
    return null;
  }

  const parentheticalMatch = name.match(/\(([^)]+)\)/);

  if (parentheticalMatch?.[1]) {
    return parentheticalMatch[1].trim();
  }

  return name;
}

function isMwmsAssessmentSlug(slug: string | null | undefined): boolean {
  return slug === MWMS_V1_TEST_SLUG;
}

function parseNumericSequenceQuestionText(text: string): { prompt: string; tokens: string[] } | null {
  const normalizedText = text.trim();
  const match = normalizedText.match(/^Logično dopuni niz:\s*(.+)$/i);

  if (!match?.[1]) {
    return null;
  }

  const rawSequence = match[1].trim();
  const tokens = rawSequence
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length < 2) {
    return null;
  }

  return {
    prompt: "Logično dopuni niz",
    tokens,
  };
}

function AssessmentStimulusImages({ question }: { question: TestQuestion }) {
  const imagePaths = [
    question.stimulus_image_path,
    question.stimulus_secondary_image_path,
  ].filter((imagePath): imagePath is string => !!imagePath);

  if (imagePaths.length === 0) {
    return null;
  }

  return (
    <div className="assessment-stimulus-images">
      {imagePaths.map((imagePath, index) => (
        <img
          key={imagePath}
          alt={index === 0 ? "Stimulus" : "Dodatni stimulus"}
          className="assessment-stimulus-images__image"
          src={imagePath}
        />
      ))}
    </div>
  );
}

function AssessmentOptionMedia({ option }: { option: TestAnswerOption }) {
  if (!option.image_path) {
    return null;
  }

  return (
    <img
      alt={`Opcija ${option.option_order}`}
      className="assessment-option__image"
      src={option.image_path}
    />
  );
}

function AssessmentDashboardSkinStyles() {
  return (
    <style jsx global>{`
      .assessment-run-page--dashboard-skin,
      .assessment-run-page--dashboard-skin :where(h1, h2, h3, h4, p, span, label, legend, button, input, textarea) {
        font-family: var(--font-sans);
      }

      .assessment-run-page--dashboard-skin .run-form-hero {
        width: 100%;
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(203, 213, 225, 0.78);
        border-radius: 1.5rem;
        padding: 1.25rem;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(243, 249, 249, 0.97) 58%, rgba(246, 242, 255, 0.95));
        box-shadow: 0 20px 44px rgba(15, 23, 42, 0.08);
      }

      @media (min-width: 640px) {
        .assessment-run-page--dashboard-skin .run-form-hero {
          padding: 1.5rem;
        }
      }

      .assessment-run-page--dashboard-skin .run-form-hero::before {
        background:
          radial-gradient(circle, rgba(20, 184, 166, 0.16), transparent 65%);
        opacity: 1;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__content {
        position: relative;
        z-index: 1;
      }

      .assessment-run-page--dashboard-skin .run-form-hero--compact {
        padding: 1rem 1.1rem;
        border-radius: 1.35rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.78),
          0 18px 34px -30px rgba(15, 23, 42, 0.2);
      }

      @media (min-width: 640px) {
        .assessment-run-page--dashboard-skin .run-form-hero--compact {
          padding: 1.1rem 1.2rem;
        }
      }

      .assessment-run-page--dashboard-skin .run-form-hero__intro {
        display: grid;
        gap: 1.25rem;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__intro--compact {
        gap: 0.9rem;
      }

      @media (min-width: 1024px) {
        .assessment-run-page--dashboard-skin .run-form-hero__intro {
          grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
          gap: 1.25rem;
          align-items: start;
        }

        .assessment-run-page--dashboard-skin .run-form-hero__intro--compact {
          grid-template-columns: minmax(0, 1fr) minmax(240px, 280px);
          gap: 1rem;
          align-items: center;
        }
      }

      .assessment-run-page--dashboard-skin .run-form-hero__identity {
        max-width: 100%;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__title-group {
        display: grid;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__intro h1,
      .assessment-run-page--dashboard-skin .assessment-step-card__header h3 {
        font-family: var(--font-sans);
        color: rgb(2, 6, 23);
        letter-spacing: -0.05em;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__title-group {
        position: relative;
        gap: 0;
        padding-top: 0;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__top-line {
        pointer-events: none;
        position: absolute;
        inset-inline: 1.5rem;
        top: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(203, 213, 225, 0.8), transparent);
      }

      .assessment-run-page--dashboard-skin .run-form-hero__eyebrow {
        margin: 0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(17, 94, 89, 0.9);
      }

      .assessment-run-page--dashboard-skin .run-form-hero__intro h1 {
        margin: 0.55rem 0 0;
        max-width: 42rem;
        font-size: 1.75rem;
        font-weight: 780;
        line-height: 1.08;
        color: rgb(2, 6, 23);
      }

      .assessment-run-page--dashboard-skin .run-form-hero__test-pill {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        margin-top: 0.55rem;
        border: 1px solid rgba(17, 138, 178, 0.24);
        border-radius: 999px;
        background: rgba(17, 138, 178, 0.08);
        padding: 0.28rem 0.72rem;
        color: rgb(7, 59, 76);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.16em;
        line-height: 1;
        text-transform: uppercase;
      }

      @media (min-width: 640px) {
        .assessment-run-page--dashboard-skin .run-form-hero__intro h1 {
          font-size: 2rem;
        }
      }

      .assessment-run-page--dashboard-skin .run-form-hero__title-group--compact {
        gap: calc(0.45rem + 6px);
      }

      .assessment-run-page--dashboard-skin .run-form-hero__title-group--compact h1 {
        margin-top: 0;
        font-size: clamp(1.1rem, 2vw, 1.35rem);
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: -0.03em;
        color: rgb(15, 23, 42);
      }

      .assessment-run-page--dashboard-skin .run-form-hero__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        align-items: center;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__meta-pill {
        display: inline-flex;
        align-items: center;
        min-height: 1.7rem;
        padding: 0.3rem 0.65rem;
        border: 1px solid rgba(203, 213, 225, 0.88);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.9);
        color: rgb(71, 85, 105);
        font-size: 0.72rem;
        font-weight: 600;
        line-height: 1;
        letter-spacing: 0.01em;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
      }

      .assessment-run-page--dashboard-skin .run-form-hero__meta-pill--code {
        border-color: rgba(7, 59, 76, 0.72);
        background: #073b4c;
        color: rgba(248, 250, 252, 0.98);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }

      .assessment-run-page--dashboard-skin .run-form-hero__meta-pill--count {
        border-color: rgba(148, 163, 184, 0.5);
        background: rgba(248, 250, 252, 0.96);
        color: rgb(51, 65, 85);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__header h3 {
        font-size: clamp(1.1rem, 1.8vw, 1.46rem);
        font-weight: 600;
        line-height: 1.18;
        text-wrap: pretty;
        max-width: 100%;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__participant {
        margin: 0.35rem 0 0;
        max-width: 42rem;
        font-size: 14px;
        line-height: 1.55;
        color: rgb(71, 85, 105);
      }

      .assessment-run-page--dashboard-skin .run-form-hero__participant--compact {
        margin-top: 0.2rem;
        font-size: 0.9rem;
        line-height: 1.45;
        color: rgb(100, 116, 139);
      }

      .assessment-run-page--dashboard-skin .assessment-completion-state__hero > * + * {
        margin-top: 0.75rem;
      }

      .assessment-run-page--dashboard-skin .assessment-progress {
        border: 1px solid rgba(191, 219, 254, 0.7);
        border-radius: 1.25rem;
        padding: 1.1rem 1.25rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(240, 249, 255, 0.92));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.78),
          0 18px 32px -28px rgba(15, 23, 42, 0.12);
      }

      .assessment-run-page--dashboard-skin .assessment-progress--compact {
        border: none;
        border-radius: 0;
        padding: 0;
        background: transparent;
        box-shadow: none;
      }

      .assessment-run-page--dashboard-skin .assessment-progress__summary--compact {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .assessment-run-page--dashboard-skin .assessment-progress__metric--compact {
        display: grid;
        gap: 0.18rem;
      }

      .assessment-run-page--dashboard-skin .assessment-progress__metric-label,
      .assessment-run-page--dashboard-skin .assessment-step-card__kicker {
        color: rgb(13, 148, 136);
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .assessment-run-page--dashboard-skin .assessment-progress__metric--compact .assessment-progress__metric-label {
        font-size: 10px;
        letter-spacing: 0.16em;
        color: rgb(100, 116, 139);
      }

      .assessment-run-page--dashboard-skin .assessment-progress__metric-value,
      .assessment-run-page--dashboard-skin .assessment-progress-note {
        font-size: 1.05rem;
        font-weight: 700;
        line-height: 1.25;
        color: rgb(15, 23, 42);
      }

      .assessment-run-page--dashboard-skin .assessment-progress__metric--compact .assessment-progress__metric-value {
        font-size: 0.98rem;
        font-weight: 700;
        line-height: 1.2;
      }

      .assessment-run-page--dashboard-skin .assessment-progress__bar-region--compact {
        margin-top: 0.55rem;
      }

      .assessment-run-page--dashboard-skin .assessment-progress__track {
        height: 0.5rem;
        border-radius: 999px;
        overflow: hidden;
        background: linear-gradient(180deg, rgba(203, 213, 225, 0.95), rgba(226, 232, 240, 0.98));
        box-shadow: inset 0 1px 2px rgba(148, 163, 184, 0.18);
      }

      .assessment-run-page--dashboard-skin .assessment-progress--compact .assessment-progress__track {
        height: 5px;
        border-radius: 999px;
      }

      .assessment-run-page--dashboard-skin .assessment-progress__fill {
        background: linear-gradient(90deg, #06d6a0, rgba(6, 214, 160, 0.84));
        box-shadow: 0 4px 10px -6px rgba(6, 214, 160, 0.42);
      }

      .assessment-run-page--dashboard-skin.run-form-layout--compact {
        row-gap: 1rem;
      }

      .assessment-run-page--dashboard-skin.run-form-layout--top-compact {
        margin-top: -3.5rem;
      }

      @media (min-width: 640px) {
        .assessment-run-page--dashboard-skin.run-form-layout--top-compact {
          margin-top: -4.25rem;
        }
      }

      .assessment-run-page--dashboard-skin .assessment-step-card {
        width: 100%;
        border: 1px solid rgba(203, 213, 225, 0.86);
        border-radius: 1.5rem;
        padding: 1.5rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.98));
        box-shadow:
          0 24px 56px rgba(15, 23, 42, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.82);
      }

      .assessment-run-page--dashboard-skin .assessment-step-card--compact {
        border-color: rgba(203, 213, 225, 0.82);
        border-radius: 1.5rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.985), rgba(248, 250, 252, 0.97));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.84),
          0 22px 42px -34px rgba(15, 23, 42, 0.2);
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__header {
        margin-bottom: 1.1rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__header--compact {
        margin-bottom: 1rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__header > * + * {
        margin-top: 0.75rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__question-region {
        gap: 0.55rem;
        max-width: 52rem;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-step-card__question-region {
        max-width: 52rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__question-region--visual {
        width: 100%;
        max-width: 100%;
        margin-inline: auto;
        align-items: center;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__question-region:not(.assessment-step-card__question-region--visual) h3 {
        max-width: 47.5rem;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-step-card__question-region h3 {
        max-width: 47.5rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__question-region--compact {
        gap: 0.5rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__fieldset {
        padding-top: 0.15rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__kicker--compact {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.16em;
        color: rgb(100, 116, 139);
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__header--compact h3 {
        font-size: clamp(1.45rem, 2.4vw, 1.85rem);
        font-weight: 600;
        line-height: 1.22;
        letter-spacing: -0.035em;
        color: rgb(15, 23, 42);
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__mwms-block {
        display: grid;
        gap: 0;
        max-width: 43rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__mwms-block h3 {
        margin: 0;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__mwms-label {
        margin: 1.2rem 0 0;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgb(100, 116, 139);
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__mwms-item {
        margin: 0.45rem 0 0;
        max-width: 42rem;
        font-size: 1rem;
        line-height: 1.6;
        color: rgb(51, 65, 85);
        text-wrap: pretty;
      }

      .assessment-run-page--dashboard-skin .assessment-likert__instruction {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 500;
        line-height: 1.45;
        color: rgb(51, 65, 85);
      }

      .assessment-run-page--dashboard-skin .assessment-option,
      .assessment-run-page--dashboard-skin .assessment-likert-option {
        border-color: rgba(203, 213, 225, 0.86);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.76),
          0 16px 28px -26px rgba(15, 23, 42, 0.12);
      }

      .assessment-run-page--dashboard-skin .assessment-option {
        min-height: 4rem;
        border-radius: 1.125rem;
        padding: 0.9rem 1.1rem;
      }

      .assessment-run-page--dashboard-skin .assessment-option:hover {
        border-color: rgba(17, 138, 178, 0.34);
        background: linear-gradient(180deg, rgba(255, 255, 255, 1), rgba(241, 248, 251, 0.94));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.82),
          0 14px 24px -24px rgba(17, 138, 178, 0.12);
      }

      .assessment-run-page--dashboard-skin .assessment-option--selected {
        border-color: rgba(17, 138, 178, 0.55);
        background: linear-gradient(180deg, rgba(241, 248, 251, 0.98), rgba(232, 243, 248, 0.78));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.82),
          0 14px 24px -24px rgba(17, 138, 178, 0.14),
          0 0 0 1px rgba(17, 138, 178, 0.1);
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option--selected {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--likert-border) 42%, #118ab2 58%);
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--likert-bg) 70%, white 30%),
          color-mix(in srgb, rgba(255, 255, 255, 0.99) 82%, rgba(224, 242, 254, 0.98) 18%)
        );
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.84),
          0 0 0 6px color-mix(in srgb, var(--likert-hover-glow) 170%, rgba(17, 138, 178, 0.16) 0%),
          0 14px 22px -22px rgba(17, 138, 178, 0.22);
      }

      .assessment-run-page--dashboard-skin .assessment-options {
        gap: 0.65rem;
      }

      .assessment-run-page--dashboard-skin .assessment-likert {
        padding-top: 0.15rem;
      }

      .assessment-run-page--dashboard-skin .assessment-likert__scale {
        display: grid;
        gap: 0.8rem;
        width: min(100%, 54rem);
        max-width: 54rem;
      }

      .assessment-run-page--dashboard-skin .assessment-likert__labels {
        width: min(100%, 54rem);
        font-size: 0.8rem;
        font-weight: 500;
        color: rgb(71, 85, 105);
        letter-spacing: -0.01em;
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
        align-items: stretch;
        gap: 0.7rem;
        width: min(100%, 54rem);
        max-width: 54rem;
        justify-content: start;
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li {
        min-width: 0;
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option {
        --likert-bg: rgba(244, 250, 252, 0.98);
        --likert-border: rgba(17, 138, 178, 0.18);
        --likert-hover-glow: rgba(17, 138, 178, 0.16);
        --likert-selected-ring: rgba(17, 138, 178, 0.2);
        --likert-selected-shadow: rgba(17, 138, 178, 0.18);
        width: 100%;
        min-height: 3.4rem;
        padding: 0;
        border-color: transparent;
        background: transparent;
        box-shadow: none;
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          box-shadow 180ms ease,
          transform 180ms ease;
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(1) .assessment-likert-option {
        --likert-bg: rgba(245, 251, 253, 0.99);
        --likert-border: rgba(17, 138, 178, 0.16);
        --likert-hover-glow: rgba(17, 138, 178, 0.12);
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(2) .assessment-likert-option {
        --likert-bg: rgba(236, 247, 251, 0.99);
        --likert-border: rgba(17, 138, 178, 0.22);
        --likert-hover-glow: rgba(17, 138, 178, 0.14);
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(3) .assessment-likert-option {
        --likert-bg: rgba(225, 243, 249, 0.99);
        --likert-border: rgba(17, 138, 178, 0.28);
        --likert-hover-glow: rgba(17, 138, 178, 0.16);
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(4) .assessment-likert-option {
        --likert-bg: rgba(212, 238, 246, 0.99);
        --likert-border: rgba(17, 138, 178, 0.34);
        --likert-hover-glow: rgba(17, 138, 178, 0.18);
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(5) .assessment-likert-option {
        --likert-bg: rgba(197, 231, 241, 0.99);
        --likert-border: rgba(17, 138, 178, 0.42);
        --likert-hover-glow: rgba(17, 138, 178, 0.2);
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(6) .assessment-likert-option {
        --likert-bg: rgba(180, 224, 237, 0.99);
        --likert-border: rgba(17, 138, 178, 0.48);
        --likert-hover-glow: rgba(17, 138, 178, 0.22);
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(7) .assessment-likert-option {
        --likert-bg: rgba(161, 215, 232, 0.99);
        --likert-border: rgba(17, 138, 178, 0.54);
        --likert-hover-glow: rgba(17, 138, 178, 0.24);
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option:not(.assessment-likert-option--selected):hover {
        border-color: transparent;
        background: transparent;
        box-shadow: none;
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option__value {
        display: inline-flex;
        width: 100%;
        min-height: 3.4rem;
        align-items: center;
        justify-content: center;
        padding: 0.7rem 0.8rem;
        border: 1px solid var(--likert-border);
        border-radius: 0.95rem;
        background: rgba(255, 255, 255, 0.98);
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: rgb(15, 74, 96);
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          box-shadow 180ms ease,
          color 180ms ease;
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option:not(.assessment-likert-option--selected):hover .assessment-likert-option__value {
        border-color: color-mix(in srgb, var(--likert-border) 68%, #118ab2 32%);
        background: color-mix(in srgb, var(--likert-bg) 78%, white 22%);
        box-shadow: none;
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option:focus-within,
      .assessment-run-page--dashboard-skin .assessment-option:focus-within {
        border-color: rgba(13, 148, 136, 0.9);
        box-shadow:
          0 0 0 4px rgba(45, 212, 191, 0.18),
          inset 0 1px 0 rgba(255, 255, 255, 0.78),
          0 18px 28px -24px rgba(15, 23, 42, 0.14);
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option:focus-within {
        border-color: transparent;
        box-shadow: none;
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option:has(input:focus-visible) .assessment-likert-option__value {
        outline: 2px solid rgba(17, 138, 178, 0.28);
        outline-offset: 2px;
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option--selected {
        border-color: transparent;
        background: transparent;
        box-shadow: none;
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option--selected:hover {
        border-color: transparent;
        background: transparent;
        box-shadow: none;
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option--selected:has(input:focus-visible) .assessment-likert-option__value {
        border-color: rgba(17, 138, 178, 0.72);
        outline-color: rgba(13, 148, 136, 0.32);
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option--selected .assessment-likert-option__value,
      .assessment-run-page--dashboard-skin .assessment-likert-option--selected:hover .assessment-likert-option__value {
        border-color: rgb(13, 148, 136);
        background: rgb(13, 148, 136);
        box-shadow: none;
        color: white;
        font-weight: 800;
      }

      .assessment-run-page--dashboard-skin .assessment-option__marker {
        min-width: 2.125rem;
        min-height: 2.125rem;
        font-size: 0.875rem;
        font-weight: 700;
        border-color: rgba(148, 163, 184, 0.7);
        background: rgba(255, 255, 255, 0.98);
        color: rgb(51, 65, 85);
      }

      .assessment-run-page--dashboard-skin .assessment-option--selected .assessment-option__marker {
        border-color: rgba(17, 138, 178, 0.9);
        background: rgb(17, 138, 178);
        color: white;
        box-shadow: 0 8px 16px -12px rgba(17, 138, 178, 0.32);
      }

      .assessment-run-page--dashboard-skin .assessment-option__label,
      .assessment-run-page--dashboard-skin .assessment-likert__labels {
        color: rgb(30, 41, 59);
      }

      .assessment-run-page--dashboard-skin .assessment-option__label {
        font-size: 1rem;
        font-weight: 600;
        line-height: 1.35;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card--numeric {
        min-height: 12rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card--numeric .assessment-step-card__question-region {
        max-width: 100%;
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-question {
        display: grid;
        gap: 0.85rem;
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-question h3 {
        margin: 0;
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-sequence {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
        align-items: center;
        margin-top: 0.15rem;
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-sequence__token {
        display: inline-flex;
        min-width: 2.75rem;
        min-height: 2.35rem;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(203, 213, 225, 0.92);
        border-radius: 0.85rem;
        background: rgba(255, 255, 255, 0.96);
        color: rgb(15, 23, 42);
        font-size: 1.05rem;
        font-weight: 750;
        line-height: 1;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-sequence__token--unknown {
        border-color: rgba(17, 138, 178, 0.34);
        background: rgba(17, 138, 178, 0.08);
        color: rgb(7, 59, 76);
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-answer {
        display: grid;
        width: fit-content;
        max-width: 100%;
        justify-items: start;
        gap: 1.35rem;
        padding-top: 0.15rem;
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-answer__hint {
        margin: 0;
        color: rgb(71, 85, 105);
        font-size: 0.88rem;
        font-weight: 600;
        line-height: 1.35;
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-answer__field {
        display: grid;
        gap: 0.35rem;
        width: fit-content;
        max-width: 100%;
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-answer__label {
        margin: 0;
        color: rgb(71, 85, 105);
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        line-height: 1;
        text-transform: uppercase;
      }

      .assessment-run-page--dashboard-skin .assessment-text-input--numeric {
        width: min(100%, 14rem);
        min-height: 3.35rem;
        padding: 0.7rem 0.95rem;
        text-align: center;
        color: rgb(15, 23, 42);
        font-size: 1.2rem;
        font-weight: 750;
        letter-spacing: 0.02em;
      }

      .assessment-run-page--dashboard-skin .assessment-text-input--numeric::placeholder {
        color: rgb(148, 163, 184);
        font-size: 0.95rem;
        font-weight: 600;
        letter-spacing: 0;
      }

      .assessment-run-page--dashboard-skin .assessment-text-input--numeric:focus {
        border-color: rgba(17, 138, 178, 0.72);
        box-shadow:
          0 0 0 4px rgba(17, 138, 178, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.82);
        outline: none;
      }

      .assessment-run-page--dashboard-skin .assessment-textarea,
      .assessment-run-page--dashboard-skin .assessment-text-input {
        border-color: rgba(203, 213, 225, 0.88);
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.84);
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-answer .assessment-text-input--numeric {
        width: 10.5rem;
        max-width: 100%;
        min-height: 3.25rem;
        border: 0;
        border-bottom: 2px solid rgba(17, 138, 178, 0.46);
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        padding: 0.35rem 0.25rem 0.45rem;
        text-align: center;
        color: rgb(15, 23, 42);
        font-size: 1.55rem;
        font-weight: 800;
        letter-spacing: 0.03em;
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-answer .assessment-text-input--numeric:hover {
        border-bottom-color: rgba(17, 138, 178, 0.68);
        background: transparent;
      }

      .assessment-run-page--dashboard-skin .assessment-numeric-answer .assessment-text-input--numeric:focus {
        border-bottom-color: rgb(13, 148, 136);
        background: transparent;
        box-shadow: 0 8px 18px -18px rgba(13, 148, 136, 0.5);
        outline: none;
      }

      .assessment-run-page--dashboard-skin .assessment-stimulus-images {
        display: grid;
        place-items: center;
        gap: 0.5rem;
        margin: 0.35rem auto 0;
        width: 100%;
        max-width: 46rem;
      }

      .assessment-run-page--dashboard-skin .assessment-stimulus-images__image,
      .assessment-run-page--dashboard-skin .assessment-option__image {
        display: block;
        width: 100%;
        height: auto;
        border: 1px solid rgb(226, 232, 240);
        border-radius: 0.75rem;
        background: rgb(255, 255, 255);
        object-fit: contain;
      }

      .assessment-run-page--dashboard-skin .assessment-stimulus-images__image {
        justify-self: center;
        margin-inline: auto;
        max-height: 13.25rem;
        max-width: 100%;
      }

      @media (max-width: 760px) {
        .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image,
        .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image-count-5,
        .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image-count-6 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .assessment-run-page--dashboard-skin .assessment-stimulus-images__image {
          max-height: 11rem;
        }
      }

      @media (min-width: 761px) and (max-width: 1180px) {
        .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image,
        .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image-count-5,
        .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image-count-6 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      .assessment-run-page--dashboard-skin .assessment-options--image {
        grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
        gap: 1rem;
        align-items: stretch;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image > li {
        min-width: 0;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image .assessment-option {
        display: grid;
        grid-template-columns: 1fr;
        align-items: stretch;
        min-height: 12rem;
        height: 100%;
        padding: 0.85rem;
        overflow: hidden;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image .assessment-option input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: pointer;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image .assessment-option__marker {
        position: absolute;
        top: 0.7rem;
        left: 0.7rem;
        z-index: 1;
        min-width: 1.85rem;
        min-height: 1.85rem;
        box-shadow: 0 8px 18px -14px rgba(15, 23, 42, 0.5);
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-step-card {
        padding: 1rem 1.15rem;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-step-card__header {
        margin-bottom: 0.65rem;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-step-card__kicker {
        align-self: flex-start;
        text-align: left;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image {
        gap: 0.65rem;
        margin-top: 0.45rem;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image-count-5 {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image-count-6 {
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0.5rem;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image .assessment-option {
        min-height: 7.25rem;
        padding: 0.55rem;
        border-radius: 1rem;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image .assessment-option__image {
        height: 5.8rem;
        padding: 0.35rem;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image .assessment-option__marker {
        top: 0.45rem;
        left: 0.45rem;
        min-width: 1.55rem;
        min-height: 1.55rem;
        font-size: 0.72rem;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image-count-6 .assessment-option {
        min-height: 6.35rem;
        padding: 0.42rem;
        border-radius: 0.9rem;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image-count-6 .assessment-option__image {
        height: 4.95rem;
        padding: 0.28rem;
      }

      .assessment-run-page--dashboard-skin.assessment-step-density--visual .assessment-options--image-count-6 .assessment-option__marker {
        top: 0.35rem;
        left: 0.35rem;
        min-width: 1.42rem;
        min-height: 1.42rem;
        font-size: 0.68rem;
      }

      .assessment-run-page--dashboard-skin .assessment-option__content {
        display: grid;
        width: 100%;
        gap: 0.5rem;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image .assessment-option__content {
        place-items: center;
        min-width: 0;
        height: 100%;
      }

      .assessment-run-page--dashboard-skin .assessment-option__image {
        height: 10rem;
        max-height: none;
        padding: 0.6rem;
        object-fit: contain;
      }

      .assessment-run-page--dashboard-skin .assessment-inline-message {
        border: 1px solid rgba(251, 191, 36, 0.26);
        background: rgba(255, 251, 235, 0.92);
        color: rgb(146, 64, 14);
      }

      .assessment-run-page--dashboard-skin .assessment-inline-message--error {
        border-color: rgba(253, 164, 175, 0.5);
        background: rgba(255, 241, 242, 0.96);
        color: rgb(190, 24, 93);
      }

      .assessment-run-page--dashboard-skin .button-secondary,
      .assessment-run-page--dashboard-skin .assessment-step-actions__button--ghost,
      .assessment-run-page--dashboard-skin .assessment-step-actions__button--save {
        border-color: rgba(203, 213, 225, 0.9);
        background: rgba(255, 255, 255, 0.94);
        color: rgb(51, 65, 85);
        box-shadow: 0 14px 28px -24px rgba(15, 23, 42, 0.12);
      }

      .assessment-run-page--dashboard-skin .assessment-step-actions__button--primary {
        border-color: rgb(15, 118, 110);
        background: rgb(13, 148, 136);
        color: white;
        box-shadow: 0 18px 34px -20px rgba(13, 148, 136, 0.36);
      }

      .assessment-run-page--dashboard-skin .assessment-step-actions__button--primary:hover:not(:disabled) {
        background: rgb(15, 118, 110);
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout__actions-row {
        width: min(100%, 1040px);
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout__actions-secondary {
        flex: 0 0 auto;
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout__actions-secondary .assessment-step-actions__button {
        min-width: 11.5rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-actions__button--dashboard-return {
        border-color: transparent;
        background: rgba(255, 255, 255, 0.18);
        box-shadow: none;
        color: rgb(100, 116, 139);
      }

      .assessment-run-page--dashboard-skin .assessment-step-actions__button--dashboard-return:hover:not(:disabled) {
        border-color: rgba(203, 213, 225, 0.42);
        background: rgba(255, 255, 255, 0.42);
        box-shadow: 0 10px 20px -24px rgba(15, 23, 42, 0.12);
        color: rgb(71, 85, 105);
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout__actions-primary {
        flex: 1 1 auto;
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout__footer {
        position: fixed;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 60;
        width: 100%;
        margin: 0;
        padding: 0.75rem 1rem 0.85rem;
        background: linear-gradient(
          180deg,
          rgba(248, 250, 252, 0),
          rgba(248, 250, 252, 0.92) 28%,
          rgba(248, 250, 252, 0.98)
        );
        backdrop-filter: blur(10px);
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout {
        padding-bottom: 6.25rem;
      }

      .assessment-run-page--dashboard-skin.run-form-layout--compact .assessment-step-layout__actions-row {
        gap: 0.75rem;
      }

      .assessment-run-page--dashboard-skin.run-form-layout--compact .assessment-step-actions__button--dashboard-return {
        border-color: transparent;
        background: transparent;
        box-shadow: none;
        color: rgba(7, 59, 76, 0.82);
      }

      .assessment-run-page--dashboard-skin.run-form-layout--compact .assessment-step-actions__button--dashboard-return:hover:not(:disabled) {
        border-color: transparent;
        background: rgba(7, 59, 76, 0.06);
        box-shadow: none;
        color: rgb(7, 59, 76);
      }

      .assessment-run-page--dashboard-skin.run-form-layout--compact .assessment-step-layout__actions-primary .assessment-step-actions__button--ghost {
        border-color: rgba(203, 213, 225, 0.92);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: none;
        color: rgb(15, 23, 42);
      }

      .assessment-run-page--dashboard-skin.run-form-layout--compact .assessment-step-layout__actions-primary .assessment-step-actions__button--ghost:hover:not(:disabled) {
        border-color: rgba(148, 163, 184, 0.78);
        background: rgba(248, 250, 252, 0.98);
        box-shadow: none;
      }

      @media (max-width: 720px) {
        .assessment-run-page--dashboard-skin .assessment-step-layout__actions-row {
          flex-direction: column;
          align-items: stretch;
        }

        .assessment-run-page--dashboard-skin .assessment-step-layout__actions-primary {
          order: 2;
        }

        .assessment-run-page--dashboard-skin .assessment-step-layout__actions-secondary {
          order: 1;
        }

        .assessment-run-page--dashboard-skin .assessment-step-layout__actions-secondary .assessment-step-actions__button {
          width: 100%;
          min-width: 0;
        }
      }

      @media (min-width: 1024px) and (max-height: 820px) {
        .assessment-run-page--dashboard-skin {
          row-gap: 0.55rem;
        }

        .assessment-run-page--dashboard-skin .run-form-hero {
          padding: 0.8rem 1.1rem;
          border-radius: 1.2rem;
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.07);
        }

        .assessment-run-page--dashboard-skin .run-form-hero__intro {
          gap: 0.75rem;
        }

        .assessment-run-page--dashboard-skin .run-form-hero__intro h1 {
          margin-top: 0.28rem;
          font-size: 1.42rem;
          line-height: 1.03;
        }

        .assessment-run-page--dashboard-skin .run-form-hero__test-pill {
          margin-top: 0.28rem;
          padding: 0.18rem 0.52rem;
          font-size: 0.62rem;
        }

        .assessment-run-page--dashboard-skin .run-form-hero__participant {
          display: none;
        }

        .assessment-run-page--dashboard-skin .assessment-progress {
          padding: 0.65rem 0.85rem;
          border-radius: 0.95rem;
        }

        .assessment-run-page--dashboard-skin .assessment-progress__metric-label {
          font-size: 0.6rem;
          letter-spacing: 0.14em;
        }

        .assessment-run-page--dashboard-skin .assessment-progress__metric-value {
          font-size: 0.88rem;
          line-height: 1.12;
        }

        .assessment-run-page--dashboard-skin .assessment-progress__bar-region {
          margin-top: 0.42rem;
        }

        .assessment-run-page--dashboard-skin .assessment-progress__track {
          height: 0.32rem;
        }

        .assessment-run-page--dashboard-skin .assessment-step-card--numeric {
          min-height: 10.5rem;
        }

        .assessment-run-page--dashboard-skin .assessment-numeric-question {
          gap: 0.65rem;
        }

        .assessment-run-page--dashboard-skin .assessment-numeric-sequence {
          gap: 0.5rem;
        }

        .assessment-run-page--dashboard-skin .assessment-numeric-sequence__token {
          min-width: 2.45rem;
          min-height: 2.05rem;
          font-size: 0.98rem;
        }

        .assessment-run-page--dashboard-skin .assessment-numeric-answer .assessment-text-input--numeric {
          width: 9.5rem;
          min-height: 3.05rem;
          font-size: 1.4rem;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-step-card {
          padding: 0.95rem 1.05rem;
          border-radius: 1.15rem;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-step-card__header {
          margin-bottom: 0.55rem;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-step-card__header > * + * {
          margin-top: 0.35rem;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-step-card__kicker {
          font-size: 0.62rem;
          letter-spacing: 0.14em;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-step-card__header h3 {
          font-size: clamp(0.92rem, 1.25vw, 1.08rem);
          line-height: 1.12;
          max-width: 42rem;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-step-card__fieldset {
          padding-top: 0;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-options {
          gap: 0.38rem;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-option {
          min-height: 3rem;
          padding: 0.52rem 0.78rem;
          border-radius: 0.85rem;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-option__marker {
          min-width: 1.75rem;
          min-height: 1.75rem;
          font-size: 0.74rem;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-option__label {
          font-size: 0.9rem;
          line-height: 1.2;
        }

        .assessment-run-page--dashboard-skin .assessment-step-layout__actions-row {
          gap: 0.75rem;
        }

        .assessment-run-page--dashboard-skin .assessment-step-actions__button {
          min-height: 2.6rem;
          padding-top: 0.55rem;
          padding-bottom: 0.55rem;
        }
      }

      @media (min-width: 1024px) and (max-height: 740px) {
        .assessment-run-page--dashboard-skin {
          row-gap: 0.65rem;
        }

        .assessment-run-page--dashboard-skin .run-form-hero {
          padding: 0.85rem 1.1rem;
        }

        .assessment-run-page--dashboard-skin .run-form-hero__intro h1 {
          font-size: 1.45rem;
        }

        .assessment-run-page--dashboard-skin .run-form-hero__participant {
          display: none;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-step-card {
          padding: 1rem 1.1rem;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-step-card__header h3 {
          font-size: clamp(0.95rem, 1.35vw, 1.12rem);
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-options {
          gap: 0.42rem;
        }

        .assessment-run-page--dashboard-skin.assessment-step-density--verbal .assessment-option {
          min-height: 3.2rem;
          padding: 0.62rem 0.85rem;
        }

      }

      .assessment-run-page--dashboard-skin .assessment-completion-state {
        border: 1px solid rgba(203, 213, 225, 0.82);
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(243, 249, 249, 0.96) 58%, rgba(246, 242, 255, 0.94));
        box-shadow: 0 28px 60px rgba(15, 23, 42, 0.08);
      }

      .assessment-run-page--dashboard-skin .assessment-completion-state__hero h2,
      .assessment-run-page--dashboard-skin .assessment-completion-state__description,
      .assessment-run-page--dashboard-skin .assessment-completion-state__status {
        color: rgb(15, 23, 42);
      }

      .assessment-run-page--dashboard-skin .assessment-eyebrow {
        color: rgb(13, 148, 136);
      }
    `}</style>
  );
}

export function AssessmentForm({
  executionMode = "public",
  layoutMode = "classic",
  completionRedirectPath = null,
  assessmentDisplayName = null,
  participantDisplayName = null,
  testSlug = null,
  testId,
  locale = DEFAULT_ASSESSMENT_LOCALE,
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
  const [selections, setSelections] = useState<SelectionState>({ ...initialSelections });
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
      ? "Procjena je završena. Vaši odgovori su zaključani."
      : null,
  );
  const [protectedCompletionUiPhase, setProtectedCompletionUiPhase] =
    useState<ProtectedCompletionUiPhase>(null);
  const [stepValidationMessage, setStepValidationMessage] = useState<string | null>(null);
  const requestInFlightRef = useRef(false);
  const manualSaveResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const numericInputRef = useRef<HTMLInputElement | null>(null);
  const effectiveSelections = getEffectiveSelections(selections);
  const [showManualSaveSuccess, setShowManualSaveSuccess] = useState(false);

  const isCompleted = attemptStatus === "completed";
  const isBusy = saveStatus === "saving" || saveStatus === "completing";
  const isStepLayout = layoutMode === "step";
  const completionState = getAssessmentCompletionState(questions, effectiveSelections);
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
  const currentSelection = currentQuestion ? effectiveSelections[currentQuestion.id] : undefined;
  const progressPercent =
    questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
  const isInteractionLocked = isBusy || requestInFlightRef.current;

  function clearManualSaveSuccessFeedback() {
    if (manualSaveResetTimeoutRef.current) {
      clearTimeout(manualSaveResetTimeoutRef.current);
      manualSaveResetTimeoutRef.current = null;
    }

    setShowManualSaveSuccess(false);
  }

  function showManualSaveSuccessFeedback() {
    clearManualSaveSuccessFeedback();
    setShowManualSaveSuccess(true);
    manualSaveResetTimeoutRef.current = setTimeout(() => {
      setShowManualSaveSuccess(false);
      manualSaveResetTimeoutRef.current = null;
    }, MANUAL_SAVE_SUCCESS_DURATION_MS);
  }

  useEffect(() => () => {
    if (manualSaveResetTimeoutRef.current) {
      clearTimeout(manualSaveResetTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    clearManualSaveSuccessFeedback();
  }, [currentQuestionIndex, currentQuestion?.id]);

  useEffect(() => {
    if (
      !isStepLayout ||
      currentQuestion?.renderer_type !== "numeric_input" ||
      isInteractionLocked
    ) {
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      numericInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [isStepLayout, currentQuestion?.id, currentQuestion?.renderer_type, isInteractionLocked]);

  async function persistSelections(
    nextSelections: SelectionState,
    options?: {
      selections?: AssessmentSelectionsInput;
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
        locale,
        selections:
          options?.selections ?? getEffectiveSelections(nextSelections),
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
    clearManualSaveSuccessFeedback();
    const didSave = await persistSelections(selections, {
      selections:
        isStepLayout && currentQuestion
          ? getQuestionSelectionDelta(selections, currentQuestion.id)
          : getEffectiveSelections(selections),
    });

    if (didSave) {
      showManualSaveSuccessFeedback();
    }
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
        locale,
        selections: effectiveSelections,
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
        router.replace(completionRedirectPath);
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
    const didSave = await persistSelections(nextSelections, {
      selections: getQuestionSelectionDelta(nextSelections, currentQuestion.id),
    });

    if (!didSave || isLastQuestion) {
      return;
    }

    setCurrentQuestionIndex((currentIndex) => Math.min(currentIndex + 1, questions.length - 1));
  }

  async function handleSingleChoiceStepConfirmation() {
    if (!currentQuestion || isInteractionLocked) {
      return;
    }

    await handleAdvance();
  }

  function handleBack() {
    if (isInteractionLocked) {
      return;
    }

    clearManualSaveSuccessFeedback();
    setCurrentQuestionIndex((currentIndex) => Math.max(currentIndex - 1, 0));
    setStepValidationMessage(null);
  }

  async function handleAdvance() {
    if (!currentQuestion || isInteractionLocked) {
      return;
    }

    if (!isQuestionAnswered(currentQuestion, currentSelection)) {
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

    const didSave = await persistSelections(selections, {
      selections: getQuestionSelectionDelta(selections, currentQuestion.id),
    });

    if (!didSave) {
      return;
    }

    setCurrentQuestionIndex((currentIndex) => Math.min(currentIndex + 1, questions.length - 1));
  }

  if (questions.length === 0) {
    return <p>No questions available.</p>;
  }

  if (executionMode === "protected" && protectedCompletionUiPhase) {
    return (
      <>
        <AssessmentDashboardSkinStyles />
        <ReportGenerationLoadingScreen
          status={protectedCompletionUiPhase === "redirecting" ? "ready" : "processing"}
          testSlug={null}
          testName={assessmentDisplayName ?? null}
          participantName={participantDisplayName ?? null}
        />
      </>
    );
  }

  if (isStepLayout && !isCompleted && currentQuestion) {
    const options = answerOptionsByQuestionId[currentQuestion.id] ?? [];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const hasValidCurrentAnswer = isQuestionAnswered(currentQuestion, currentSelection);
    const isLikertQuestion = isLikertScaleQuestion(currentQuestion, options);
    const isImageQuestion = isImageChoiceQuestion(currentQuestion, options);
    const isNumericInputQuestion = currentQuestion.renderer_type === "numeric_input";
    const isMwmsQuestion = isMwmsAssessmentSlug(testSlug) && isLikertQuestion;
    const numericSequenceQuestion = isNumericInputQuestion
      ? parseNumericSequenceQuestionText(currentQuestion.text)
      : null;
    const imageOptionsCountClassName = isImageQuestion
      ? ` assessment-options--image-count-${options.length}`
      : "";
    const visibleQuestionText = isImageQuestion ? getVisibleQuestionText(currentQuestion) : currentQuestion.text;
    const stepShellWidthClassName = "max-w-[1040px]";
    const stepDensityClassName = isImageQuestion
      ? "assessment-step-density--visual"
      : "assessment-step-density--verbal";
    const shouldUseTopCompactLayout = false;
    const likertAssessmentCode = getLikertAssessmentCode(assessmentDisplayName);
    const shouldAutoAdvance = isLikertQuestion && !isLastQuestion;
    const shouldShowFinishButton = isLastQuestion && hasValidCurrentAnswer;
    const shouldShowContinueButton = !isLastQuestion && !shouldAutoAdvance;
    const shouldShowPrimaryButton = shouldShowContinueButton || shouldShowFinishButton;
    const stepActionsClassName = shouldShowPrimaryButton
      ? "assessment-step-actions"
      : "assessment-step-actions assessment-step-actions--compact";

    return (
      <div
        className={`run-form-layout assessment-run-page--dashboard-skin mx-auto grid w-full ${stepShellWidthClassName} ${stepDensityClassName} gap-4${
          isLikertQuestion
            ? ` run-form-layout--compact${shouldUseTopCompactLayout ? " run-form-layout--top-compact" : ""}`
            : ""
        }`}
      >
          <AssessmentDashboardSkinStyles />
          <section className={`run-form-hero${isLikertQuestion ? " run-form-hero--compact" : ""}`}>
          <div aria-hidden="true" className="run-form-hero__top-line" />
          <div className="run-form-hero__content">
            <div className={`run-form-hero__intro${isLikertQuestion ? " run-form-hero__intro--compact" : ""}`}>
              <div className="run-form-hero__identity">
                <div className={`run-form-hero__title-group${isLikertQuestion ? " run-form-hero__title-group--compact" : ""}`}>
                  {isLikertQuestion ? (
                    <>
                      <h1>Procjena ličnosti</h1>
                      <div className="run-form-hero__meta">
                        {likertAssessmentCode ? (
                          <span className="run-form-hero__meta-pill run-form-hero__meta-pill--code">
                            {likertAssessmentCode}
                          </span>
                        ) : null}
                        <span className="run-form-hero__meta-pill run-form-hero__meta-pill--count">
                          {questions.length} pitanja
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="run-form-hero__eyebrow">Procjena</p>
                      <h1>Test kognitivnih sposobnosti</h1>
                      <span className="run-form-hero__test-pill">
                        {assessmentDisplayName ?? "SAFRAN"}
                      </span>
                      {participantDisplayName ? (
                        <p
                          className={`run-form-hero__participant${
                            isLikertQuestion ? " run-form-hero__participant--compact" : ""
                          }`}
                        >
                          {participantDisplayName}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div
                className={`assessment-progress${isLikertQuestion ? " assessment-progress--compact" : ""}`}
                aria-label="Trenutni napredak"
              >
                <div
                  className={`assessment-progress__summary${
                    isLikertQuestion ? " assessment-progress__summary--compact" : ""
                  }`}
                  aria-label="Trenutni napredak"
                >
                  <div
                    className={`assessment-progress__metric${
                      isLikertQuestion ? " assessment-progress__metric--compact" : ""
                    }`}
                  >
                    <span className="assessment-progress__metric-label">Progres</span>
                    <p className="assessment-progress__metric-value">
                      Pitanje {currentQuestionIndex + 1} od {questions.length}
                    </p>
                  </div>
                </div>

                <div
                  className={`assessment-progress__bar-region${
                    isLikertQuestion ? " assessment-progress__bar-region--compact" : ""
                  }`}
                >
                  <div aria-hidden="true" className="assessment-progress__track">
                    <div
                      className="assessment-progress__fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          </section>

          <div className="assessment-step-layout">
          <section
            className={`assessment-step-card${isLikertQuestion ? " assessment-step-card--compact" : ""}${
              isNumericInputQuestion ? " assessment-step-card--numeric" : ""
            }`}
          >
            <div
              className={`assessment-step-card__header${
                isLikertQuestion ? " assessment-step-card__header--compact" : ""
              }`}
            >
              <div
                className={`assessment-step-card__question-region${
                  isLikertQuestion
                    ? " assessment-step-card__question-region--stable assessment-step-card__question-region--compact"
                    : ""
                }${isImageQuestion ? " assessment-step-card__question-region--visual" : ""
                }`}
              >
                <p
                  className={`assessment-step-card__kicker${
                    isLikertQuestion ? " assessment-step-card__kicker--compact" : ""
                  }`}
                >
                  Pitanje {currentQuestionIndex + 1}
                </p>
                {isNumericInputQuestion && numericSequenceQuestion ? (
                  <div className="assessment-numeric-question">
                    <h3>{numericSequenceQuestion.prompt}</h3>
                    <div className="assessment-numeric-sequence" aria-label={currentQuestion.text}>
                      {numericSequenceQuestion.tokens.map((token, tokenIndex) => (
                        <span
                          key={`${currentQuestion.id}-numeric-token-${tokenIndex}`}
                          className={`assessment-numeric-sequence__token${
                            token === "?" ? " assessment-numeric-sequence__token--unknown" : ""
                          }`}
                        >
                          {token}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : isMwmsQuestion ? (
                  <div className="assessment-step-card__mwms-block">
                    <h3>{MWMS_SHARED_STEM}</h3>
                    <p className="assessment-step-card__mwms-label">{MWMS_REASON_LABEL}</p>
                    {visibleQuestionText ? (
                      <p className="assessment-step-card__mwms-item">{visibleQuestionText}</p>
                    ) : null}
                  </div>
                ) : visibleQuestionText ? (
                  <h3>{visibleQuestionText}</h3>
                ) : null}
                <AssessmentStimulusImages question={currentQuestion} />
              </div>
            </div>

            <fieldset className="assessment-step-card__fieldset" disabled={isInteractionLocked}>
              <legend className="sr-only">
                {visibleQuestionText ?? `Pitanje ${currentQuestionIndex + 1}`}
              </legend>

              {currentQuestion.question_type === "text" ? (
                currentQuestion.renderer_type === "numeric_input" ? (
                  <div className="assessment-numeric-answer">
                    <p className="assessment-numeric-answer__hint">Unesi sljedeći broj u nizu.</p>
                    <div className="assessment-numeric-answer__field">
                      <p className="assessment-numeric-answer__label">Tvoj odgovor</p>
                      <input
                        aria-label="Tvoj odgovor"
                        autoFocus
                        className="assessment-text-input assessment-text-input--numeric"
                        inputMode="decimal"
                        pattern="-?[0-9]+([\\.,][0-9]+)?"
                        ref={numericInputRef}
                        type="text"
                        value={typeof currentSelection === "string" ? currentSelection : ""}
                        onChange={(event) => {
                          const nextValue = getNextNumericInputValue(event.target.value);

                          if (nextValue === null) {
                            return;
                          }

                          updateSelection(currentQuestion.id, nextValue);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleAdvance();
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <textarea
                    className="assessment-textarea"
                    value={typeof currentSelection === "string" ? currentSelection : ""}
                    onChange={(event) => {
                      updateSelection(currentQuestion.id, event.target.value);
                    }}
                    rows={4}
                  />
                )
              ) : isLikertQuestion ? (
                <div className="assessment-likert">
                  <div className="assessment-likert__scale">
                    {isMwmsQuestion ? (
                      <p className="assessment-likert__instruction">{MWMS_SCALE_INSTRUCTION}</p>
                    ) : null}
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
                                onClick={() => {
                                  if (isSelected && !isLastQuestion) {
                                    void handleSingleChoiceStepConfirmation();
                                  }
                                }}
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
                  </div>
                </div>
              ) : options.length > 0 ? (
                <ol
                  className={`assessment-options${isImageQuestion ? " assessment-options--image" : ""}${imageOptionsCountClassName}`}
                >
                  {options.map((option) => {
                    const inputId = `${currentQuestion.id}-${option.option_order}`;

                    if (currentQuestion.question_type === "multiple_choice") {
                      const selectedOptionIds = Array.isArray(currentSelection)
                        ? currentSelection
                        : [];
                      const isSelected = selectedOptionIds.includes(option.id);

                      return (
                        <li key={option.id}>
                          <label
                            className={`assessment-option${
                              isSelected ? " assessment-option--selected" : ""
                            }`}
                            htmlFor={inputId}
                          >
                            <input
                              id={inputId}
                              type="checkbox"
                              checked={isSelected}
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
                            <span className="assessment-option__content">
                              <AssessmentOptionMedia option={option} />
                              {isImageQuestion ? (
                                <span className="sr-only">{option.label}</span>
                              ) : (
                                <span className="assessment-option__label">{option.label}</span>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    }

                    return (
                      <li key={option.id}>
                        <label
                          className={`assessment-option${
                            currentSelection === option.id ? " assessment-option--selected" : ""
                          }`}
                          htmlFor={inputId}
                        >
                          <input
                            id={inputId}
                            type="radio"
                            name={currentQuestion.id}
                            checked={currentSelection === option.id}
                            onClick={() => {
                              if (currentSelection === option.id && !isLastQuestion) {
                                void handleSingleChoiceStepConfirmation();
                              }
                            }}
                            onChange={() => {
                              updateSelection(currentQuestion.id, option.id);
                            }}
                          />
                          <span className="assessment-option__marker">{option.option_order}</span>
                          <span className="assessment-option__content">
                            <AssessmentOptionMedia option={option} />
                            {isImageQuestion ? (
                              <span className="sr-only">{option.label}</span>
                            ) : (
                              <span className="assessment-option__label">{option.label}</span>
                            )}
                          </span>
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

            {saveStatus === "error" && saveMessage ? (
              <p
                className="assessment-inline-message assessment-inline-message--error"
              >
                {saveMessage}
              </p>
            ) : null}
          </section>

          <div className="assessment-step-layout__footer">
            <div className="assessment-step-layout__actions-row">
              <div className="assessment-step-layout__actions-secondary">
                <button
                  className="assessment-step-actions__button assessment-step-actions__button--ghost assessment-step-actions__button--dashboard-return"
                  type="button"
                  onClick={() => router.push("/app")}
                >
                  Nazad na dashboard
                </button>
              </div>

              <div className={`assessment-step-layout__actions-primary ${stepActionsClassName}`}>
                <button
                  className="assessment-step-actions__button assessment-step-actions__button--ghost"
                  type="button"
                  onClick={handleBack}
                  disabled={isInteractionLocked || currentQuestionIndex === 0}
                >
                  Nazad
                </button>

                {shouldShowPrimaryButton ? (
                  <button
                    className="assessment-step-actions__button assessment-step-actions__button--primary"
                    type="button"
                    onClick={handleAdvance}
                    disabled={isInteractionLocked}
                  >
                    {saveStatus === "completing"
                      ? "Završavanje..."
                      : shouldShowFinishButton
                        ? "Završi procjenu"
                        : "Nastavi"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          </div>
      </div>
    );
  }

  return (
    <>
      {isCompleted ? (
        <CompletedAssessmentSummary
          completedAt={completedAt}
          locale={locale}
          results={results}
          reportState={reportState}
        />
      ) : null}

      <ol>
        {questions.map((question) => {
          const options = answerOptionsByQuestionId[question.id] ?? [];
          const selection = selections[question.id];
          const isImageQuestion = isImageChoiceQuestion(question, options);
          const visibleQuestionText = isImageQuestion ? getVisibleQuestionText(question) : question.text;

          return (
            <li key={question.id}>
              <fieldset disabled={isCompleted}>
                <legend>{visibleQuestionText ?? "Pitanje"}</legend>
                <AssessmentStimulusImages question={question} />

                {question.question_type === "text" ? (
                  question.renderer_type === "numeric_input" ? (
                    <input
                      className="assessment-text-input"
                      inputMode="decimal"
                      pattern="-?[0-9]+([\\.,][0-9]+)?"
                      type="text"
                      value={typeof selection === "string" ? selection : ""}
                      onChange={(event) => {
                        const nextValue = getNextNumericInputValue(event.target.value);

                        if (nextValue === null) {
                          return;
                        }

                        updateSelection(question.id, nextValue);
                      }}
                    />
                  ) : (
                    <textarea
                      value={typeof selection === "string" ? selection : ""}
                      onChange={(event) => {
                        updateSelection(question.id, event.target.value);
                      }}
                      rows={3}
                    />
                  )
                ) : options.length > 0 ? (
                  <ol className={isImageQuestion ? "assessment-options assessment-options--image" : undefined}>
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
                              <AssessmentOptionMedia option={option} />
                              {isImageQuestion ? <span className="sr-only">{option.label}</span> : option.label}
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
                            <AssessmentOptionMedia option={option} />
                            {isImageQuestion ? <span className="sr-only">{option.label}</span> : option.label}
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

      {saveStatus === "error" && saveMessage ? <p>{saveMessage}</p> : null}
    </>
  );
}
