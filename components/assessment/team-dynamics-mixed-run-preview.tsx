"use client";

import { useMemo, useState } from "react";
import type {
  TeamDynamicsMixedRuntimeHandoff,
  TeamDynamicsMixedRuntimeHandoffItem,
} from "@/lib/assessment/team-dynamics-mixed-runtime";

type MixedPreviewSelectionState = {
  likertSelectionsByQuestionId: Record<string, string>;
  sjtSelectionsByQuestionId: Record<
    string,
    {
      bestOptionId: string | null;
      worstOptionId: string | null;
    }
  >;
};

type MixedPreviewItemKind = "likert" | "sjt_best_worst" | "unsupported";

export function getMixedPreviewItemKind(
  item: TeamDynamicsMixedRuntimeHandoffItem,
): MixedPreviewItemKind {
  if (item.responseFormat === "single_select_likert" && item.options.length === 4) {
    return "likert";
  }

  if (item.responseFormat === "best_worst" && item.options.length === 4) {
    return "sjt_best_worst";
  }

  return "unsupported";
}

export function updateSjtPreviewSelection(input: {
  current:
    | {
        bestOptionId: string | null;
        worstOptionId: string | null;
      }
    | undefined;
  selectionKind: "best" | "worst";
  optionId: string;
}): {
  bestOptionId: string | null;
  worstOptionId: string | null;
} {
  const current = input.current ?? {
    bestOptionId: null,
    worstOptionId: null,
  };

  if (input.selectionKind === "best") {
    return {
      bestOptionId: input.optionId,
      worstOptionId: current.worstOptionId === input.optionId ? null : current.worstOptionId,
    };
  }

  return {
    bestOptionId: current.bestOptionId === input.optionId ? null : current.bestOptionId,
    worstOptionId: input.optionId,
  };
}

function getBlockBadgeClassName(isActive: boolean): string {
  if (isActive) {
    return "border-[#073b4c] bg-[#073b4c] text-white";
  }

  return "border-slate-200 bg-white/80 text-slate-700";
}

function getOptionButtonClassName(isSelected: boolean): string {
  if (isSelected) {
    return "border-[#073b4c] bg-[#073b4c] text-white";
  }

  return "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400";
}

function getSjtMarkerClassName(isSelected: boolean, selectionKind: "best" | "worst"): string {
  if (!isSelected) {
    return "border-slate-200 bg-white text-slate-500";
  }

  return selectionKind === "best"
    ? "border-[#118ab2] bg-[#118ab2] text-white"
    : "border-[#ef476f] bg-[#ef476f] text-white";
}

export function TeamDynamicsMixedRunPreview(props: {
  runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  wrapperStatus: "invited" | "started" | "completed" | "expired";
  isRunnableShellState: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectionState, setSelectionState] = useState<MixedPreviewSelectionState>({
    likertSelectionsByQuestionId: {},
    sjtSelectionsByQuestionId: {},
  });

  const safeIndex = Math.min(currentIndex, Math.max(props.runtimeHandoff.items.length - 1, 0));
  const currentItem = props.runtimeHandoff.items[safeIndex] ?? null;
  const currentBlock = useMemo(
    () =>
      currentItem
        ? props.runtimeHandoff.blocks.find((block) => block.blockKey === currentItem.blockKey) ?? null
        : null,
    [currentItem, props.runtimeHandoff.blocks],
  );

  if (!props.isRunnableShellState) {
    return (
      <section className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
          {props.wrapperStatus === "completed"
            ? "Procjena je zavrsena"
            : props.wrapperStatus === "expired"
              ? "Procjena vise nije dostupna"
              : "Mixed-format preview"}
        </h2>
        <p className="text-sm leading-6 text-slate-700">
          Ovaj wrapper trenutno nije u stanju za UI-only mixed-format preview.
        </p>
      </section>
    );
  }

  if (!currentItem) {
    return (
      <section className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
          Mixed-format preview
        </h2>
        <p className="text-sm leading-6 text-slate-700">
          Runtime handoff je ucitan bez aktivnih assessment jedinica.
        </p>
      </section>
    );
  }

  const itemKind = getMixedPreviewItemKind(currentItem);
  const isFirstItem = safeIndex === 0;
  const isLastItem = safeIndex === props.runtimeHandoff.items.length - 1;
  const likertSelection =
    selectionState.likertSelectionsByQuestionId[currentItem.questionId] ?? null;
  const sjtSelection = selectionState.sjtSelectionsByQuestionId[currentItem.questionId] ?? {
    bestOptionId: null,
    worstOptionId: null,
  };

  return (
    <section className="space-y-5 rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_14px_27px_rgba(15,23,42,0.06)]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {props.runtimeHandoff.blocks.map((block) => {
            const isActive = block.blockKey === currentItem.blockKey;

            return (
              <span
                key={block.blockKey}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getBlockBadgeClassName(
                  isActive,
                )}`}
              >
                {block.title}
              </span>
            );
          })}
        </div>

        <div className="grid gap-3 rounded-[1.2rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(7,59,76,0.05),rgba(17,138,178,0.04))] p-4 sm:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Procjena timske dinamike
            </p>
            <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-[#073b4c]">
              4 kratka bloka, oko 12-15 minuta
            </h2>
            <p className="text-sm leading-6 text-slate-700">
              Ovaj preview cita imported mixed-format runtime handoff i cuva izbor samo u lokalnom
              React state-u. Osvjezavanje stranice brise sve lokalne odabire.
            </p>
          </div>

          <div className="rounded-[1rem] border border-white/70 bg-white/85 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Lokalni progress
            </p>
            <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-slate-950">
              {safeIndex + 1} / {props.runtimeHandoff.itemCount}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Trenutni blok: {currentBlock?.title ?? currentItem.blockKey}
            </p>
          </div>
        </div>
      </div>

      <article className="space-y-4 rounded-[1.25rem] border border-slate-200/80 bg-slate-50/70 p-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {itemKind === "sjt_best_worst" ? "Scenarij" : "Pitanje"}
          </p>
          <h3 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
            {currentItem.localizedText}
          </h3>
          <p className="text-sm leading-6 text-slate-600">
            {itemKind === "likert"
              ? "Odaberi jednu opciju. Izbor ostaje samo u trenutnoj React sesiji."
              : itemKind === "sjt_best_worst"
                ? "Odaberi jednu najefikasniju i jednu najmanje efikasnu reakciju. Ista opcija ne moze biti oba izbora."
                : "Ova assessment jedinica trenutno nema podrzan preview format. Navigacija ostaje stabilna."}
          </p>
        </div>

        {itemKind === "likert" ? (
          <div className="grid gap-2">
            {currentItem.options.map((option) => {
              const isSelected = likertSelection === option.optionId;

              return (
                <button
                  key={option.optionId}
                  type="button"
                  onClick={() =>
                    setSelectionState((current) => ({
                      ...current,
                      likertSelectionsByQuestionId: {
                        ...current.likertSelectionsByQuestionId,
                        [currentItem.questionId]: option.optionId,
                      },
                    }))
                  }
                  className={`rounded-[1rem] border px-4 py-3 text-left text-sm font-semibold transition-colors duration-150 ${getOptionButtonClassName(
                    isSelected,
                  )}`}
                  aria-pressed={isSelected}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {itemKind === "sjt_best_worst" ? (
          <div className="grid gap-3">
            {currentItem.options.map((option) => {
              const isBestSelected = sjtSelection.bestOptionId === option.optionId;
              const isWorstSelected = sjtSelection.worstOptionId === option.optionId;

              return (
                <div
                  key={option.optionId}
                  className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4"
                >
                  <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectionState((current) => ({
                          ...current,
                          sjtSelectionsByQuestionId: {
                            ...current.sjtSelectionsByQuestionId,
                            [currentItem.questionId]: updateSjtPreviewSelection({
                              current: current.sjtSelectionsByQuestionId[currentItem.questionId],
                              selectionKind: "best",
                              optionId: option.optionId,
                            }),
                          },
                        }))
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors duration-150 ${getSjtMarkerClassName(
                        isBestSelected,
                        "best",
                      )}`}
                      aria-pressed={isBestSelected}
                    >
                      Najefikasnija reakcija
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectionState((current) => ({
                          ...current,
                          sjtSelectionsByQuestionId: {
                            ...current.sjtSelectionsByQuestionId,
                            [currentItem.questionId]: updateSjtPreviewSelection({
                              current: current.sjtSelectionsByQuestionId[currentItem.questionId],
                              selectionKind: "worst",
                              optionId: option.optionId,
                            }),
                          },
                        }))
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors duration-150 ${getSjtMarkerClassName(
                        isWorstSelected,
                        "worst",
                      )}`}
                      aria-pressed={isWorstSelected}
                    >
                      Najmanje efikasna reakcija
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {itemKind === "unsupported" ? (
          <div className="rounded-[1rem] border border-dashed border-[#ffd166] bg-[#ffd166]/10 p-4">
            <p className="text-sm font-semibold text-slate-900">
              Ova assessment jedinica trenutno nije dostupna za mixed-format preview.
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              Item ostaje vidljiv kao kontrolisani fallback, bez prikaza scoring kljuceva ili write
              akcija.
            </p>
          </div>
        ) : null}
      </article>

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
            setCurrentIndex((index) => Math.min(props.runtimeHandoff.items.length - 1, index + 1))
          }
          disabled={isLastItem}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          Sljedece
        </button>
      </div>

      <div className="rounded-[1rem] border border-slate-200 bg-white/75 p-4">
        <p className="text-sm font-semibold text-slate-900">
          UI-only preview bez spremanja odgovora
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Nema save action poziva, autosave logike, completion tranzicije, scoring-a ni report
          side-effecta u ovom slice-u.
        </p>
      </div>
    </section>
  );
}
