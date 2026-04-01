export function getAssessmentDisplayName(
  input: {
    name?: string | null;
    slug?: string | null;
  } | null,
): string {
  const normalizedName = input?.name?.trim().toLowerCase() ?? "";
  const normalizedSlug = input?.slug?.trim().toLowerCase() ?? "";

  if (normalizedName.includes("ipip-50") || normalizedSlug.includes("ipip-50")) {
    return "Big Five upitnik ličnosti (IPIP-50)";
  }

  if (normalizedName.includes("ipip-ipc") || normalizedSlug.includes("ipip-ipc")) {
    return "IPC procjena interpersonalnog stila";
  }

  return input?.name ?? input?.slug ?? "Procjena";
}
