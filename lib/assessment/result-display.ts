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
