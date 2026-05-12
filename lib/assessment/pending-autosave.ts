import type {
  AssessmentSelectionsInput,
  AssessmentSelectionValue,
} from "@/lib/assessment/types";

type PendingSelections = AssessmentSelectionsInput;

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function parsePendingSelections(rawValue: string | null): PendingSelections {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed).filter(
      (entry): entry is [string, AssessmentSelectionValue] =>
        typeof entry[0] === "string" &&
        (typeof entry[1] === "string" ||
          (Array.isArray(entry[1]) && entry[1].every((item) => typeof item === "string"))),
    );

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function writePendingSelectionsMap(
  attemptId: string,
  nextSelections: PendingSelections,
): PendingSelections {
  if (!canUseLocalStorage()) {
    return nextSelections;
  }

  const key = buildPendingAutosaveKey(attemptId);

  if (Object.keys(nextSelections).length === 0) {
    window.localStorage.removeItem(key);
    return {};
  }

  window.localStorage.setItem(key, JSON.stringify(nextSelections));
  return nextSelections;
}

function areSelectionValuesEqual(
  left: AssessmentSelectionValue | undefined,
  right: AssessmentSelectionValue | undefined,
): boolean {
  if (typeof left === "string" || typeof right === "string") {
    return left === right;
  }

  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function buildPendingAutosaveKey(attemptId: string): string {
  return `assessment-pending:${attemptId}`;
}

export function readPendingSelections(attemptId: string | null | undefined): PendingSelections {
  if (!attemptId || !canUseLocalStorage()) {
    return {};
  }

  return parsePendingSelections(window.localStorage.getItem(buildPendingAutosaveKey(attemptId)));
}

export function upsertPendingSelection(
  attemptId: string | null | undefined,
  questionId: string,
  value: AssessmentSelectionValue,
): PendingSelections {
  if (!attemptId) {
    return {};
  }

  const nextSelections = {
    ...readPendingSelections(attemptId),
    [questionId]: value,
  };

  return writePendingSelectionsMap(attemptId, nextSelections);
}

export function removeFlushedSelections(
  attemptId: string | null | undefined,
  flushedSelections: PendingSelections,
): PendingSelections {
  if (!attemptId) {
    return {};
  }

  const pendingSelections = readPendingSelections(attemptId);
  let didRemoveSelection = false;

  for (const [questionId, value] of Object.entries(flushedSelections)) {
    if (areSelectionValuesEqual(pendingSelections[questionId], value)) {
      delete pendingSelections[questionId];
      didRemoveSelection = true;
    }
  }

  if (!didRemoveSelection) {
    return pendingSelections;
  }

  return writePendingSelectionsMap(attemptId, pendingSelections);
}

export function clearPendingSelections(attemptId: string | null | undefined): void {
  if (!attemptId || !canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(buildPendingAutosaveKey(attemptId));
}
