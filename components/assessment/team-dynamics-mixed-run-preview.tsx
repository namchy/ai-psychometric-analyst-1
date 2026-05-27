"use client";

import { useEffect, useMemo, useState } from "react";
import { saveTeamDynamicsMixedAnswerAction } from "@/app/actions/team-assessments";
import type { TeamDynamicsMixedCompletionReadiness } from "@/lib/assessment/team-dynamics-mixed-completion-readiness";
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

type MixedPreviewStoredState = {
  currentIndex: number;
};

type MixedPreviewSavedAnswerState = {
  likertSelectionsByQuestionId: Record<string, string>;
  sjtSelectionsByQuestionId: Record<
    string,
    {
      bestOptionId: string;
      worstOptionId: string;
    }
  >;
};

type MixedPreviewClientState = {
  currentIndex: number;
  selectionState: MixedPreviewSelectionState;
  savedAnswerState: MixedPreviewSavedAnswerState;
  isFinalPreviewVisible: boolean;
};

type MixedPreviewSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "overwritten"
  | "unchanged"
  | "error";

type MixedPreviewSaveState = {
  status: MixedPreviewSaveStatus;
  message: string | null;
};

type MixedPreviewSavePayload =
  | {
      teamAssessmentParticipantId: string;
      questionId: string;
      responseFormat: "single_select_likert";
      optionId: string;
      locale?: string;
      clientTimestamp?: string;
    }
  | {
      teamAssessmentParticipantId: string;
      questionId: string;
      responseFormat: "best_worst";
      bestOptionId: string;
      worstOptionId: string;
      locale?: string;
      clientTimestamp?: string;
    };

const EMPTY_SAVED_ANSWER_STATE: MixedPreviewSavedAnswerState = {
  likertSelectionsByQuestionId: {},
  sjtSelectionsByQuestionId: {},
};

export function buildMixedPreviewSessionStorageKey(
  teamAssessmentParticipantId: string,
): string {
  return `team-dynamics-mixed-preview:${teamAssessmentParticipantId}`;
}

function hasSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

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

function isValidOptionId(optionIds: Set<string>, optionId: string | null | undefined): optionId is string {
  return typeof optionId === "string" && optionIds.has(optionId);
}

export function isCurrentItemAnswerComplete(input: {
  item: TeamDynamicsMixedRuntimeHandoffItem;
  selectionState: MixedPreviewSelectionState;
}): boolean {
  const itemKind = getMixedPreviewItemKind(input.item);

  if (itemKind === "likert") {
    const selectedOptionId =
      input.selectionState.likertSelectionsByQuestionId[input.item.questionId] ?? null;

    return input.item.options.some((option) => option.optionId === selectedOptionId);
  }

  if (itemKind === "sjt_best_worst") {
    const currentSelection = input.selectionState.sjtSelectionsByQuestionId[input.item.questionId];
    const optionIds = new Set(input.item.options.map((option) => option.optionId));
    const bestOptionId = currentSelection?.bestOptionId ?? null;
    const worstOptionId = currentSelection?.worstOptionId ?? null;

    return (
      isValidOptionId(optionIds, bestOptionId) &&
      isValidOptionId(optionIds, worstOptionId) &&
      bestOptionId !== worstOptionId
    );
  }

  return false;
}

export function sanitizeMixedPreviewStoredState(input: {
  runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  rawState: unknown;
}): MixedPreviewStoredState {
  const items = input.runtimeHandoff.items;
  const rawState =
    input.rawState && typeof input.rawState === "object" && !Array.isArray(input.rawState)
      ? (input.rawState as Record<string, unknown>)
      : null;
  const nextState: MixedPreviewStoredState = {
    currentIndex: 0,
  };

  if (items.length > 0) {
    const rawCurrentIndex = rawState?.currentIndex;
    const boundedIndex =
      typeof rawCurrentIndex === "number" && Number.isInteger(rawCurrentIndex)
        ? Math.min(Math.max(rawCurrentIndex, 0), items.length - 1)
        : 0;

    nextState.currentIndex = boundedIndex;
  }

  return nextState;
}

export function sanitizeMixedPreviewSavedAnswerState(input: {
  runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  rawState: MixedPreviewSavedAnswerState;
}): MixedPreviewSavedAnswerState {
  const itemByQuestionId = new Map(
    input.runtimeHandoff.items.map((item) => [item.questionId, item] as const),
  );
  const nextState: MixedPreviewSavedAnswerState = {
    likertSelectionsByQuestionId: {},
    sjtSelectionsByQuestionId: {},
  };

  for (const [questionId, rawOptionId] of Object.entries(
    input.rawState.likertSelectionsByQuestionId,
  )) {
    const item = itemByQuestionId.get(questionId);

    if (!item || getMixedPreviewItemKind(item) !== "likert" || typeof rawOptionId !== "string") {
      continue;
    }

    const optionIds = new Set(item.options.map((option) => option.optionId));

    if (!optionIds.has(rawOptionId)) {
      continue;
    }

    nextState.likertSelectionsByQuestionId[questionId] = rawOptionId;
  }

  for (const [questionId, rawSelection] of Object.entries(
    input.rawState.sjtSelectionsByQuestionId,
  )) {
    const item = itemByQuestionId.get(questionId);

    if (
      !item ||
      getMixedPreviewItemKind(item) !== "sjt_best_worst" ||
      !rawSelection ||
      typeof rawSelection !== "object" ||
      Array.isArray(rawSelection)
    ) {
      continue;
    }

    const optionIds = new Set(item.options.map((option) => option.optionId));
    const bestOptionId = isValidOptionId(
      optionIds,
      (rawSelection as { bestOptionId?: unknown }).bestOptionId as string | null | undefined,
    )
      ? ((rawSelection as { bestOptionId?: string }).bestOptionId ?? null)
      : null;
    const worstOptionId = isValidOptionId(
      optionIds,
      (rawSelection as { worstOptionId?: unknown }).worstOptionId as string | null | undefined,
    )
      ? ((rawSelection as { worstOptionId?: string }).worstOptionId ?? null)
      : null;

    if (!bestOptionId || !worstOptionId || bestOptionId === worstOptionId) {
      continue;
    }

    nextState.sjtSelectionsByQuestionId[questionId] = {
      bestOptionId,
      worstOptionId,
    };
  }

  return nextState;
}

export function mergeMixedPreviewStoredStateWithSavedAnswers(input: {
  savedAnswerState: MixedPreviewSavedAnswerState;
  storedState: MixedPreviewStoredState;
}): MixedPreviewStoredState {
  return {
    currentIndex: input.storedState.currentIndex,
  };
}

export function createSelectionStateFromSavedAnswerState(
  savedAnswerState: MixedPreviewSavedAnswerState,
): MixedPreviewSelectionState {
  return {
    likertSelectionsByQuestionId: { ...savedAnswerState.likertSelectionsByQuestionId },
    sjtSelectionsByQuestionId: { ...savedAnswerState.sjtSelectionsByQuestionId },
  };
}

export function readMixedPreviewStoredState(input: {
  runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  teamAssessmentParticipantId: string;
}): MixedPreviewStoredState {
  if (!hasSessionStorage()) {
    return {
      currentIndex: 0,
    };
  }

  const storageKey = buildMixedPreviewSessionStorageKey(input.teamAssessmentParticipantId);

  try {
    const storedValue = window.sessionStorage.getItem(storageKey);

    if (!storedValue) {
      return {
        currentIndex: 0,
      };
    }

    return sanitizeMixedPreviewStoredState({
      runtimeHandoff: input.runtimeHandoff,
      rawState: JSON.parse(storedValue),
    });
  } catch {
    return {
      currentIndex: 0,
    };
  }
}

export function createInitialMixedPreviewClientState(input: {
  runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  teamAssessmentParticipantId: string;
  savedAnswerState?: MixedPreviewSavedAnswerState;
}): MixedPreviewClientState {
  const savedAnswerState = sanitizeMixedPreviewSavedAnswerState({
    runtimeHandoff: input.runtimeHandoff,
    rawState: input.savedAnswerState ?? EMPTY_SAVED_ANSWER_STATE,
  });

  return {
    currentIndex: 0,
    selectionState: createSelectionStateFromSavedAnswerState(savedAnswerState),
    savedAnswerState,
    isFinalPreviewVisible: false,
  };
}

export function buildMixedPreviewCompletionReadiness(input: {
  runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  savedAnswerState: MixedPreviewSavedAnswerState;
  fallbackReadiness: TeamDynamicsMixedCompletionReadiness;
}): TeamDynamicsMixedCompletionReadiness {
  const supportedItems = input.runtimeHandoff.items.filter((item) => {
    const itemKind = getMixedPreviewItemKind(item);
    return itemKind === "likert" || itemKind === "sjt_best_worst";
  });

  if (supportedItems.length === 0) {
    return {
      ...input.fallbackReadiness,
      readinessStatus: "no_supported_items",
      isReadyForCompletion: false,
      supportedItemCount: 0,
      savedValidAnswerCount: 0,
      missingQuestionIds: [],
      savedLikertAnswerCount: 0,
      savedSjtAnswerCount: 0,
    };
  }

  const validLikertQuestionIds = supportedItems
    .filter((item) => getMixedPreviewItemKind(item) === "likert")
    .filter((item) => {
      const optionId =
        input.savedAnswerState.likertSelectionsByQuestionId[item.questionId] ?? null;

      return item.options.some((option) => option.optionId === optionId);
    })
    .map((item) => item.questionId);
  const validSjtQuestionIds = supportedItems
    .filter((item) => getMixedPreviewItemKind(item) === "sjt_best_worst")
    .filter((item) => {
      const selection =
        input.savedAnswerState.sjtSelectionsByQuestionId[item.questionId] ?? null;

      if (!selection) {
        return false;
      }

      const optionIds = new Set(item.options.map((option) => option.optionId));

      return (
        optionIds.has(selection.bestOptionId) &&
        optionIds.has(selection.worstOptionId) &&
        selection.bestOptionId !== selection.worstOptionId
      );
    })
    .map((item) => item.questionId);
  const validAnsweredQuestionIds = new Set([
    ...validLikertQuestionIds,
    ...validSjtQuestionIds,
  ]);
  const missingQuestionIds = supportedItems
    .map((item) => item.questionId)
    .filter((questionId) => !validAnsweredQuestionIds.has(questionId));
  const savedValidAnswerCount = validLikertQuestionIds.length + validSjtQuestionIds.length;
  const isReadyForCompletion =
    supportedItems.length > 0 && missingQuestionIds.length === 0;

  return {
    ...input.fallbackReadiness,
    readinessStatus: isReadyForCompletion ? "ready" : "not_ready",
    isReadyForCompletion,
    supportedItemCount: supportedItems.length,
    savedValidAnswerCount,
    missingQuestionIds,
    savedLikertAnswerCount: validLikertQuestionIds.length,
    savedSjtAnswerCount: validSjtQuestionIds.length,
  };
}

export function shouldOpenFinalPreviewState(input: {
  currentIndex: number;
  itemCount: number;
  readiness: TeamDynamicsMixedCompletionReadiness;
}): boolean {
  return (
    input.itemCount > 0 &&
    input.currentIndex === input.itemCount - 1 &&
    input.readiness.readinessStatus === "ready"
  );
}

function writeMixedPreviewStoredState(input: {
  teamAssessmentParticipantId: string;
  state: MixedPreviewStoredState;
}) {
  if (!hasSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      buildMixedPreviewSessionStorageKey(input.teamAssessmentParticipantId),
      JSON.stringify(input.state),
    );
  } catch {}
}

export function buildSavedAnswerStateAfterSave(input: {
  savedAnswerState: MixedPreviewSavedAnswerState;
  payload: MixedPreviewSavePayload;
}): MixedPreviewSavedAnswerState {
  if (input.payload.responseFormat === "single_select_likert") {
    return {
      likertSelectionsByQuestionId: {
        ...input.savedAnswerState.likertSelectionsByQuestionId,
        [input.payload.questionId]: input.payload.optionId,
      },
      sjtSelectionsByQuestionId: input.savedAnswerState.sjtSelectionsByQuestionId,
    };
  }

  return {
    likertSelectionsByQuestionId: input.savedAnswerState.likertSelectionsByQuestionId,
    sjtSelectionsByQuestionId: {
      ...input.savedAnswerState.sjtSelectionsByQuestionId,
      [input.payload.questionId]: {
        bestOptionId: input.payload.bestOptionId,
        worstOptionId: input.payload.worstOptionId,
      },
    },
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

function resetQuestionSaveState(
  saveStatesByQuestionId: Record<string, MixedPreviewSaveState>,
  questionId: string,
): Record<string, MixedPreviewSaveState> {
  if (!(questionId in saveStatesByQuestionId)) {
    return saveStatesByQuestionId;
  }

  const nextState = { ...saveStatesByQuestionId };
  delete nextState[questionId];
  return nextState;
}

export function buildMixedPreviewSavePayload(input: {
  teamAssessmentParticipantId: string;
  locale?: string;
  item: TeamDynamicsMixedRuntimeHandoffItem;
  selectionState: MixedPreviewSelectionState;
  clientTimestamp?: string;
}): MixedPreviewSavePayload | null {
  const itemKind = getMixedPreviewItemKind(input.item);

  if (itemKind === "likert") {
    const optionId = input.selectionState.likertSelectionsByQuestionId[input.item.questionId];

    if (!input.item.options.some((option) => option.optionId === optionId)) {
      return null;
    }

    return {
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      questionId: input.item.questionId,
      responseFormat: "single_select_likert",
      optionId,
      locale: input.locale,
      clientTimestamp: input.clientTimestamp,
    };
  }

  if (itemKind === "sjt_best_worst") {
    const currentSelection = input.selectionState.sjtSelectionsByQuestionId[input.item.questionId];
    const optionIds = new Set(input.item.options.map((option) => option.optionId));
    const bestOptionId = currentSelection?.bestOptionId ?? null;
    const worstOptionId = currentSelection?.worstOptionId ?? null;

    if (
      !isValidOptionId(optionIds, bestOptionId) ||
      !isValidOptionId(optionIds, worstOptionId) ||
      bestOptionId === worstOptionId
    ) {
      return null;
    }

    return {
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      questionId: input.item.questionId,
      responseFormat: "best_worst",
      bestOptionId,
      worstOptionId,
      locale: input.locale,
      clientTimestamp: input.clientTimestamp,
    };
  }

  return null;
}

function getSaveFeedbackCopy(status: Exclude<MixedPreviewSaveStatus, "idle">): string {
  if (status === "saved") {
    return "Odgovor je spremljen.";
  }

  if (status === "overwritten") {
    return "Odgovor je azuriran.";
  }

  if (status === "unchanged") {
    return "Odgovor je vec spremljen.";
  }

  if (status === "saving") {
    return "Spremam odgovor...";
  }

  return "Odgovor nije spremljen. Pokusaj ponovo.";
}

export function TeamDynamicsMixedRunPreview(props: {
  teamAssessmentParticipantId: string;
  runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  savedLikertSelectionsByQuestionId: Record<string, string>;
  savedSjtSelectionsByQuestionId: Record<
    string,
    {
      bestOptionId: string;
      worstOptionId: string;
    }
  >;
  completionReadiness: TeamDynamicsMixedCompletionReadiness;
  wrapperStatus: "invited" | "started" | "completed" | "expired";
  isRunnableShellState: boolean;
}) {
  const savedAnswerState = useMemo(
    () =>
      sanitizeMixedPreviewSavedAnswerState({
        runtimeHandoff: props.runtimeHandoff,
        rawState: {
          likertSelectionsByQuestionId: props.savedLikertSelectionsByQuestionId,
          sjtSelectionsByQuestionId: props.savedSjtSelectionsByQuestionId,
        },
      }),
    [
      props.runtimeHandoff,
      props.savedLikertSelectionsByQuestionId,
      props.savedSjtSelectionsByQuestionId,
    ],
  );
  const [previewState, setPreviewState] = useState<MixedPreviewClientState>(
    createInitialMixedPreviewClientState({
      runtimeHandoff: props.runtimeHandoff,
      teamAssessmentParticipantId: props.teamAssessmentParticipantId,
      savedAnswerState,
    }),
  );
  const [hasHydratedPreviewState, setHasHydratedPreviewState] = useState(false);
  const [saveStatesByQuestionId, setSaveStatesByQuestionId] = useState<
    Record<string, MixedPreviewSaveState>
  >({});
  const currentIndex = previewState.currentIndex;
  const selectionState = previewState.selectionState;
  const savedAnswerStateFromSession = previewState.savedAnswerState;
  const isFinalPreviewVisible = previewState.isFinalPreviewVisible;

  function markQuestionAsLocallyChanged(questionId: string) {
    setSaveStatesByQuestionId((current) => resetQuestionSaveState(current, questionId));
  }

  const safeIndex = Math.min(currentIndex, Math.max(props.runtimeHandoff.items.length - 1, 0));
  const currentItem = props.runtimeHandoff.items[safeIndex] ?? null;
  const currentBlock = useMemo(
    () =>
      currentItem
        ? props.runtimeHandoff.blocks.find((block) => block.blockKey === currentItem.blockKey) ?? null
        : null,
    [currentItem, props.runtimeHandoff.blocks],
  );

  useEffect(() => {
    const storedState = readMixedPreviewStoredState({
      runtimeHandoff: props.runtimeHandoff,
      teamAssessmentParticipantId: props.teamAssessmentParticipantId,
    });
    const mergedStoredState = mergeMixedPreviewStoredStateWithSavedAnswers({
      savedAnswerState,
      storedState,
    });

    setPreviewState({
      currentIndex: mergedStoredState.currentIndex,
      selectionState: createSelectionStateFromSavedAnswerState(savedAnswerState),
      savedAnswerState,
      isFinalPreviewVisible: false,
    });
    setHasHydratedPreviewState(true);
  }, [props.runtimeHandoff, props.teamAssessmentParticipantId, savedAnswerState]);

  useEffect(() => {
    if (!hasHydratedPreviewState) {
      return;
    }

    writeMixedPreviewStoredState({
      teamAssessmentParticipantId: props.teamAssessmentParticipantId,
      state: {
        currentIndex: safeIndex,
      },
    });
  }, [
    hasHydratedPreviewState,
    previewState.currentIndex,
    previewState.savedAnswerState,
    props.teamAssessmentParticipantId,
    safeIndex,
  ]);

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

  if (!hasHydratedPreviewState) {
    return (
      <section className="space-y-5 rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_14px_27px_rgba(15,23,42,0.06)]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {props.runtimeHandoff.blocks.map((block) => (
              <span
                key={block.blockKey}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getBlockBadgeClassName(
                  false,
                )}`}
              >
                {block.title}
              </span>
            ))}
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
                Vracam preview stanje iz ove browser sesije...
              </p>
            </div>

            <div className="rounded-[1rem] border border-white/70 bg-white/85 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Lokalni progress
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Pripremam posljednje otvoreni item i lokalne odabire.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Vracam zadnje spremljene odgovore iz baze i poziciju iz ove browser sesije.
              </p>
            </div>
          </div>
        </div>

        <article className="space-y-4 rounded-[1.25rem] border border-slate-200/80 bg-slate-50/70 p-5">
          <p className="text-sm font-semibold text-slate-900">Vracam preview stanje...</p>
          <p className="text-sm leading-6 text-slate-600">
            Ovaj ekran trenutno sluzi za preview mixed-format flow-a sa spremanjem na
            `Sljedece`. Nema autosave-a, completion-a, scoring-a ni izvjestaja u ovom slice-u.
          </p>
        </article>
      </section>
    );
  }

  const itemKind = getMixedPreviewItemKind(currentItem);
  const isFirstItem = safeIndex === 0;
  const isLastItem = safeIndex === props.runtimeHandoff.items.length - 1;
  const isCurrentAnswerComplete = isCurrentItemAnswerComplete({
    item: currentItem,
    selectionState,
  });
  const likertSelection =
    selectionState.likertSelectionsByQuestionId[currentItem.questionId] ?? null;
  const sjtSelection = selectionState.sjtSelectionsByQuestionId[currentItem.questionId] ?? {
    bestOptionId: null,
    worstOptionId: null,
  };
  const currentSaveState = saveStatesByQuestionId[currentItem.questionId] ?? {
    status: "idle" as const,
    message: null,
  };
  const currentSavePayload = buildMixedPreviewSavePayload({
    teamAssessmentParticipantId: props.teamAssessmentParticipantId,
    locale: props.runtimeHandoff.locale,
    item: currentItem,
    selectionState,
  });
  const savedLikertSelectionForCurrentQuestion =
    savedAnswerStateFromSession.likertSelectionsByQuestionId[currentItem.questionId] ?? null;
  const savedSjtSelectionForCurrentQuestion =
    savedAnswerStateFromSession.sjtSelectionsByQuestionId[currentItem.questionId] ?? null;
  const isCurrentSelectionAlignedWithSavedAnswer =
    itemKind === "likert"
      ? savedLikertSelectionForCurrentQuestion !== null &&
        likertSelection === savedLikertSelectionForCurrentQuestion
      : itemKind === "sjt_best_worst"
        ? savedSjtSelectionForCurrentQuestion !== null &&
          sjtSelection.bestOptionId === savedSjtSelectionForCurrentQuestion.bestOptionId &&
          sjtSelection.worstOptionId === savedSjtSelectionForCurrentQuestion.worstOptionId
        : false;
  const isSaveDisabled =
    itemKind === "unsupported" ||
    currentSavePayload === null ||
    currentSaveState.status === "saving";
  const effectiveCompletionReadiness = buildMixedPreviewCompletionReadiness({
    runtimeHandoff: props.runtimeHandoff,
    savedAnswerState: savedAnswerStateFromSession,
    fallbackReadiness: props.completionReadiness,
  });
  const readinessSummaryLabel =
    effectiveCompletionReadiness.readinessStatus === "ready"
      ? "Svi odgovori su spremljeni."
      : effectiveCompletionReadiness.readinessStatus === "no_supported_items"
        ? "Nema podrzanih pitanja za zavrsetak."
        : `Spremljeno: ${effectiveCompletionReadiness.savedValidAnswerCount}/${effectiveCompletionReadiness.supportedItemCount} odgovora.`;

  if (isFinalPreviewVisible) {
    return (
      <section className="space-y-5 rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_14px_27px_rgba(15,23,42,0.06)]">
        <div className="space-y-3">
          <div className="grid gap-3 rounded-[1.2rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(7,59,76,0.05),rgba(17,138,178,0.04))] p-4 sm:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Procjena timske dinamike
              </p>
              <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-[#073b4c]">
                Odgovori su spremljeni
              </h2>
              <p className="text-sm leading-6 text-slate-700">
                Svi podrzani odgovori u ovoj procjeni su spremljeni. Zavrsavanje procjene
                bice omoguceno u sljedecem koraku.
              </p>
            </div>

            <div className="rounded-[1rem] border border-white/70 bg-white/85 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Lokalni progress
              </p>
              <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-slate-950">
                {effectiveCompletionReadiness.savedValidAnswerCount} /{" "}
                {effectiveCompletionReadiness.supportedItemCount}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{readinessSummaryLabel}</p>
            </div>
          </div>
        </div>

        <article className="space-y-4 rounded-[1.25rem] border border-emerald-200/80 bg-emerald-50/70 p-5">
          <p className="text-sm font-semibold text-slate-900">Odgovori u ovom toku su spremljeni.</p>
          <p className="text-sm leading-6 text-slate-700">
            Ovaj preview ne pokrece completion action, status transition, scoring ni izvjestaj.
          </p>
        </article>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              setPreviewState((current) => ({
                ...current,
                currentIndex: Math.max(props.runtimeHandoff.items.length - 1, 0),
                selectionState: createSelectionStateFromSavedAnswerState(
                  current.savedAnswerState,
                ),
                isFinalPreviewVisible: false,
              }))
            }
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-500"
          >
            Prethodno
          </button>
        </div>
      </section>
    );
  }

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
              Ovaj preview sprema odgovor tek na Sljedece. Nema autosave-a, completion-a,
              scoring-a ni izvjestaja u ovom slice-u.
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
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Spremljeni odgovori se ucitavaju iz baze, a ova browser sesija pamti gdje si stao.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {readinessSummaryLabel}
            </p>
            {effectiveCompletionReadiness.invalidSavedAnswerCount > 0 ? (
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Neki spremljeni odgovori nisu uracunati u trenutni progress prikaz.
              </p>
            ) : null}
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
              ? "Odaberi jednu opciju prije nastavka. Sljedece sprema odgovor i tek onda prelazi dalje."
              : itemKind === "sjt_best_worst"
                ? "Odaberi jednu najefikasniju i jednu najmanje efikasnu reakciju. Ista opcija ne moze biti oba izbora."
                : "Ova assessment jedinica trenutno nema podrzan preview format. Navigacija ostaje stabilna i omogucen je kontrolisani skip."}
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
                    {
                      setPreviewState((current) => ({
                        ...current,
                        selectionState: {
                          ...current.selectionState,
                          likertSelectionsByQuestionId: {
                            ...current.selectionState.likertSelectionsByQuestionId,
                            [currentItem.questionId]: option.optionId,
                          },
                        },
                      }));
                      markQuestionAsLocallyChanged(currentItem.questionId);
                    }
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
                        {
                          setPreviewState((current) => ({
                            ...current,
                            selectionState: {
                              ...current.selectionState,
                              sjtSelectionsByQuestionId: {
                                ...current.selectionState.sjtSelectionsByQuestionId,
                                [currentItem.questionId]: updateSjtPreviewSelection({
                                  current:
                                    current.selectionState.sjtSelectionsByQuestionId[
                                      currentItem.questionId
                                    ],
                                  selectionKind: "best",
                                  optionId: option.optionId,
                                }),
                              },
                            },
                          }));
                          markQuestionAsLocallyChanged(currentItem.questionId);
                        }
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
                        {
                          setPreviewState((current) => ({
                            ...current,
                            selectionState: {
                              ...current.selectionState,
                              sjtSelectionsByQuestionId: {
                                ...current.selectionState.sjtSelectionsByQuestionId,
                                [currentItem.questionId]: updateSjtPreviewSelection({
                                  current:
                                    current.selectionState.sjtSelectionsByQuestionId[
                                      currentItem.questionId
                                    ],
                                  selectionKind: "worst",
                                  optionId: option.optionId,
                                }),
                              },
                            },
                          }));
                          markQuestionAsLocallyChanged(currentItem.questionId);
                        }
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

        {isCurrentSelectionAlignedWithSavedAnswer && itemKind !== "unsupported" ? (
          <div className="rounded-[1rem] border border-slate-200 bg-white/80 p-4">
            <p className="text-sm leading-6 text-slate-600">Ucitano zadnje spremljeno stanje.</p>
          </div>
        ) : null}
      </article>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            setPreviewState((current) => ({
              ...current,
              currentIndex: Math.max(0, current.currentIndex - 1),
              selectionState: createSelectionStateFromSavedAnswerState(current.savedAnswerState),
              isFinalPreviewVisible: false,
            }))
          }
          disabled={isFirstItem}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          Prethodno
        </button>
        <button
          type="button"
          onClick={async () => {
            if (currentSavePayload === null || currentSaveState.status === "saving") {
              return;
            }

            setSaveStatesByQuestionId((current) => ({
              ...current,
              [currentItem.questionId]: {
                status: "saving",
                message: getSaveFeedbackCopy("saving"),
              },
            }));

            try {
              const result = await saveTeamDynamicsMixedAnswerAction({
                ...currentSavePayload,
                clientTimestamp: new Date().toISOString(),
              });

              if (
                result.ok &&
                (result.status === "saved" ||
                  result.status === "unchanged" ||
                  result.status === "overwritten")
              ) {
                const nextSavedAnswerState = buildSavedAnswerStateAfterSave({
                  savedAnswerState: savedAnswerStateFromSession,
                  payload: currentSavePayload,
                });
                const nextCompletionReadiness = buildMixedPreviewCompletionReadiness({
                  runtimeHandoff: props.runtimeHandoff,
                  savedAnswerState: nextSavedAnswerState,
                  fallbackReadiness: effectiveCompletionReadiness,
                });

                setSaveStatesByQuestionId((current) => ({
                  ...current,
                  [currentItem.questionId]: {
                    status: result.status,
                    message: getSaveFeedbackCopy(result.status),
                  },
                }));
                setPreviewState((current) => ({
                  ...current,
                  currentIndex:
                    isLastItem &&
                    shouldOpenFinalPreviewState({
                      currentIndex: current.currentIndex,
                      itemCount: props.runtimeHandoff.items.length,
                      readiness: nextCompletionReadiness,
                    })
                      ? current.currentIndex
                      : isLastItem
                        ? current.currentIndex
                        : Math.min(
                            props.runtimeHandoff.items.length - 1,
                            current.currentIndex + 1,
                          ),
                  savedAnswerState: nextSavedAnswerState,
                  selectionState: createSelectionStateFromSavedAnswerState(nextSavedAnswerState),
                  isFinalPreviewVisible:
                    isLastItem &&
                    shouldOpenFinalPreviewState({
                      currentIndex: current.currentIndex,
                      itemCount: props.runtimeHandoff.items.length,
                      readiness: nextCompletionReadiness,
                    }),
                }));
                return;
              }

              setSaveStatesByQuestionId((current) => ({
                ...current,
                [currentItem.questionId]: {
                  status: "error",
                  message: getSaveFeedbackCopy("error"),
                },
              }));
            } catch {
              setSaveStatesByQuestionId((current) => ({
                ...current,
                [currentItem.questionId]: {
                  status: "error",
                  message: getSaveFeedbackCopy("error"),
                },
              }));
            }
          }}
          disabled={isSaveDisabled}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          {currentSaveState.status === "saving" ? "Spremam..." : "Sljedece"}
        </button>
      </div>

      {currentSaveState.status === "error" ? (
        <p className="text-sm leading-6 text-[#b42318]">{getSaveFeedbackCopy("error")}</p>
      ) : null}

      <div className="rounded-[1rem] border border-slate-200 bg-white/75 p-4">
        <p className="text-sm font-semibold text-slate-900">
          Preview sa spremanjem na Sljedece
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Nema autosave logike, completion tranzicije, scoring-a ni report side-effecta u ovom
          slice-u.
        </p>
      </div>
    </section>
  );
}
