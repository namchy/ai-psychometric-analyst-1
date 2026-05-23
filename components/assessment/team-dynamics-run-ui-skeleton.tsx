"use client";

import { useState } from "react";

type TeamDynamicsRunFirstItemOption = {
  id: string;
  label: string;
  order: number;
};

type TeamDynamicsRunFirstItemSkeleton =
  | {
      mode: "ui_only_ready";
      questionId: string;
      order: number;
      localizedTitle: string;
      localizedStem: string;
      optionIds: string[];
      options: TeamDynamicsRunFirstItemOption[];
      locale: string;
      isUiOnlySkeleton: true;
    }
  | {
      mode: "no_questions" | "no_options" | "unsupported_format";
      locale: string;
      isUiOnlySkeleton: true;
      questionId?: string;
      order?: number;
      localizedTitle?: string;
      localizedStem?: string;
      unsupportedQuestionType?: string;
    };

export function TeamDynamicsRunUiSkeleton(props: {
  firstItem: TeamDynamicsRunFirstItemSkeleton;
  isRunnableShellState: boolean;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const firstItem = props.firstItem;

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

  if (firstItem.mode === "no_questions") {
    return (
      <section className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">Runtime UI skeleton</h2>
        <p className="text-sm leading-6 text-slate-700">
          Pitanja jos nisu dostupna za lokalni runtime skeleton.
        </p>
      </section>
    );
  }

  if (firstItem.mode === "no_options") {
    return (
      <section className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">Runtime UI skeleton</h2>
        <p className="text-sm font-semibold text-slate-900">
          Prvi pripremljeni item je ucitan, ali opcije jos nisu dostupne.
        </p>
        <p className="text-sm leading-6 text-slate-700">
          UI ostaje u readiness stanju dok runtime option payload ne bude dostupan.
        </p>
      </section>
    );
  }

  if (firstItem.mode === "unsupported_format") {
    return (
      <section className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">Runtime UI skeleton</h2>
        <p className="text-sm font-semibold text-slate-900">
          Prvi pripremljeni item koristi format koji jos nije podrzan u ovom UI-only skeletonu.
        </p>
        <p className="text-sm leading-6 text-slate-700">
          Podrzan je samo Likert-style single-select scaffold bez spremanja odgovora.
        </p>
      </section>
    );
  }

  if (firstItem.mode !== "ui_only_ready") {
    return null;
  }

  const readyItem = firstItem;

  return (
    <section className="space-y-4 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          UI-only runtime skeleton
        </p>
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
          Prvi pripremljeni item
        </h2>
        <p className="text-sm leading-6 text-slate-700">{readyItem.localizedStem}</p>
      </div>

      <div className="grid gap-2">
        {readyItem.options.map((option: TeamDynamicsRunFirstItemOption) => {
          const isSelected = selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedOptionId(option.id)}
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

      <p className="text-sm leading-6 text-slate-700">
        Odgovor se drzi samo u lokalnom UI state-u i jos nije spremljen.
      </p>
      <p className="text-sm leading-6 text-slate-500">
        Osvjezavanje stranice brise izbor. Nema DB persistence-a, autosave-a, submitovanja,
        completion-a ni scoring-a u ovom slice-u.
      </p>
    </section>
  );
}
