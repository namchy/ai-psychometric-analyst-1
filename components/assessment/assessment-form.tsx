"use client";

import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  completeProtectedAssessmentAttempt,
  completeAssessmentAttempt,
  saveProtectedAssessmentProgress,
  saveAssessmentProgress,
} from "@/app/actions/assessment";
import { logout } from "@/app/actions/auth";
import { CompletedAssessmentSummary } from "@/components/assessment/completed-assessment-summary";
import type { AssessmentCompletionState } from "@/lib/assessment/completion";
import { getAssessmentCompletionState, isQuestionAnswered } from "@/lib/assessment/completion";
import type { CompletedAssessmentReportState } from "@/lib/assessment/reports";
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

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const RUN_PAGE_PRIMARY_NAV_ITEMS = ["Testovi", "Reports"] as const;

type AssessmentFormProps = {
  executionMode?: "public" | "protected";
  layoutMode?: "classic" | "step";
  completionRedirectPath?: string | null;
  assessmentDisplayName?: string | null;
  participantDisplayName?: string | null;
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

function getEffectiveSelections(
  initialSelections: AssessmentSelectionsInput,
  selections: SelectionState,
): Record<string, AssessmentSelectionValue> {
  return {
    ...initialSelections,
    ...getSerializableSelections(selections),
  };
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

function AssessmentDashboardSkinStyles() {
  return (
    <style jsx global>{`
      .assessment-run-page--dashboard-skin,
      .assessment-run-page--dashboard-skin :where(h1, h2, h3, h4, p, span, label, legend, button, input, textarea) {
        font-family: ${plusJakartaSans.style.fontFamily};
      }

      .assessment-run-page--dashboard-skin .run-form-hero {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(203, 213, 225, 0.78);
        border-radius: 1.75rem;
        padding: 1.5rem;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(243, 249, 249, 0.97) 58%, rgba(246, 242, 255, 0.95));
        box-shadow: 0 28px 60px rgba(15, 23, 42, 0.1);
      }

      @media (min-width: 640px) {
        .assessment-run-page--dashboard-skin .run-form-hero {
          padding: 1.75rem;
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

      .assessment-run-page--dashboard-skin .run-form-hero__intro {
        display: grid;
        gap: 1.5rem;
      }

      @media (min-width: 1024px) {
        .assessment-run-page--dashboard-skin .run-form-hero__intro {
          grid-template-columns: minmax(0, 1fr) minmax(300px, 340px);
          gap: 1.5rem;
          align-items: start;
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
        font-family: ${plusJakartaSans.style.fontFamily};
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
        margin: 0.75rem 0 0;
        max-width: 42rem;
        font-size: 1.875rem;
        font-weight: 800;
        line-height: 1.05;
        color: rgb(2, 6, 23);
      }

      @media (min-width: 640px) {
        .assessment-run-page--dashboard-skin .run-form-hero__intro h1 {
          font-size: 2.25rem;
        }
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__header h3 {
        font-size: clamp(1.72rem, 3vw, 2.3rem);
        font-weight: 600;
        line-height: 1.18;
        text-wrap: pretty;
        max-width: 100%;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__participant {
        margin: 0.5rem 0 0;
        max-width: 42rem;
        font-size: 15px;
        line-height: 1.75;
        color: rgb(71, 85, 105);
      }

      .assessment-run-page--dashboard-skin .assessment-completion-state__hero > * + * {
        margin-top: 0.75rem;
      }

      .assessment-run-page--dashboard-skin .assessment-progress {
        border: 1px solid rgba(191, 219, 254, 0.7);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(240, 249, 255, 0.92));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.78),
          0 18px 32px -28px rgba(15, 23, 42, 0.12);
      }

      .assessment-run-page--dashboard-skin .assessment-progress__metric-label,
      .assessment-run-page--dashboard-skin .assessment-step-card__kicker {
        color: rgb(13, 148, 136);
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .assessment-run-page--dashboard-skin .assessment-progress__metric-value,
      .assessment-run-page--dashboard-skin .assessment-progress-note {
        color: rgb(15, 23, 42);
      }

      .assessment-run-page--dashboard-skin .assessment-progress__track {
        background: linear-gradient(180deg, rgb(226, 232, 240), rgb(241, 245, 249));
        box-shadow: inset 0 1px 2px rgba(148, 163, 184, 0.24);
      }

      .assessment-run-page--dashboard-skin .assessment-progress__fill {
        background: linear-gradient(90deg, rgb(13, 148, 136), rgb(45, 212, 191));
        box-shadow: 0 10px 20px -16px rgba(13, 148, 136, 0.45);
      }

      .assessment-run-page--dashboard-skin .assessment-step-card {
        border: 1px solid rgba(203, 213, 225, 0.86);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.98));
        box-shadow:
          0 24px 56px rgba(15, 23, 42, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.82);
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__header {
        margin-bottom: 1.35rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__header > * + * {
        margin-top: 1rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__question-region {
        gap: 0.7rem;
        max-width: 60rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__fieldset {
        padding-top: 0.15rem;
      }

      .assessment-run-page--dashboard-skin .assessment-option,
      .assessment-run-page--dashboard-skin .assessment-likert-option {
        border-color: rgba(203, 213, 225, 0.86);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.76),
          0 16px 28px -26px rgba(15, 23, 42, 0.12);
      }

      .assessment-run-page--dashboard-skin .assessment-option:hover {
        border-color: rgba(94, 234, 212, 0.85);
        background: linear-gradient(180deg, rgba(255, 255, 255, 1), rgba(240, 253, 250, 0.88));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.82),
          0 18px 30px -24px rgba(13, 148, 136, 0.14);
      }

      .assessment-run-page--dashboard-skin .assessment-option--selected {
        border-color: rgba(20, 184, 166, 0.65);
        background: linear-gradient(180deg, rgba(240, 253, 250, 0.98), rgba(236, 252, 203, 0.58));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.82),
          0 18px 30px -24px rgba(13, 148, 136, 0.16),
          0 0 0 1px rgba(45, 212, 191, 0.18);
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option--selected {
        border-color: color-mix(in srgb, var(--likert-border) 30%, #6f65ab 70%);
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--likert-bg) 62%, #9c94c9 38%),
          color-mix(in srgb, white 20%, #9c94c9 80%)
        );
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.3),
          0 0 0 1px rgba(111, 101, 171, 0.16),
          0 0 0 6px var(--likert-selected-ring),
          0 18px 26px -22px var(--likert-selected-shadow);
      }

      .assessment-run-page--dashboard-skin .assessment-options {
        gap: 0.75rem;
      }

      .assessment-run-page--dashboard-skin .assessment-likert {
        padding-top: 0.15rem;
      }

      .assessment-run-page--dashboard-skin .assessment-likert__scale {
        gap: 1rem;
      }

      .assessment-run-page--dashboard-skin .assessment-likert__labels {
        font-size: 0.8rem;
        font-weight: 500;
        color: rgb(71, 85, 105);
        letter-spacing: -0.01em;
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options {
        gap: 0.65rem;
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option {
        --likert-bg: rgba(246, 244, 252, 0.98);
        --likert-border: rgba(174, 166, 212, 0.38);
        --likert-hover-glow: rgba(191, 184, 227, 0.34);
        --likert-selected-ring: rgba(137, 126, 191, 0.22);
        --likert-selected-shadow: rgba(125, 113, 182, 0.18);
        min-height: 4.5rem;
        border-color: var(--likert-border);
        background: linear-gradient(180deg, var(--likert-bg), rgba(255, 255, 255, 0.98));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.82),
          0 14px 24px -24px rgba(82, 69, 141, 0.18);
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          box-shadow 180ms ease,
          transform 180ms ease;
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(1) .assessment-likert-option {
        --likert-bg: rgba(248, 246, 253, 0.99);
        --likert-border: rgba(181, 173, 220, 0.34);
        --likert-hover-glow: rgba(214, 209, 239, 0.34);
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(2) .assessment-likert-option {
        --likert-bg: rgba(239, 235, 249, 0.99);
        --likert-border: rgba(172, 163, 214, 0.38);
        --likert-hover-glow: rgba(205, 197, 234, 0.34);
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(3) .assessment-likert-option {
        --likert-bg: rgba(228, 222, 244, 0.99);
        --likert-border: rgba(161, 151, 205, 0.42);
        --likert-hover-glow: rgba(193, 184, 225, 0.34);
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(4) .assessment-likert-option {
        --likert-bg: rgba(216, 208, 239, 0.99);
        --likert-border: rgba(149, 138, 197, 0.44);
        --likert-hover-glow: rgba(182, 171, 220, 0.34);
      }

      .assessment-run-page--dashboard-skin .assessment-likert__options > li:nth-child(5) .assessment-likert-option {
        --likert-bg: rgba(201, 192, 231, 0.99);
        --likert-border: rgba(138, 126, 190, 0.48);
        --likert-hover-glow: rgba(169, 157, 213, 0.32);
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option:hover {
        border-color: color-mix(in srgb, var(--likert-border) 72%, #9c94c9 28%);
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--likert-bg) 82%, white 18%),
          rgba(255, 255, 255, 0.99)
        );
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.84),
          0 0 0 5px var(--likert-hover-glow),
          0 14px 22px -24px rgba(99, 86, 156, 0.2);
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option__value {
        font-weight: 700;
        letter-spacing: -0.02em;
        color: rgb(49, 46, 95);
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
        border-color: rgba(124, 113, 182, 0.78);
        box-shadow:
          0 0 0 4px rgba(190, 181, 228, 0.28),
          inset 0 1px 0 rgba(255, 255, 255, 0.82),
          0 14px 22px -22px rgba(99, 86, 156, 0.22);
      }

      .assessment-run-page--dashboard-skin .assessment-likert-option--selected .assessment-likert-option__value {
        color: rgb(35, 30, 78);
      }

      .assessment-run-page--dashboard-skin .assessment-option__marker {
        border-color: rgba(148, 163, 184, 0.7);
        background: rgba(255, 255, 255, 0.98);
        color: rgb(51, 65, 85);
      }

      .assessment-run-page--dashboard-skin .assessment-option--selected .assessment-option__marker {
        border-color: rgba(13, 148, 136, 0.86);
        background: linear-gradient(180deg, rgb(15, 118, 110), rgb(13, 148, 136));
        color: white;
        box-shadow: 0 8px 16px -12px rgba(13, 148, 136, 0.38);
      }

      .assessment-run-page--dashboard-skin .assessment-option__label,
      .assessment-run-page--dashboard-skin .assessment-likert__labels {
        color: rgb(30, 41, 59);
      }

      .assessment-run-page--dashboard-skin .assessment-textarea {
        border-color: rgba(203, 213, 225, 0.88);
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.84);
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
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout__actions-secondary {
        flex: 0 0 auto;
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout__actions-secondary .assessment-step-actions__button {
        min-width: 13.5rem;
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

      @media (max-width: 720px) {
        .assessment-run-page--dashboard-skin .assessment-step-layout__actions-row {
          flex-direction: column;
          align-items: stretch;
        }

        .assessment-run-page--dashboard-skin .assessment-step-layout__actions-secondary .assessment-step-actions__button {
          width: 100%;
          min-width: 0;
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

function getRunPageTopBarInitials(userName?: string | null, userEmail?: string | null) {
  const source = userName?.trim() || userEmail?.trim() || "Deep Profile";

  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function RunPageTopBar({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName?: string | null;
}) {
  const initials = getRunPageTopBarInitials(userName, userEmail);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-slate-300/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.94),rgba(243,247,251,0.9))] shadow-[0_16px_40px_rgba(15,23,42,0.07)] backdrop-blur-xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-200/70 to-transparent"
      />
      <div className="mx-auto flex h-16 w-full max-w-full items-center justify-between px-4 sm:px-6 lg:px-12">
        <div className="flex min-w-0 items-center gap-6 lg:gap-10">
          <Link
            href="/app"
            className="shrink-0 font-headline text-lg font-bold tracking-[-0.04em] text-slate-900 transition-opacity hover:opacity-90 sm:text-xl"
          >
            Deep Profile
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-2 lg:flex">
            {RUN_PAGE_PRIMARY_NAV_ITEMS.map((item) => (
              <span
                key={item}
                className={
                  item === "Testovi"
                    ? "rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                    : "rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:bg-white hover:text-slate-900"
                }
              >
                {item}
              </span>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
          <button
            aria-label="Settings"
            className="min-h-0 rounded-xl border border-transparent bg-transparent p-2 text-slate-500 shadow-none transition-all duration-200 hover:border-slate-200 hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="2.8" />
              <path d="M12 4.5v1.3" />
              <path d="M12 18.2v1.3" />
              <path d="m6.7 6.7.9.9" />
              <path d="m16.4 16.4.9.9" />
              <path d="M4.5 12h1.3" />
              <path d="M18.2 12h1.3" />
              <path d="m6.7 17.3.9-.9" />
              <path d="m16.4 7.6.9-.9" />
            </svg>
          </button>

          <div className="ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/80 bg-gradient-to-br from-teal-500 to-violet-400 text-xs font-bold text-white shadow-[0_10px_24px_rgba(20,184,166,0.22)]">
            <span>{initials || "DP"}</span>
          </div>

          <form action={logout} className="hidden md:block">
            <button
              className="min-h-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-label font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-teal-200 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              type="submit"
            >
              Odjava
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function AssessmentForm({
  executionMode = "public",
  layoutMode = "classic",
  completionRedirectPath = null,
  assessmentDisplayName = null,
  participantDisplayName = null,
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
      ? "Procjena je završena. Vaši odgovori su zaključani."
      : null,
  );
  const [protectedCompletionUiPhase, setProtectedCompletionUiPhase] =
    useState<ProtectedCompletionUiPhase>(null);
  const [stepValidationMessage, setStepValidationMessage] = useState<string | null>(null);
  const requestInFlightRef = useRef(false);
  const manualSaveResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveSelections = getEffectiveSelections(initialSelections, selections);
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
        locale,
        selections: getEffectiveSelections(initialSelections, nextSelections),
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
    const didSave = await persistSelections(selections);

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
    const didSave = await persistSelections(nextSelections);

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
      <>
        <AssessmentDashboardSkinStyles />
        <section
          aria-live="polite"
          aria-busy="true"
          className={`${plusJakartaSans.className} assessment-completion-state assessment-run-page--dashboard-skin`}
          role="status"
        >
          <div className="assessment-completion-state__hero">
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
      </>
    );
  }

  if (isStepLayout && !isCompleted && currentQuestion) {
    const options = answerOptionsByQuestionId[currentQuestion.id] ?? [];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const hasValidCurrentAnswer = isQuestionAnswered(
      currentQuestion.question_type,
      currentSelection,
    );
    const isLikertQuestion = isLikertScaleQuestion(currentQuestion, options);
    const shouldAutoAdvance = isLikertQuestion && !isLastQuestion;
    const shouldShowFinishButton = isLastQuestion && hasValidCurrentAnswer;
    const shouldShowContinueButton = !isLastQuestion && !shouldAutoAdvance;
    const shouldShowSaveButton = !shouldShowFinishButton;
    const shouldShowPrimaryButton = shouldShowContinueButton || shouldShowFinishButton;
    const stepActionsClassName = shouldShowPrimaryButton
      ? "assessment-step-actions"
      : "assessment-step-actions assessment-step-actions--compact";

    return (
      <div className={`${plusJakartaSans.className} run-form-layout assessment-run-page--dashboard-skin grid gap-6`}>
          <AssessmentDashboardSkinStyles />
          <section className="run-form-hero">
          <div aria-hidden="true" className="run-form-hero__top-line" />
          <div className="run-form-hero__content">
            <div className="run-form-hero__intro">
              <div className="run-form-hero__identity">
                <div className="run-form-hero__title-group">
                  <p className="run-form-hero__eyebrow">Procjena</p>
                  <h1>{assessmentDisplayName ?? "Procjena"}</h1>
                  {participantDisplayName ? (
                    <p className="run-form-hero__participant">{participantDisplayName}</p>
                  ) : null}
                </div>
              </div>

              <div className="assessment-progress" aria-label="Trenutni napredak">
                <div className="assessment-progress__summary" aria-label="Trenutni napredak">
                  <div className="assessment-progress__metric">
                    <span className="assessment-progress__metric-label">Progres</span>
                    <p className="assessment-progress__metric-value">
                      Pitanje {currentQuestionIndex + 1} od {questions.length}
                    </p>
                  </div>
                </div>

                <div className="assessment-progress__bar-region">
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
          <section className="assessment-step-card">
            <div className="assessment-step-card__header">
              <div
                className={`assessment-step-card__question-region${
                  isLikertQuestion ? " assessment-step-card__question-region--stable" : ""
                }`}
              >
                <p className="assessment-step-card__kicker">Pitanje {currentQuestionIndex + 1}</p>
                <h3>{currentQuestion.text}</h3>
              </div>
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
                <div className="assessment-likert">
                  <div className="assessment-likert__scale">
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
                <ol className="assessment-options">
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
                            <span className="assessment-option__label">{option.label}</span>
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

            {saveStatus === "error" && saveMessage ? (
              <p
                className="assessment-inline-message assessment-inline-message--error"
              >
                {saveMessage}
              </p>
            ) : null}
          </section>

          <div className="assessment-step-layout__footer">
            {!canComplete && currentQuestionIndex === questions.length - 1 ? (
              <p className="assessment-progress-note">{incompleteRequiredAnswersMessage}</p>
            ) : null}

            <div className="assessment-step-layout__actions-row">
              <div className="assessment-step-layout__actions-secondary">
                <button
                  className="assessment-step-actions__button assessment-step-actions__button--ghost assessment-step-actions__button--dashboard-return"
                  type="button"
                  onClick={() => router.push("/app")}
                >
                  Povratak na dashboard
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

                {shouldShowSaveButton ? (
                  <button
                    className="assessment-step-actions__button assessment-step-actions__button--save"
                    type="button"
                    onClick={handleSave}
                    disabled={isInteractionLocked}
                  >
                    {saveStatus === "saving"
                      ? "Čuvanje..."
                      : showManualSaveSuccess
                        ? "Sačuvano"
                        : "Sačuvaj"}
                  </button>
                ) : null}

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

      {saveStatus === "error" && saveMessage ? <p>{saveMessage}</p> : null}
    </>
  );
}
