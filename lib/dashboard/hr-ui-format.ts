const HR_STATUS_LABELS: Record<string, string> = {
  completed: "završeno",
  in_progress: "u toku",
  queued: "čeka",
  processing: "u obradi",
  ready: "spremno",
  failed: "neuspjelo",
  abandoned: "prekinuto",
  unavailable: "nedostupno",
  not_assigned: "nije dodijeljeno",
  not_started: "nije započeto",
};

const HR_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("bs-BA", {
  timeZone: "Europe/Sarajevo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function normalizeStatusKey(status: string | null | undefined): string | null {
  if (typeof status !== "string") {
    return null;
  }

  const normalized = status.trim().toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

export function formatHrLifecycleStatus(status: string | null | undefined): string {
  const normalized = normalizeStatusKey(status);

  if (!normalized) {
    return "nepoznato";
  }

  return HR_STATUS_LABELS[normalized] ?? "nepoznato";
}

export function formatHrDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return "nije dostupno";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "nije dostupno";
  }

  const parts = HR_DATE_TIME_FORMATTER.formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;

  if (!day || !month || !year || !hour || !minute) {
    return "nije dostupno";
  }

  return `${day}.${month}.${year}, ${hour}:${minute}`;
}

export function formatHrShortId(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "nije dostupno";
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return "nije dostupno";
  }

  if (normalized.length <= 8) {
    return normalized;
  }

  return `${normalized.slice(0, 8)}…`;
}
