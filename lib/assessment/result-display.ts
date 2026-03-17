const DIMENSION_DISPLAY_LABELS: Record<string, string> = {
  extraversion: "Ekstraverzija",
  agreeableness: "Kooperativnost",
  conscientiousness: "Savjesnost",
  emotional_stability: "Emocionalna stabilnost",
  neuroticism: "Emocionalna stabilnost",
  intellect: "Otvorenost prema iskustvu",
  openness: "Otvorenost prema iskustvu",
  openness_to_experience: "Otvorenost prema iskustvu",
};

const DIMENSION_HELPER_LABELS: Record<string, string> = {
  ekstraverzija: "socijalna energija i izražavanje",
  kooperativnost: "saradnja, obzirnost i odnos prema drugima",
  savjesnost: "organizacija, disciplina i odgovornost",
  "emocionalna stabilnost": "reakcija na stres, pritisak i neizvjesnost",
  "otvorenost prema iskustvu": "odnos prema novim idejama, učenju i promjenama",
};

export function formatDimensionLabel(dimensionKey: string): string {
  const normalizedKey = dimensionKey.trim().toLowerCase();

  if (DIMENSION_DISPLAY_LABELS[normalizedKey]) {
    return DIMENSION_DISPLAY_LABELS[normalizedKey];
  }

  return dimensionKey
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatScoreLabel(score: number): string {
  const absoluteScore = Math.abs(score);
  const lastTwoDigits = absoluteScore % 100;
  const lastDigit = absoluteScore % 10;

  if (lastTwoDigits < 11 || lastTwoDigits > 14) {
    if (lastDigit === 1) {
      return `${score} bod`;
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
      return `${score} boda`;
    }
  }

  return `${score} bodova`;
}

export function getDimensionHelperLabel(dimensionKey: string): string | null {
  const label = formatDimensionLabel(dimensionKey).trim().toLowerCase();
  return DIMENSION_HELPER_LABELS[label] ?? null;
}
