type AssessmentDisplayInput = {
  name?: string | null;
  slug?: string | null;
} | null;

type AssessmentDisplayInfo = {
  title: string;
  subtitle?: string;
};

const ASSESSMENT_DISPLAY_BY_SLUG: Record<string, AssessmentDisplayInfo> = {
  "ipip-neo-120-v1": {
    title: "Procjena obrazaca ponašanja",
    subtitle: "IPIP-NEO-120",
  },
  safran_v1: {
    title: "Procjena kognitivnog rezonovanja",
    subtitle: "SAFRAN",
  },
  mwms_v1: {
    title: "Procjena izvora radne motivacije",
    subtitle: "MWMS",
  },
};

export function getAssessmentDisplayInfo(input: AssessmentDisplayInput): AssessmentDisplayInfo {
  const normalizedName = input?.name?.trim().toLowerCase() ?? "";
  const normalizedSlug = input?.slug?.trim().toLowerCase() ?? "";
  const exactSlugMatch = normalizedSlug ? ASSESSMENT_DISPLAY_BY_SLUG[normalizedSlug] : undefined;

  if (exactSlugMatch) {
    return exactSlugMatch;
  }

  if (normalizedName.includes("ipip-50") || normalizedSlug.includes("ipip-50")) {
    return { title: "Big Five upitnik ličnosti (IPIP-50)" };
  }

  if (normalizedName.includes("ipip-ipc") || normalizedSlug.includes("ipip-ipc")) {
    return { title: "IPC procjena interpersonalnog stila" };
  }

  if (normalizedName.includes("ipip-neo-120") || normalizedSlug.includes("ipip-neo-120")) {
    return { title: "Big Five procjena ličnosti (IPIP-NEO-120)" };
  }

  if (normalizedName.includes("safran") || normalizedSlug.includes("safran")) {
    return { title: "SAFRAN" };
  }

  return { title: input?.name ?? input?.slug ?? "Procjena" };
}

export function getAssessmentDisplayName(input: AssessmentDisplayInput): string {
  return getAssessmentDisplayInfo(input).title;
}
