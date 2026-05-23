"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeTeamAssessmentAction,
  saveTeamAssessmentAnswerAction,
} from "@/app/actions/team-assessments";

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
  teamAssessmentParticipantId: string;
  wrapperStatus: "invited" | "started" | "completed" | "expired";
  uiOnlyItems: TeamDynamicsRunUiOnlyItem[];
  uiOnlyItemCount: number;
  uiOnlyUnsupportedCount: number;
  uiOnlySkeletonMode: "ready" | "no_questions" | "no_options" | "unsupported_format";
  savedSelectedOptionIdsByQuestionId: Record<string, string>;
  savedAnswerQuestionIds: string[];
  savedAnswerCount: number;
  completionReadiness: {
    supportedQuestionCount: number;
    savedValidAnswerCount: number;
    missingQuestionIds: string[];
    invalidSavedAnswerCount: number;
    isReadyForCompletion: boolean;
    readinessStatus: "not_ready" | "ready" | "no_supported_items";
  };
  isRunnableShellState: boolean;
}) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionIdsByQuestionId, setSelectedOptionIdsByQuestionId] = useState<
    Record<string, string>
  >(() => props.savedSelectedOptionIdsByQuestionId);
  const [saveStateByQuestionId, setSaveStateByQuestionId] = useState<
    Record<string, "idle" | "loaded" | "saving" | "saved" | "overwritten" | "unchanged" | "error">
  >(() =>
    Object.fromEntries(
      props.savedAnswerQuestionIds.map((questionId) => [questionId, "loaded" as const]),
    )
  );
  const [saveMessageByQuestionId, setSaveMessageByQuestionId] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(props.savedAnswerQuestionIds.map((questionId) => [questionId, "Ucitano."])),
  );
  const [completionReadiness, setCompletionReadiness] = useState(() => props.completionReadiness);
  const [completionState, setCompletionState] = useState<
    "idle" | "submitting" | "completed" | "already_completed" | "error"
  >("idle");
  const [completionMessage, setCompletionMessage] = useState("");

  if (!props.isRunnableShellState) {
    return (
      <section className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
          {props.wrapperStatus === "completed"
            ? "Procjena je završena"
            : props.wrapperStatus === "expired"
              ? "Procjena više nije dostupna"
              : "Runtime UI skeleton"}
        </h2>
        <p className="text-sm leading-6 text-slate-700">
          {props.wrapperStatus === "completed"
            ? "Aktivni run je zatvoren. Pitanja, spremanje odgovora i completion CTA više nisu dostupni za ovaj wrapper."
            : props.wrapperStatus === "expired"
              ? "Ovaj wrapper više nije u stanju za aktivni Team Dynamics run."
              : "Ovaj wrapper trenutno nije u stanju za lokalni UI-only response skeleton."}
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
  const currentSaveState = saveStateByQuestionId[currentItem.questionId] ?? "idle";
  const currentSaveMessage = saveMessageByQuestionId[currentItem.questionId] ?? "";
  const isSaveDisabled = !selectedOptionId || currentSaveState === "saving";

  async function handleSaveCurrentAnswer() {
    if (!selectedOptionId) {
      return;
    }

    const questionId = currentItem.questionId;

    setSaveStateByQuestionId((currentStatuses) => ({
      ...currentStatuses,
      [questionId]: "saving",
    }));
    setSaveMessageByQuestionId((currentMessages) => ({
      ...currentMessages,
      [questionId]: "Spremanje odgovora je u toku.",
    }));

    startTransition(async () => {
      const result = await saveTeamAssessmentAnswerAction({
        teamAssessmentParticipantId: props.teamAssessmentParticipantId,
        questionId,
        optionId: selectedOptionId,
        locale: currentItem.locale === "en" ? "en" : currentItem.locale === "hr" ? "hr" : "bs",
        clientTimestamp: new Date().toISOString(),
      });

      if (!result.ok) {
        setSaveStateByQuestionId((currentStatuses) => ({
          ...currentStatuses,
          [questionId]: "error",
        }));
        setSaveMessageByQuestionId((currentMessages) => ({
          ...currentMessages,
          [questionId]: "Odgovor nije spremljen. Pokusaj ponovo.",
        }));
        return;
      }

      const nextMessage =
        result.mode === "saved"
          ? "Odgovor je spremljen."
          : result.mode === "overwritten"
            ? "Odgovor je azuriran."
            : "Odgovor je vec spremljen.";

      setSaveStateByQuestionId((currentStatuses) => ({
        ...currentStatuses,
        [questionId]: result.mode,
      }));
      setSaveMessageByQuestionId((currentMessages) => ({
        ...currentMessages,
        [questionId]: nextMessage,
      }));

      setCompletionReadiness((currentReadiness) => {
        if (
          currentReadiness.readinessStatus === "ready" ||
          currentReadiness.missingQuestionIds.includes(questionId) === false
        ) {
          return currentReadiness;
        }

        const nextMissingQuestionIds = currentReadiness.missingQuestionIds.filter(
          (missingQuestionId) => missingQuestionId !== questionId,
        );
        const nextSavedValidAnswerCount = Math.min(
          currentReadiness.supportedQuestionCount,
          currentReadiness.savedValidAnswerCount + 1,
        );

        return {
          ...currentReadiness,
          savedValidAnswerCount: nextSavedValidAnswerCount,
          missingQuestionIds: nextMissingQuestionIds,
          isReadyForCompletion:
            currentReadiness.supportedQuestionCount > 0 && nextMissingQuestionIds.length === 0,
          readinessStatus:
            currentReadiness.supportedQuestionCount === 0
              ? "no_supported_items"
              : nextMissingQuestionIds.length === 0
                ? "ready"
                : "not_ready",
        };
      });
    });
  }

  function handleCompleteAssessment() {
    if (completionReadiness.readinessStatus !== "ready") {
      return;
    }

    setCompletionState("submitting");
    setCompletionMessage("Zavrsavanje procjene je u toku.");

    startTransition(async () => {
      const result = await completeTeamAssessmentAction({
        teamAssessmentParticipantId: props.teamAssessmentParticipantId,
      });

      if (!result.ok) {
        if (result.completionReadiness) {
          setCompletionReadiness(result.completionReadiness);
        }

        setCompletionState("error");
        setCompletionMessage(
          result.code === "not_ready"
            ? "Procjena jos nije spremna za zavrsavanje."
            : "Procjena nije zavrsena. Pokusaj ponovo.",
        );
        return;
      }

      setCompletionState(result.mode);
      setCompletionMessage(
        result.mode === "completed"
          ? "Procjena je uspjesno zavrsena."
          : "Procjena je vec ranije zavrsena.",
      );
      router.push(`/app/team-assessments/${props.teamAssessmentParticipantId}`);
      router.refresh();
    });
  }

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
        {props.savedAnswerCount > 0 ? (
          <p className="text-sm leading-6 text-slate-500">
            Ucitano je ranije spremljenih odgovora: {props.savedAnswerCount}.
          </p>
        ) : null}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            Sacuvani napredak: {completionReadiness.savedValidAnswerCount}/
            {completionReadiness.supportedQuestionCount}
          </p>
          <p className="text-sm leading-6 text-slate-600">
            {completionReadiness.readinessStatus === "ready"
              ? "Sva podrzana Likert pitanja trenutno imaju valjan spremljen odgovor."
              : completionReadiness.readinessStatus === "no_supported_items"
                ? "Jos nema podrzanih pitanja za completion readiness."
                : "Completion readiness jos nije postignut za sva podrzana Likert pitanja."}
          </p>
          {completionReadiness.invalidSavedAnswerCount > 0 ? (
            <p className="text-sm leading-6 text-slate-500">
              Ignorisani su nevalidni ili zastarjeli spremljeni odgovori:{" "}
              {completionReadiness.invalidSavedAnswerCount}.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        {currentItem.options.map((option: TeamDynamicsRunUiOnlyItemOption) => {
          const isSelected = selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSelectedOptionIdsByQuestionId((currentSelections) => ({
                  ...currentSelections,
                  [currentItem.questionId]: option.id,
                }));

                if (selectedOptionId !== option.id) {
                  setSaveStateByQuestionId((currentStatuses) => ({
                    ...currentStatuses,
                    [currentItem.questionId]: "idle",
                  }));
                  setSaveMessageByQuestionId((currentMessages) => ({
                    ...currentMessages,
                    [currentItem.questionId]: "",
                  }));
                }
              }}
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
        <button
          type="button"
          onClick={handleSaveCurrentAnswer}
          disabled={isSaveDisabled}
          className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500"
        >
          Spremi odgovor
        </button>
        {completionReadiness.readinessStatus === "ready" ? (
          <button
            type="button"
            onClick={handleCompleteAssessment}
            disabled={completionState === "submitting"}
            className="rounded-full border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-emerald-200 disabled:bg-emerald-200 disabled:text-emerald-700"
          >
            Završi procjenu
          </button>
        ) : null}
      </div>

      {currentSaveMessage ? (
        <p
          className={`text-sm leading-6 ${
            currentSaveState === "error"
              ? "text-rose-700"
              : currentSaveState === "loaded"
                ? "text-slate-600"
                : "text-emerald-700"
          }`}
        >
          {currentSaveMessage}
        </p>
      ) : null}

      {completionMessage ? (
        <p
          className={`text-sm leading-6 ${
            completionState === "error" ? "text-rose-700" : "text-emerald-700"
          }`}
        >
          {completionMessage}
        </p>
      ) : null}

      <p className="text-sm leading-6 text-slate-700">
        Navigacija ostaje lokalna, a odgovor za trenutno pitanje se sprema samo kada kliknes
        "Spremi odgovor".
      </p>
      <p className="text-sm leading-6 text-slate-500">
        Osvjezavanje stranice moze obrisati lokalni UI state. Nema autosave-a, save-on-selecta,
        submitovanja ni scoring-a u ovom slice-u.
      </p>
    </section>
  );
}
