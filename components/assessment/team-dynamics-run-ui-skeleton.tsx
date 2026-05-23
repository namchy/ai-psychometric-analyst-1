"use client";

import { useState } from "react";

type TeamDynamicsRunUiOnlyItemOption = {
  id: string;
  label: string;
  order: number;
};

type TeamDynamicsRunUiOnlyItem = {
  mode: "ui_only_ready";
  questionId: string;
  order: number;
  localizedTitle: string;
  localizedStem: string;
  optionIds: string[];
  options: TeamDynamicsRunUiOnlyItemOption[];
  locale: string;
  isUiOnlySkeleton: true;
};

export function TeamDynamicsRunUiSkeleton(props: {
  uiOnlyItems: TeamDynamicsRunUiOnlyItem[];
  uiOnlyItemCount: number;
  uiOnlyUnsupportedCount: number;
  uiOnlySkeletonMode: "ready" | "no_questions" | "no_options" | "unsupported_format";
  isRunnableShellState: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionIdsByQuestionId, setSelectedOptionIdsByQuestionId] = useState<
    Record<string, string>
  >({});

  if (!props.isRunnableShellState) {
    return (
      <section className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">Runtime UI skeleton</h2>
        <p className="text-sm leading-6 text-slate-700">
          Ovaj wrapper trenutno nije u stanju za lokalni UI-only response skeleton.
        </p>
      </section>
    );
  }

  if (props.uiOnlySkeletonMode === "no_questions") {
    return (
      <section className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">Runtime UI skeleton</h2>
        <p className="text-sm leading-6 text-slate-700">
          Pitanja jos nisu dostupna za lokalni runtime skeleton.
        </p>
      </section>
    );
  }

  if (props.uiOnlySkeletonMode === "no_options") {
    return (
      <section className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">Runtime UI skeleton</h2>
        <p className="text-sm font-semibold text-slate-900">
          Pripremljena pitanja su ucitana, ali opcije jos nisu dostupne.
        </p>
        <p className="text-sm leading-6 text-slate-700">
          UI ostaje u readiness stanju dok runtime option payload ne bude dostupan.
        </p>
      </section>
    );
  }

  if (props.uiOnlySkeletonMode === "unsupported_format") {
    return (
      <section className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">Runtime UI skeleton</h2>
        <p className="text-sm font-semibold text-slate-900">
          Pripremljena pitanja koriste format koji jos nije podrzan u ovom UI-only skeletonu.
        </p>
        <p className="text-sm leading-6 text-slate-700">
          Podrzan je samo Likert-style single-select scaffold bez spremanja odgovora.
        </p>
      </section>
    );
  }

  if (props.uiOnlyItems.length === 0) {
    return null;
  }

  const safeIndex = Math.min(currentIndex, props.uiOnlyItems.length - 1);
  const currentItem = props.uiOnlyItems[safeIndex];
  const selectedOptionId = selectedOptionIdsByQuestionId[currentItem.questionId] ?? null;
  const isFirstItem = safeIndex === 0;
  const isLastItem = safeIndex === props.uiOnlyItems.length - 1;

  return (
    <section className="space-y-4 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          UI-only runtime skeleton
        </p>
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
          Pitanje {safeIndex + 1} od {props.uiOnlyItemCount}
        </h2>
        <p className="text-sm font-semibold text-slate-900">{currentItem.localizedTitle}</p>
        <p className="text-sm leading-6 text-slate-700">{currentItem.localizedStem}</p>
        {props.uiOnlyUnsupportedCount > 0 ? (
          <p className="text-sm leading-6 text-slate-500">
            Dio pripremljenih pitanja ostaje u readiness stanju jer jos nemaju podrzan UI-only
            format ili opcije.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        {currentItem.options.map((option: TeamDynamicsRunUiOnlyItemOption) => {
          const isSelected = selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() =>
                setSelectedOptionIdsByQuestionId((currentSelections) => ({
                  ...currentSelections,
                  [currentItem.questionId]: option.id,
                }))
              }
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors duration-150 ${
                isSelected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400"
              }`}
              aria-pressed={isSelected}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          disabled={isFirstItem}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          Prethodno
        </button>
        <button
          type="button"
          onClick={() =>
            setCurrentIndex((index) => Math.min(props.uiOnlyItems.length - 1, index + 1))
          }
          disabled={isLastItem}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          Sljedece
        </button>
      </div>

      <p className="text-sm leading-6 text-slate-700">
        Odgovori se drze samo u lokalnom UI state-u i jos nisu spremljeni.
      </p>
      <p className="text-sm leading-6 text-slate-500">
        Osvjezavanje stranice brise izbor. Nema DB persistence-a, autosave-a, submitovanja,
        completion-a ni scoring-a u ovom slice-u.
      </p>
    </section>
  );
}
