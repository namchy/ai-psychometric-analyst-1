import type { TeamFitReportV1 } from "@/lib/b2b/team-fit-report-contract";
import type { TeamFitReportInputSnapshot } from "@/lib/b2b/team-fit-report-input";

function uniqueNonEmptyStrings(values: unknown[]): string[] {
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      ),
    ),
  ];
}

export function mapTeamFitReportSourceFromInput(
  reportSnapshot: TeamFitReportV1,
  inputSnapshot: TeamFitReportInputSnapshot,
): TeamFitReportV1 {
  const metadataSlugs = inputSnapshot.candidateSignals.sourceMetadata?.sourceTestSlugs ?? [];
  const evidenceSlugs =
    inputSnapshot.candidateSignals.candidateEvidence?.map(
      (evidence) => evidence.sourceTestSlug,
    ) ?? [];
  const candidateSourceTestSlugs = uniqueNonEmptyStrings([...metadataSlugs, ...evidenceSlugs]);

  return {
    ...reportSnapshot,
    source: {
      ...reportSnapshot.source,
      candidateSourceTestSlugs,
    },
  };
}
