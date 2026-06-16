import type {
  TeamFitProviderEvidenceSide,
  TeamFitProviderPromptEvidenceItem,
  TeamFitProviderPromptInputBundle,
} from "@/lib/b2b/team-fit-report-provider-prompt";
import {
  TEAM_FIT_REPORT_EVIDENCE_SOURCE_TYPES,
  type TeamFitReportEvidenceSourceType,
} from "@/lib/b2b/team-fit-report-contract";

type TeamFitInputBundleSignalInput = {
  key: string;
  label: string;
  signal: string;
  relationNote?: string;
  side?: TeamFitProviderEvidenceSide;
  sourceType?: TeamFitReportEvidenceSourceType;
};

type TeamFitInterpretiveLinkInput = {
  candidateSignalKey: string;
  candidateCollection?: "candidateDeepProfileSignals" | "teamStyleCollaborationSignals";
  targetSignalKey: string;
  targetCollection:
    | "teamDynamicsAggregationSignals"
    | "teamDynamicsExecutiveOverviewSignals"
    | "hrAdminOptionalContextSignals";
  label: string;
  signal: string;
  relationNote?: string;
  side?: TeamFitProviderEvidenceSide;
  sourceType?: TeamFitReportEvidenceSourceType;
};

type TeamFitOptionalSignalGroup = {
  allowed: boolean;
  signals: TeamFitInputBundleSignalInput[];
};

type TeamFitTeamStyleSignalGroup = TeamFitOptionalSignalGroup & {
  sourceType?: TeamFitReportEvidenceSourceType;
};

export type TeamFitReportInputBundleBuildInput = {
  locale: string;
  generatedFor: {
    organizationId: string;
    teamId: string;
    participantId: string;
    teamName?: string | null;
    candidateDisplayName?: string | null;
  };
  candidateDeepProfileSignals: TeamFitInputBundleSignalInput[];
  teamDynamicsAggregationSignals: TeamFitInputBundleSignalInput[];
  teamDynamicsExecutiveOverview?: TeamFitOptionalSignalGroup;
  teamStyleCollaboration?: TeamFitTeamStyleSignalGroup;
  hrAdminOptionalContext?: TeamFitOptionalSignalGroup;
  interpretiveLinks: TeamFitInterpretiveLinkInput[];
  interpretationLimits: string[];
  metadata: {
    generatedAt: string;
    requestId?: string;
    inputVersion?: string;
    sourceVersion?: string;
  };
};

export type TeamFitReportInputBundleValidationResult =
  | { ok: true; bundle: TeamFitProviderPromptInputBundle }
  | { ok: false; errors: string[] };

type NormalizedSignalGroupResult = {
  items: TeamFitProviderPromptEvidenceItem[];
  keyToId: Map<string, string>;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.-]+|[_.-]+$/g, "");
}

function normalizeOptionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function validateNonEmptyString(
  value: unknown,
  path: string,
  errors: string[],
): string | null {
  if (!isNonEmptyString(value)) {
    errors.push(`${path}: Expected non-empty string.`);
    return null;
  }

  return value.trim();
}

function validateStringArray(value: unknown, path: string, errors: string[]): string[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return [];
  }

  return value
    .map((entry, index) => validateNonEmptyString(entry, `${path}[${index}]`, errors))
    .filter((entry): entry is string => entry !== null);
}

function pushDuplicateIdErrors(
  items: TeamFitProviderPromptEvidenceItem[],
  errors: string[],
): void {
  const seen = new Set<string>();

  items.forEach((item) => {
    if (seen.has(item.id)) {
      errors.push(`evidencePack.${item.id}: Duplicate evidence id.`);
      return;
    }

    seen.add(item.id);
  });
}

function normalizeSignalGroup(
  value: unknown,
  options: {
    path: string;
    prefix: string;
    expectedSourceType: TeamFitReportEvidenceSourceType;
    expectedSide: TeamFitProviderEvidenceSide;
  },
  errors: string[],
): NormalizedSignalGroupResult {
  if (!Array.isArray(value)) {
    errors.push(`${options.path}: Expected array.`);
    return { items: [], keyToId: new Map() };
  }

  const items: TeamFitProviderPromptEvidenceItem[] = [];
  const keyToId = new Map<string, string>();

  value.forEach((entry, index) => {
    const itemPath = `${options.path}[${index}]`;

    if (!isPlainRecord(entry)) {
      errors.push(`${itemPath}: Expected object.`);
      return;
    }

    const key = validateNonEmptyString(entry.key, `${itemPath}.key`, errors);
    const label = validateNonEmptyString(entry.label, `${itemPath}.label`, errors);
    const signal = validateNonEmptyString(entry.signal, `${itemPath}.signal`, errors);

    if (entry.sourceType != null && entry.sourceType !== options.expectedSourceType) {
      errors.push(
        `${itemPath}.sourceType: Expected ${options.expectedSourceType}.`,
      );
    }

    if (entry.side != null && entry.side !== options.expectedSide) {
      errors.push(`${itemPath}.side: Expected ${options.expectedSide}.`);
    }

    if (!key || !label || !signal) {
      return;
    }

    const normalizedKey = sanitizeKey(key);

    if (!normalizedKey) {
      errors.push(`${itemPath}.key: Could not build stable evidence id.`);
      return;
    }

    const id = `${options.prefix}.${normalizedKey}`;

    if (keyToId.has(key)) {
      errors.push(`${itemPath}.key: Duplicate signal key in group.`);
      return;
    }

    keyToId.set(key, id);
    items.push({
      id,
      sourceType: options.expectedSourceType,
      side: options.expectedSide,
      label,
      signal,
      relationNote: normalizeOptionalString(entry.relationNote),
    });
  });

  return { items, keyToId };
}

function validateOptionalSignalGroup(
  value: unknown,
  path: string,
  errors: string[],
): TeamFitOptionalSignalGroup | null {
  if (!isPlainRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return null;
  }

  if (typeof value.allowed !== "boolean") {
    errors.push(`${path}.allowed: Expected boolean.`);
  }

  if (!Array.isArray(value.signals)) {
    errors.push(`${path}.signals: Expected array.`);
  }

  return {
    allowed: value.allowed === true,
    signals: Array.isArray(value.signals)
      ? (value.signals as TeamFitInputBundleSignalInput[])
      : [],
  };
}

function validateTeamStyleGroup(
  value: unknown,
  path: string,
  errors: string[],
): TeamFitTeamStyleSignalGroup | null {
  const group = validateOptionalSignalGroup(value, path, errors);

  if (!group) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const sourceType = record.sourceType;

  if (group.signals.length > 0 && sourceType !== "team_style_collaboration_signal") {
    errors.push(
      `${path}.sourceType: Team Style signals require explicit sourceType team_style_collaboration_signal.`,
    );
  }

  return {
    ...group,
    sourceType:
      sourceType === "team_style_collaboration_signal"
        ? sourceType
        : undefined,
  };
}

function buildInterpretiveLinks(
  value: unknown,
  references: {
    candidateDeepProfileSignals: Map<string, string>;
    teamStyleCollaborationSignals: Map<string, string>;
    teamDynamicsAggregationSignals: Map<string, string>;
    teamDynamicsExecutiveOverviewSignals: Map<string, string>;
    hrAdminOptionalContextSignals: Map<string, string>;
  },
  errors: string[],
): TeamFitProviderPromptEvidenceItem[] {
  if (!Array.isArray(value)) {
    errors.push("interpretiveLinks: Expected array.");
    return [];
  }

  const items: TeamFitProviderPromptEvidenceItem[] = [];

  value.forEach((entry, index) => {
    const itemPath = `interpretiveLinks[${index}]`;

    if (!isPlainRecord(entry)) {
      errors.push(`${itemPath}: Expected object.`);
      return;
    }

    const candidateCollection =
      entry.candidateCollection === "teamStyleCollaborationSignals"
        ? "teamStyleCollaborationSignals"
        : "candidateDeepProfileSignals";
    const candidateSignalKey = validateNonEmptyString(
      entry.candidateSignalKey,
      `${itemPath}.candidateSignalKey`,
      errors,
    );
    const targetSignalKey = validateNonEmptyString(
      entry.targetSignalKey,
      `${itemPath}.targetSignalKey`,
      errors,
    );
    const targetCollection = validateNonEmptyString(
      entry.targetCollection,
      `${itemPath}.targetCollection`,
      errors,
    ) as
      | "teamDynamicsAggregationSignals"
      | "teamDynamicsExecutiveOverviewSignals"
      | "hrAdminOptionalContextSignals"
      | null;
    const label = validateNonEmptyString(entry.label, `${itemPath}.label`, errors);
    const signal = validateNonEmptyString(entry.signal, `${itemPath}.signal`, errors);

    if (entry.sourceType != null && entry.sourceType !== "interpretive_link") {
      errors.push(`${itemPath}.sourceType: Expected interpretive_link.`);
    }

    if (entry.side != null && entry.side !== "interpretive_link") {
      errors.push(`${itemPath}.side: Expected interpretive_link.`);
    }

    if (
      targetCollection &&
      ![
        "teamDynamicsAggregationSignals",
        "teamDynamicsExecutiveOverviewSignals",
        "hrAdminOptionalContextSignals",
      ].includes(targetCollection)
    ) {
      errors.push(
        `${itemPath}.targetCollection: Expected teamDynamicsAggregationSignals, teamDynamicsExecutiveOverviewSignals, or hrAdminOptionalContextSignals.`,
      );
    }

    if (!candidateSignalKey || !targetSignalKey || !targetCollection || !label || !signal) {
      return;
    }

    const candidateMap = references[candidateCollection];
    const targetMap = references[targetCollection];
    const candidateId = candidateMap.get(candidateSignalKey);
    const targetId = targetMap.get(targetSignalKey);

    if (!candidateId) {
      errors.push(
        `${itemPath}: Interpretive link requires valid candidate evidence reference.`,
      );
      return;
    }

    if (!targetId) {
      errors.push(
        `${itemPath}: Interpretive link requires valid team or context evidence reference.`,
      );
      return;
    }

    items.push({
      id: `link.${candidateId}__${targetId}`,
      sourceType: "interpretive_link",
      side: "interpretive_link",
      label,
      signal,
      relationNote: normalizeOptionalString(entry.relationNote),
    });
  });

  return items;
}

export function buildTeamFitReportInputBundle(
  input: TeamFitReportInputBundleBuildInput,
): TeamFitReportInputBundleValidationResult {
  const errors: string[] = [];

  if (!isPlainRecord(input)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  const locale = validateNonEmptyString(input.locale, "locale", errors);
  const interpretationLimits = validateStringArray(
    input.interpretationLimits,
    "interpretationLimits",
    errors,
  );

  if (!isPlainRecord(input.generatedFor)) {
    errors.push("generatedFor: Expected object.");
  }

  if (!isPlainRecord(input.metadata)) {
    errors.push("metadata: Expected object.");
  }

  const generatedFor = isPlainRecord(input.generatedFor)
    ? {
        organizationId: validateNonEmptyString(
          input.generatedFor.organizationId,
          "generatedFor.organizationId",
          errors,
        ),
        teamId: validateNonEmptyString(input.generatedFor.teamId, "generatedFor.teamId", errors),
        participantId: validateNonEmptyString(
          input.generatedFor.participantId,
          "generatedFor.participantId",
          errors,
        ),
        teamName:
          input.generatedFor.teamName == null
            ? null
            : validateNonEmptyString(input.generatedFor.teamName, "generatedFor.teamName", errors),
        candidateDisplayName:
          input.generatedFor.candidateDisplayName == null
            ? null
            : validateNonEmptyString(
                input.generatedFor.candidateDisplayName,
                "generatedFor.candidateDisplayName",
                errors,
              ),
      }
    : null;

  const metadata = isPlainRecord(input.metadata)
    ? {
        generatedAt: validateNonEmptyString(
          input.metadata.generatedAt,
          "metadata.generatedAt",
          errors,
        ),
        requestId: normalizeOptionalString(input.metadata.requestId),
        inputVersion: normalizeOptionalString(input.metadata.inputVersion),
        sourceVersion: normalizeOptionalString(input.metadata.sourceVersion),
      }
    : null;

  const candidateDeepProfile = normalizeSignalGroup(
    input.candidateDeepProfileSignals,
    {
      path: "candidateDeepProfileSignals",
      prefix: "candidate.deep_profile",
      expectedSourceType: "candidate_deep_profile_signal",
      expectedSide: "candidate",
    },
    errors,
  );
  const teamDynamicsAggregation = normalizeSignalGroup(
    input.teamDynamicsAggregationSignals,
    {
      path: "teamDynamicsAggregationSignals",
      prefix: "team.dynamics",
      expectedSourceType: "team_dynamics_aggregation_signal",
      expectedSide: "team",
    },
    errors,
  );

  const executiveOverviewGroup = input.teamDynamicsExecutiveOverview
    ? validateOptionalSignalGroup(
        input.teamDynamicsExecutiveOverview,
        "teamDynamicsExecutiveOverview",
        errors,
      )
    : null;
  const hrContextGroup = input.hrAdminOptionalContext
    ? validateOptionalSignalGroup(
        input.hrAdminOptionalContext,
        "hrAdminOptionalContext",
        errors,
      )
    : null;
  const teamStyleGroup = input.teamStyleCollaboration
    ? validateTeamStyleGroup(
        input.teamStyleCollaboration,
        "teamStyleCollaboration",
        errors,
      )
    : null;

  if (
    executiveOverviewGroup &&
    executiveOverviewGroup.signals.length > 0 &&
    executiveOverviewGroup.allowed !== true
  ) {
    errors.push(
      "teamDynamicsExecutiveOverview: Signals require explicit allow flag.",
    );
  }

  if (
    hrContextGroup &&
    hrContextGroup.signals.length > 0 &&
    hrContextGroup.allowed !== true
  ) {
    errors.push("hrAdminOptionalContext: Signals require explicit allow flag.");
  }

  if (teamStyleGroup && teamStyleGroup.signals.length > 0 && teamStyleGroup.allowed !== true) {
    errors.push("teamStyleCollaboration: Signals require explicit allow flag.");
  }

  const teamDynamicsExecutiveOverview = executiveOverviewGroup?.allowed
    ? normalizeSignalGroup(
        executiveOverviewGroup.signals,
        {
          path: "teamDynamicsExecutiveOverview.signals",
          prefix: "context.executive_overview",
          expectedSourceType: "team_dynamics_executive_overview_signal",
          expectedSide: "context",
        },
        errors,
      )
    : { items: [], keyToId: new Map<string, string>() };

  const hrAdminOptionalContext = hrContextGroup?.allowed
    ? normalizeSignalGroup(
        hrContextGroup.signals,
        {
          path: "hrAdminOptionalContext.signals",
          prefix: "context.hr",
          expectedSourceType: "hr_admin_optional_context",
          expectedSide: "context",
        },
        errors,
      )
    : { items: [], keyToId: new Map<string, string>() };

  const teamStyleCollaboration = teamStyleGroup?.allowed
    ? normalizeSignalGroup(
        teamStyleGroup.signals,
        {
          path: "teamStyleCollaboration.signals",
          prefix: "candidate.team_style",
          expectedSourceType: "team_style_collaboration_signal",
          expectedSide: "candidate",
        },
        errors,
      )
    : { items: [], keyToId: new Map<string, string>() };

  const interpretiveLinks = buildInterpretiveLinks(
    input.interpretiveLinks,
    {
      candidateDeepProfileSignals: candidateDeepProfile.keyToId,
      teamStyleCollaborationSignals: teamStyleCollaboration.keyToId,
      teamDynamicsAggregationSignals: teamDynamicsAggregation.keyToId,
      teamDynamicsExecutiveOverviewSignals: teamDynamicsExecutiveOverview.keyToId,
      hrAdminOptionalContextSignals: hrAdminOptionalContext.keyToId,
    },
    errors,
  );

  const evidencePack = [
    ...candidateDeepProfile.items,
    ...teamDynamicsAggregation.items,
    ...teamDynamicsExecutiveOverview.items,
    ...teamStyleCollaboration.items,
    ...hrAdminOptionalContext.items,
    ...interpretiveLinks,
  ];

  if (candidateDeepProfile.items.length === 0) {
    errors.push("candidateDeepProfileSignals: Missing required candidate signal.");
  }

  if (teamDynamicsAggregation.items.length === 0) {
    errors.push("teamDynamicsAggregationSignals: Missing required team signal.");
  }

  pushDuplicateIdErrors(evidencePack, errors);

  if (errors.length > 0 || !locale || !generatedFor || !metadata) {
    return { ok: false, errors };
  }

  const bundle: TeamFitProviderPromptInputBundle = {
    locale,
    generatedFor: {
      organizationId: generatedFor.organizationId ?? "",
      teamId: generatedFor.teamId ?? "",
      participantId: generatedFor.participantId ?? "",
      teamName: generatedFor.teamName ?? null,
      candidateDisplayName: generatedFor.candidateDisplayName ?? null,
    },
    candidateDeepProfileSignals: candidateDeepProfile.items,
    teamDynamicsAggregationSignals: teamDynamicsAggregation.items,
    teamDynamicsExecutiveOverviewSignals: teamDynamicsExecutiveOverview.items,
    teamStyleCollaborationSignals: teamStyleCollaboration.items,
    hrAdminOptionalContextSignals: hrAdminOptionalContext.items,
    interpretiveLinks,
    interpretationLimits,
    metadata: {
      generatedAt: metadata.generatedAt ?? "",
      requestId: metadata.requestId,
      inputVersion: metadata.inputVersion,
      sourceVersion: metadata.sourceVersion,
    },
  };

  return { ok: true, bundle };
}

function validateEvidenceItems(
  value: unknown,
  path: string,
  expectedSides: TeamFitProviderEvidenceSide[],
  expectedSourceTypes: TeamFitReportEvidenceSourceType[],
  errors: string[],
): TeamFitProviderPromptEvidenceItem[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return [];
  }

  return value
    .map((entry, index): TeamFitProviderPromptEvidenceItem | null => {
      const itemPath = `${path}[${index}]`;

      if (!isPlainRecord(entry)) {
        errors.push(`${itemPath}: Expected object.`);
        return null;
      }

      const id = validateNonEmptyString(entry.id, `${itemPath}.id`, errors);
      const sourceType = validateNonEmptyString(
        entry.sourceType,
        `${itemPath}.sourceType`,
        errors,
      ) as TeamFitReportEvidenceSourceType | null;
      const side = validateNonEmptyString(
        entry.side,
        `${itemPath}.side`,
        errors,
      ) as TeamFitProviderEvidenceSide | null;
      const label = validateNonEmptyString(entry.label, `${itemPath}.label`, errors);
      const signal = validateNonEmptyString(entry.signal, `${itemPath}.signal`, errors);

      if (sourceType && !TEAM_FIT_REPORT_EVIDENCE_SOURCE_TYPES.includes(sourceType)) {
        errors.push(`${itemPath}.sourceType: Unsupported evidence source type.`);
      }

      if (sourceType && !expectedSourceTypes.includes(sourceType)) {
        errors.push(`${itemPath}.sourceType: Unsupported evidence source type for this collection.`);
      }

      if (side && !expectedSides.includes(side)) {
        errors.push(`${itemPath}.side: Unsupported evidence side for this collection.`);
      }

      if (!id || !sourceType || !side || !label || !signal) {
        return null;
      }

      const item: TeamFitProviderPromptEvidenceItem = {
        id,
        sourceType,
        side,
        label,
        signal,
      };

      const relationNote = normalizeOptionalString(entry.relationNote);

      if (relationNote) {
        item.relationNote = relationNote;
      }

      return item;
    })
    .filter((entry): entry is TeamFitProviderPromptEvidenceItem => entry !== null);
}

function validateInterpretiveLinkReferences(
  interpretiveLinks: TeamFitProviderPromptEvidenceItem[],
  references: {
    candidateIds: Set<string>;
    teamOrContextIds: Set<string>;
  },
  errors: string[],
): void {
  interpretiveLinks.forEach((entry, index) => {
    const prefix = "link.";

    if (!entry.id.startsWith(prefix)) {
      errors.push(`interpretiveLinks[${index}].id: Expected stable link.<candidate>__<target> pattern.`);
      return;
    }

    const referencePart = entry.id.slice(prefix.length);
    const separatorIndex = referencePart.indexOf("__");

    if (separatorIndex <= 0 || separatorIndex >= referencePart.length - 2) {
      errors.push(`interpretiveLinks[${index}].id: Expected stable link.<candidate>__<target> pattern.`);
      return;
    }

    const candidateId = referencePart.slice(0, separatorIndex);
    const targetId = referencePart.slice(separatorIndex + 2);

    if (!references.candidateIds.has(candidateId)) {
      errors.push(
        `interpretiveLinks[${index}].id: Interpretive link requires existing candidate evidence reference.`,
      );
    }

    if (!references.teamOrContextIds.has(targetId)) {
      errors.push(
        `interpretiveLinks[${index}].id: Interpretive link requires existing team or context evidence reference.`,
      );
    }
  });
}

export function validateTeamFitReportInputBundle(
  bundle: unknown,
): TeamFitReportInputBundleValidationResult {
  const errors: string[] = [];

  if (!isPlainRecord(bundle)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  const locale = validateNonEmptyString(bundle.locale, "locale", errors);
  const interpretationLimits = validateStringArray(
    bundle.interpretationLimits,
    "interpretationLimits",
    errors,
  );

  if (!isPlainRecord(bundle.generatedFor)) {
    errors.push("generatedFor: Expected object.");
  }

  if (!isPlainRecord(bundle.metadata)) {
    errors.push("metadata: Expected object.");
  }

  const candidateDeepProfileSignals = validateEvidenceItems(
    bundle.candidateDeepProfileSignals,
    "candidateDeepProfileSignals",
    ["candidate"],
    ["candidate_deep_profile_signal"],
    errors,
  );
  const teamDynamicsAggregationSignals = validateEvidenceItems(
    bundle.teamDynamicsAggregationSignals,
    "teamDynamicsAggregationSignals",
    ["team"],
    ["team_dynamics_aggregation_signal"],
    errors,
  );
  const teamDynamicsExecutiveOverviewSignals = validateEvidenceItems(
    bundle.teamDynamicsExecutiveOverviewSignals ?? [],
    "teamDynamicsExecutiveOverviewSignals",
    ["context"],
    ["team_dynamics_executive_overview_signal"],
    errors,
  );
  const teamStyleCollaborationSignals = validateEvidenceItems(
    bundle.teamStyleCollaborationSignals ?? [],
    "teamStyleCollaborationSignals",
    ["candidate"],
    ["team_style_collaboration_signal"],
    errors,
  );
  const hrAdminOptionalContextSignals = validateEvidenceItems(
    bundle.hrAdminOptionalContextSignals ?? [],
    "hrAdminOptionalContextSignals",
    ["context"],
    ["hr_admin_optional_context"],
    errors,
  );
  const interpretiveLinks = validateEvidenceItems(
    bundle.interpretiveLinks,
    "interpretiveLinks",
    ["interpretive_link"],
    ["interpretive_link"],
    errors,
  );

  if (candidateDeepProfileSignals.length === 0) {
    errors.push("candidateDeepProfileSignals: Missing required candidate signal.");
  }

  if (teamDynamicsAggregationSignals.length === 0) {
    errors.push("teamDynamicsAggregationSignals: Missing required team signal.");
  }

  const evidencePack = [
    ...candidateDeepProfileSignals,
    ...teamDynamicsAggregationSignals,
    ...teamDynamicsExecutiveOverviewSignals,
    ...teamStyleCollaborationSignals,
    ...hrAdminOptionalContextSignals,
    ...interpretiveLinks,
  ];

  pushDuplicateIdErrors(evidencePack, errors);
  validateInterpretiveLinkReferences(
    interpretiveLinks,
    {
      candidateIds: new Set([
        ...candidateDeepProfileSignals.map((entry) => entry.id),
        ...teamStyleCollaborationSignals.map((entry) => entry.id),
      ]),
      teamOrContextIds: new Set([
        ...teamDynamicsAggregationSignals.map((entry) => entry.id),
        ...teamDynamicsExecutiveOverviewSignals.map((entry) => entry.id),
        ...hrAdminOptionalContextSignals.map((entry) => entry.id),
      ]),
    },
    errors,
  );

  if (errors.length > 0 || !locale || !isPlainRecord(bundle.generatedFor) || !isPlainRecord(bundle.metadata)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    bundle: bundle as TeamFitProviderPromptInputBundle,
  };
}

export function getTeamFitReportInputBundleEvidenceIds(
  bundle: TeamFitProviderPromptInputBundle,
): string[] {
  return [
    ...bundle.candidateDeepProfileSignals,
    ...bundle.teamDynamicsAggregationSignals,
    ...(bundle.teamDynamicsExecutiveOverviewSignals ?? []),
    ...(bundle.teamStyleCollaborationSignals ?? []),
    ...(bundle.hrAdminOptionalContextSignals ?? []),
    ...bundle.interpretiveLinks,
  ].map((entry) => entry.id);
}
