import "server-only";

import type { AiReportReasoningEffort } from "@/lib/assessment/report-config";
import { shouldOmitOpenAiTemperature } from "@/lib/assessment/report-provider-openai";
import type { TeamFitReportInputSnapshot } from "@/lib/b2b/team-fit-report-input";
import {
  TEAM_FIT_REPORT_V2_AUDIENCE,
  TEAM_FIT_REPORT_V2_SOURCE_TYPE,
  TEAM_FIT_REPORT_V2_TYPE,
  TEAM_FIT_REPORT_V2_VERSION,
  validateTeamFitReportV2,
  type TeamFitReportV2,
  type TeamFitReportV2ValidationIssue,
} from "@/lib/b2b/team-fit-report-v2-contract";
import {
  buildTeamFitReportV2EvidenceCatalog,
  TeamFitReportV2EvidenceCatalogCollisionError,
  validateTeamFitReportV2EvidenceReferences,
  type TeamFitReportV2EvidenceCatalog,
  type TeamFitReportV2EvidenceCatalogSide,
  type TeamFitReportV2EvidenceValidationIssue,
} from "@/lib/b2b/team-fit-report-v2-evidence";
import {
  buildTeamFitReportV2Prompt,
  type TeamFitReportV2AuthoritativeEnvelope,
} from "@/lib/b2b/team-fit-report-v2-prompt";
import {
  TEAM_FIT_REPORT_V2_SCHEMA_NAME,
  getTeamFitReportV2JsonSchema as buildTeamFitReportV2Schema,
} from "@/lib/b2b/team-fit-report-v2-schema";

export const TEAM_FIT_REPORT_V2_OPENAI_PROVIDER = "openai" as const;
export const TEAM_FIT_REPORT_V2_OPENAI_PROVIDER_VERSION =
  "team_fit_report_v2_openai_provider_v1" as const;

export type TeamFitReportV2OpenAiRequest = {
  model: string;
  temperature?: number;
  reasoning_effort?: AiReportReasoningEffort;
  response_format: {
    type: "json_schema";
    json_schema: {
      name: typeof TEAM_FIT_REPORT_V2_SCHEMA_NAME;
      strict: true;
      schema: Record<string, unknown>;
    };
  };
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
};

export type TeamFitReportV2OpenAiClient = {
  createChatCompletion: (
    request: TeamFitReportV2OpenAiRequest,
  ) => Promise<{ content: string }>;
};

export type TeamFitReportV2OpenAiProviderOptions = {
  apiKey: string | null;
  model: string | null;
  timeoutMs?: number;
  temperature?: number | null;
  reasoningEffort?: AiReportReasoningEffort | null;
  fetchImpl?: typeof fetch;
  client?: TeamFitReportV2OpenAiClient;
  now?: () => string;
};

type FailureStage =
  | "configuration"
  | "input_validation"
  | "provider_transport"
  | "response_content"
  | "json_parse"
  | "contract_validation"
  | "evidence_validation";

export type GenerateTeamFitReportV2WithOpenAIResult =
  | {
      ok: true;
      snapshot: TeamFitReportV2;
      rawContent: string;
      model: string;
      promptVersion: string;
      provider: typeof TEAM_FIT_REPORT_V2_OPENAI_PROVIDER;
      providerVersion: typeof TEAM_FIT_REPORT_V2_OPENAI_PROVIDER_VERSION;
      evidenceCatalog: TeamFitReportV2EvidenceCatalog;
    }
  | {
      ok: false;
      code:
        | "config_error"
        | "input_incomplete"
        | "evidence_catalog_collision"
        | "provider_failure"
        | "empty_content"
        | "invalid_json"
        | "contract_incomplete"
        | "invalid_evidence_reference";
      stage: FailureStage;
      reason: string;
      path?: string;
      evidenceSide?: TeamFitReportV2EvidenceCatalogSide;
      evidenceKey?: string;
      evidenceSourceGroups?: string[];
      contractIssues?: TeamFitReportV2ValidationIssue[];
      evidenceIssues?: TeamFitReportV2EvidenceValidationIssue[];
      model: string | null;
      promptVersion: string | null;
      provider: typeof TEAM_FIT_REPORT_V2_OPENAI_PROVIDER;
      providerVersion: typeof TEAM_FIT_REPORT_V2_OPENAI_PROVIDER_VERSION;
    };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function uniqueSortedStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function buildAuthoritativeEnvelope(
  inputSnapshot: TeamFitReportInputSnapshot,
  generatedAt: string,
): TeamFitReportV2AuthoritativeEnvelope {
  const candidateMetadata = inputSnapshot.candidateSignals.sourceMetadata ?? null;
  const teamMetadata = inputSnapshot.teamSignals.sourceMetadata ?? null;
  const teamAggregationSnapshotId =
    teamMetadata?.aggregationSnapshotId ?? inputSnapshot.teamContext.teamSourceId;

  return {
    reportType: TEAM_FIT_REPORT_V2_TYPE,
    reportVersion: TEAM_FIT_REPORT_V2_VERSION,
    locale: inputSnapshot.locale,
    generatedAt,
    inputSnapshotVersion: inputSnapshot.inputVersion,
    teamFitReportVersion: TEAM_FIT_REPORT_V2_VERSION,
    audience: TEAM_FIT_REPORT_V2_AUDIENCE,
    sourceType: TEAM_FIT_REPORT_V2_SOURCE_TYPE,
    teamContext: {
      organizationId: inputSnapshot.organizationContext.organizationId,
      teamId: inputSnapshot.teamContext.teamId,
      teamName: inputSnapshot.teamContext.teamName,
      teamAssessmentAssignmentId: teamMetadata?.teamAssessmentAssignmentId ?? null,
      teamDynamicsAggregationSnapshotId: teamAggregationSnapshotId ?? null,
      teamDynamicsReportId: null,
    },
    candidateContext: {
      organizationId: inputSnapshot.organizationContext.organizationId,
      participantId: inputSnapshot.candidateContext.participantId,
      assessmentAssignmentId: candidateMetadata?.assessmentAssignmentId ?? null,
      compositeInputSnapshotId: inputSnapshot.candidateContext.candidateSourceId,
      compositeReportId: null,
      displayName: inputSnapshot.candidateContext.displayName,
    },
    source: {
      candidateCompositeInputVersion:
        candidateMetadata?.contractVersion ?? inputSnapshot.inputVersion,
      candidateSourceReportIds: [],
      candidateSourceTestSlugs: uniqueSortedStrings([
        ...(candidateMetadata?.sourceTestSlugs ?? []),
        ...(inputSnapshot.candidateSignals.candidateEvidence ?? []).map(
          (entry) => entry.sourceTestSlug,
        ),
      ]),
      teamInputVersion: teamMetadata?.sourceVersion ?? inputSnapshot.inputVersion,
      teamSourceReportIds: [],
      teamSourceSnapshotIds: uniqueSortedStrings([teamAggregationSnapshotId]),
      optionalContextKeys: [],
    },
    metadata: {
      provider: TEAM_FIT_REPORT_V2_OPENAI_PROVIDER,
      providerVersion: TEAM_FIT_REPORT_V2_OPENAI_PROVIDER_VERSION,
      generatedAt,
    },
  };
}

function assembleAuthoritativeSnapshot(
  parsed: unknown,
  envelope: TeamFitReportV2AuthoritativeEnvelope,
): unknown {
  const parsedObject = isPlainRecord(parsed) ? parsed : {};

  return {
    ...parsedObject,
    ...envelope,
  };
}

function createFetchOpenAiClient(
  options: Required<Pick<TeamFitReportV2OpenAiProviderOptions, "apiKey">> &
    Pick<TeamFitReportV2OpenAiProviderOptions, "timeoutMs" | "fetchImpl">,
): TeamFitReportV2OpenAiClient {
  return {
    async createChatCompletion(request) {
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs ?? 120000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await (options.fetchImpl ?? fetch)(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${options.apiKey}`,
            },
            body: JSON.stringify(request),
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`OpenAI request failed with status ${response.status}.`);
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };

        return { content: payload.choices?.[0]?.message?.content ?? "" };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function buildFailure(
  input: Omit<Extract<GenerateTeamFitReportV2WithOpenAIResult, { ok: false }>,
    "ok" | "provider" | "providerVersion"
  >,
): Extract<GenerateTeamFitReportV2WithOpenAIResult, { ok: false }> {
  return {
    ok: false,
    provider: TEAM_FIT_REPORT_V2_OPENAI_PROVIDER,
    providerVersion: TEAM_FIT_REPORT_V2_OPENAI_PROVIDER_VERSION,
    ...input,
  };
}

export async function generateTeamFitReportV2WithOpenAI(
  inputSnapshot: TeamFitReportInputSnapshot,
  options: TeamFitReportV2OpenAiProviderOptions,
): Promise<GenerateTeamFitReportV2WithOpenAIResult> {
  const generatedAt = options.now?.() ?? new Date().toISOString();

  if (!options.apiKey) {
    return buildFailure({
      code: "config_error",
      stage: "configuration",
      reason: "OpenAI API key is required.",
      model: options.model,
      promptVersion: null,
    });
  }

  if (!options.model) {
    return buildFailure({
      code: "config_error",
      stage: "configuration",
      reason: "OpenAI model is required.",
      model: null,
      promptVersion: null,
    });
  }

  let evidenceCatalog: TeamFitReportV2EvidenceCatalog;

  try {
    evidenceCatalog = buildTeamFitReportV2EvidenceCatalog(inputSnapshot);
  } catch (error) {
    if (error instanceof TeamFitReportV2EvidenceCatalogCollisionError) {
      return buildFailure({
        code: "evidence_catalog_collision",
        stage: "input_validation",
        reason: "Team Fit V2 input contains conflicting evidence for one canonical key.",
        path: error.path,
        evidenceSide: error.side,
        evidenceKey: error.key,
        evidenceSourceGroups: error.sourceGroups,
        model: options.model,
        promptVersion: null,
      });
    }

    throw error;
  }

  if (evidenceCatalog.candidate.length === 0) {
    return buildFailure({
      code: "input_incomplete",
      stage: "input_validation",
      reason: "Candidate evidence catalog is empty.",
      path: "candidateSignals.candidateEvidence",
      model: options.model,
      promptVersion: null,
    });
  }

  if (evidenceCatalog.team.length === 0) {
    return buildFailure({
      code: "input_incomplete",
      stage: "input_validation",
      reason: "Team evidence catalog is empty.",
      path: "teamSignals",
      model: options.model,
      promptVersion: null,
    });
  }

  const authoritativeEnvelope = buildAuthoritativeEnvelope(inputSnapshot, generatedAt);
  const prompt = buildTeamFitReportV2Prompt({
    inputSnapshot,
    evidenceCatalog,
    authoritativeEnvelope,
  });
  const request: TeamFitReportV2OpenAiRequest = {
    model: options.model,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: TEAM_FIT_REPORT_V2_SCHEMA_NAME,
        strict: true,
        schema: buildTeamFitReportV2Schema(),
      },
    },
    messages: [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: prompt.userPrompt },
    ],
  };

  if (!shouldOmitOpenAiTemperature(options.model)) {
    request.temperature = options.temperature ?? 0.2;
  }

  if (options.reasoningEffort) {
    request.reasoning_effort = options.reasoningEffort;
  }

  const client =
    options.client ??
    createFetchOpenAiClient({
      apiKey: options.apiKey,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
  let rawContent: string;

  try {
    const response = await client.createChatCompletion(request);
    rawContent = response.content;
  } catch {
    return buildFailure({
      code: "provider_failure",
      stage: "provider_transport",
      reason: "OpenAI Team Fit V2 transport failed.",
      model: options.model,
      promptVersion: prompt.promptVersion,
    });
  }

  if (typeof rawContent !== "string" || rawContent.trim().length === 0) {
    return buildFailure({
      code: "empty_content",
      stage: "response_content",
      reason: "Provider response did not contain JSON content.",
      model: options.model,
      promptVersion: prompt.promptVersion,
    });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return buildFailure({
      code: "invalid_json",
      stage: "json_parse",
      reason: "Provider response was not valid JSON.",
      model: options.model,
      promptVersion: prompt.promptVersion,
    });
  }

  const assembled = assembleAuthoritativeSnapshot(parsed, authoritativeEnvelope);
  const contractValidation = validateTeamFitReportV2(assembled);

  if (!contractValidation.ok) {
    return buildFailure({
      code: "contract_incomplete",
      stage: "contract_validation",
      reason: "Provider output did not satisfy the Team Fit Report V2 contract.",
      path: contractValidation.issues[0]?.path,
      contractIssues: contractValidation.issues,
      model: options.model,
      promptVersion: prompt.promptVersion,
    });
  }

  const evidenceValidation = validateTeamFitReportV2EvidenceReferences(
    contractValidation.value,
    evidenceCatalog,
  );

  if (!evidenceValidation.ok) {
    return buildFailure({
      code: "invalid_evidence_reference",
      stage: "evidence_validation",
      reason: "Provider output referenced evidence outside the allowed catalog.",
      path: evidenceValidation.issues[0]?.path,
      evidenceIssues: evidenceValidation.issues,
      model: options.model,
      promptVersion: prompt.promptVersion,
    });
  }

  return {
    ok: true,
    snapshot: contractValidation.value,
    rawContent,
    model: options.model,
    promptVersion: prompt.promptVersion,
    provider: TEAM_FIT_REPORT_V2_OPENAI_PROVIDER,
    providerVersion: TEAM_FIT_REPORT_V2_OPENAI_PROVIDER_VERSION,
    evidenceCatalog,
  };
}
