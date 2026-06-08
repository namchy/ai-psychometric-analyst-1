import "server-only";

export type BhsUserFacingPromptPolicyOptions = {
  audience: "hr" | "participant";
  includeAuthorityOrder?: boolean;
};

export type BhsUserFacingOutputValidationError = {
  path: string;
  message: string;
};

const NON_USER_FACING_STRING_KEYS = new Set([
  "contract_version",
  "code",
  "slug",
  "locale",
  "language",
  "audience",
  "report_type",
  "display_mode",
  "domain_code",
  "facet_code",
  "score_band",
  "score_label_or_band",
  "prompt_version",
  "scoring_method",
  "test_slug",
  "test_family",
]);

const LABEL_LIKE_KEYS = new Set([
  "label",
  "domain_name",
  "facet_name",
  "name",
]);

const BHS_BAND_GUIDANCE = [
  '"high" -> "visoko izraženo" or "u višem rasponu"',
  '"moderate" -> "umjereno izraženo" or "u umjerenom rasponu"',
  '"low" -> "niže izraženo" or "u nižem rasponu"',
];

const NARRATIVE_DOMAIN_FORMS = [
  {
    title: "Savjesnost",
    narrative: "savjesnost",
  },
  {
    title: "Neuroticizam",
    narrative: "neuroticizam",
  },
  {
    title: "Ekstraverzija",
    narrative: "ekstraverzija",
  },
  {
    title: "Otvorenost prema iskustvu",
    narrative: "otvorenost prema iskustvu",
  },
  {
    title: "Spremnost na saradnju",
    narrative: "spremnost na saradnju",
  },
] as const;

const GLOBAL_FORBIDDEN_USER_FACING_PATTERNS = [
  {
    pattern: /\bsnapshot\b/iu,
    message: 'Forbidden user-facing leakage detected: "snapshot".',
  },
  {
    pattern: /\bhigh\b/iu,
    message: 'Forbidden user-facing leakage detected: "high".',
  },
  {
    pattern: /\blow\b/iu,
    message: 'Forbidden user-facing leakage detected: "low".',
  },
  {
    pattern: /\bmoderate\b/iu,
    message: 'Forbidden user-facing leakage detected: "moderate".',
  },
  {
    pattern: /\boveruse\b/iu,
    message: 'Forbidden user-facing leakage detected: "overuse".',
  },
  {
    pattern: /\bhandling\b/iu,
    message: 'Forbidden user-facing leakage detected: "handling".',
  },
  {
    pattern: /\braw score\b/iu,
    message: 'Forbidden user-facing leakage detected: "raw score".',
  },
  {
    pattern: /\bscore\b/iu,
    message: 'Forbidden user-facing leakage detected: "score".',
  },
  {
    pattern: /\bband\b/iu,
    message: 'Forbidden user-facing leakage detected: "band".',
  },
  {
    pattern: /\bschema\b/iu,
    message: 'Forbidden user-facing leakage detected: "schema".',
  },
  {
    pattern: /\bjson\b/iu,
    message: 'Forbidden user-facing leakage detected: "JSON".',
  },
  {
    pattern: /\bvalidator\b/iu,
    message: 'Forbidden user-facing leakage detected: "validator".',
  },
  {
    pattern: /\bprompt\b/iu,
    message: 'Forbidden user-facing leakage detected: "prompt".',
  },
] as const;

const HR_SECOND_PERSON_PATTERNS = [
  /(^|[^A-Za-zČĆŽŠĐčćžšđ])ti([^A-Za-zČĆŽŠĐčćžšđ]|$)/iu,
  /(^|[^A-Za-zČĆŽŠĐčćžšđ])tvoj(?:a|e|i|ih|im|oj|om|og)?([^A-Za-zČĆŽŠĐčćžšđ]|$)/iu,
  /(^|[^A-Za-zČĆŽŠĐčćžšđ])tebe([^A-Za-zČĆŽŠĐčćžšđ]|$)/iu,
  /(^|[^A-Za-zČĆŽŠĐčćžšđ])tobom([^A-Za-zČĆŽŠĐčćžšđ]|$)/iu,
  /(^|[^A-Za-zČĆŽŠĐčćžšđ])tvojem([^A-Za-zČĆŽŠĐčćžšđ]|$)/iu,
] as const;

function buildPath(parentPath: string, key: string): string {
  return parentPath ? `${parentPath}.${key}` : key;
}

function isEligibleUserFacingString(path: string, key: string | null): boolean {
  if (!path) {
    return false;
  }

  if (!key) {
    return true;
  }

  return !NON_USER_FACING_STRING_KEYS.has(key);
}

function isNarrativeStringKey(key: string | null): boolean {
  if (!key) {
    return true;
  }

  return !LABEL_LIKE_KEYS.has(key) && !NON_USER_FACING_STRING_KEYS.has(key);
}

function replaceDomainNarrativeCasing(value: string): string {
  let normalized = value;

  for (const rule of NARRATIVE_DOMAIN_FORMS) {
    const pattern = new RegExp(`([a-zčćžšđ])\\s+${rule.title}\\b`, "gu");
    normalized = normalized.replace(pattern, `$1 ${rule.narrative}`);
  }

  return normalized;
}

function canonicalizeBhsLeakage(value: string): string {
  return value
    .replace(/\bsnapshot\b/g, "izvještaj")
    .replace(/\bSnapshot\b/g, "Izvještaj")
    .replace(/\bhigh\b/g, "visoko izraženo")
    .replace(/\bHigh\b/g, "Visoko izraženo")
    .replace(/\bmoderate\b/g, "umjereno izraženo")
    .replace(/\bModerate\b/g, "Umjereno izraženo")
    .replace(/\blow\b/g, "niže izraženo")
    .replace(/\bLow\b/g, "Niže izraženo")
    .replace(/\boveruse\b/g, "prekomjerno oslanjanje")
    .replace(/\bOveruse\b/g, "Prekomjerno oslanjanje")
    .replace(/\bhandling\b/g, "postupanje")
    .replace(/\bHandling\b/g, "Postupanje");
}

function mapUserFacingStrings(
  value: unknown,
  transform: (input: string, path: string, key: string | null) => string,
  path = "",
  key: string | null = null,
): unknown {
  if (typeof value === "string") {
    if (!isEligibleUserFacingString(path, key)) {
      return value;
    }

    return transform(value, path, key);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      mapUserFacingStrings(item, transform, `${path}[${index}]`, null),
    );
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        mapUserFacingStrings(childValue, transform, buildPath(path, childKey), childKey),
      ]),
    );
  }

  return value;
}

function collectUserFacingStrings(
  value: unknown,
  visitor: (input: string, path: string, key: string | null) => void,
  path = "",
  key: string | null = null,
): void {
  if (typeof value === "string") {
    if (isEligibleUserFacingString(path, key)) {
      visitor(value, path, key);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectUserFacingStrings(item, visitor, `${path}[${index}]`, null);
    });
    return;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) => {
      collectUserFacingStrings(childValue, visitor, buildPath(path, childKey), childKey);
    });
  }
}

export function buildGlobalBhsUserFacingPromptPolicyBlock(
  options: BhsUserFacingPromptPolicyOptions,
): string {
  const lines = [
    "Global BHS user-facing language policy:",
  ];

  if (options.includeAuthorityOrder) {
    lines.push(
      "Authority composition order for this request:",
      "1. Global BHS language policy.",
      "2. Global HR report policy.",
      "3. Single-test/report-family policy.",
      "4. IPIP-specific terminology rules.",
      "5. Runtime input facts.",
    );
  }

  lines.push(
    "Write in Bosnian language, ijekavica, Latin script.",
    options.audience === "hr"
      ? "Write for HR stakeholders in an advisory, calm and workplace-oriented tone."
      : "Write for the end user in a calm, direct and non-clinical tone.",
    "Do not make hire/no-hire decisions, diagnoses, unsupported claims, or protected-trait inferences.",
    "Do not leak internal schema, JSON, validator, prompt or similar implementation language into user-facing narrative.",
    "Do not use English internal terms when a natural BHS expression exists.",
    'Forbidden user-facing terms include "snapshot", "high", "low", "moderate", "overuse", "handling", "score", "band", "raw score", "schema", "JSON", "validator" and "prompt".',
    "Natural BHS band wording guidance:",
    ...BHS_BAND_GUIDANCE,
    "Narrative casing guidance:",
    "Domain names may use Title Case only as labels and titles.",
    'Inside narrative sentences use lowercase forms: "savjesnost", "neuroticizam", "ekstraverzija", "otvorenost prema iskustvu", "spremnost na saradnju".',
  );

  if (options.audience === "hr") {
    lines.push('Do not address the candidate with second-person singular forms such as "ti" in HR reports.');
  }

  return lines.join("\n");
}

export function canonicalizeGlobalBhsUserFacingOutput<T>(value: T): T {
  return mapUserFacingStrings(
    value,
    (input, _path, key) => {
      const canonicalized = canonicalizeBhsLeakage(input);
      return isNarrativeStringKey(key)
        ? replaceDomainNarrativeCasing(canonicalized)
        : canonicalized;
    },
  ) as T;
}

export function validateGlobalBhsUserFacingOutput(
  value: unknown,
  options?: {
    audience?: "hr" | "participant";
  },
): BhsUserFacingOutputValidationError[] {
  const errors: BhsUserFacingOutputValidationError[] = [];

  collectUserFacingStrings(value, (input, path, key) => {
    for (const { pattern, message } of GLOBAL_FORBIDDEN_USER_FACING_PATTERNS) {
      if (pattern.test(input)) {
        errors.push({ path, message });
      }
    }

    if (options?.audience === "hr") {
      for (const pattern of HR_SECOND_PERSON_PATTERNS) {
        if (pattern.test(input)) {
          errors.push({
            path,
            message: 'HR report must not address the candidate with second-person singular forms such as "ti".',
          });
          break;
        }
      }
    }

    if (!isNarrativeStringKey(key)) {
      return;
    }

    for (const rule of NARRATIVE_DOMAIN_FORMS) {
      const pattern = new RegExp(`([a-zčćžšđ])\\s+${rule.title}\\b`, "u");
      if (pattern.test(input)) {
        errors.push({
          path,
          message: `Narrative text must use lowercase "${rule.narrative}" instead of "${rule.title}" inside sentences.`,
        });
      }
    }
  });

  return errors;
}
