export type ParticipantReportSafetyFinding = {
  path: string;
  code:
    | "hire_decision"
    | "diagnosis_or_medical_claim"
    | "discriminatory_claim"
    | "harmful_or_fatalistic_label"
    | "degrading_tone";
  ruleId: string;
  matchedTerm: string;
  message: string;
};

const NON_NARRATIVE_KEYS = new Set([
  "audience",
  "band",
  "code",
  "contract_version",
  "domain_code",
  "facet_code",
  "generated_at",
  "generatedLanguage",
  "locale",
  "report_type",
  "reportType",
  "schema_version",
  "source_type",
  "sourceType",
  "test_slug",
  "testSlug",
]);

const RULES: Array<{
  code: ParticipantReportSafetyFinding["code"];
  message: string;
  matchers: Array<{ ruleId: string; pattern: RegExp }>;
}> = [
  {
    code: "hire_decision",
    message: "Participant report must not make a hire/no-hire decision.",
    matchers: [
      { ruleId: "no_hire_literal", pattern: /\bno-hire\b/iu },
      { ruleId: "hire_literal", pattern: /\bhire\b/iu },
      { ruleId: "zaposliti_positive", pattern: /\btreba (?:ga|je|ih|ovu osobu )?zaposliti\b/iu },
      { ruleId: "zaposliti_negative", pattern: /\bne (?:treba )?(?:ga|je|ih|ovu osobu )?zaposliti\b/iu },
      { ruleId: "preporucuje_zaposljavanje", pattern: /\bpreporu(?:čuje|cuje) se zapošljavanje\b/iu },
      { ruleId: "preporucuje_zaposljavanje_ascii", pattern: /\bpreporu(?:čuje|cuje) se zaposljavanje\b/iu },
    ],
  },
  {
    code: "diagnosis_or_medical_claim",
    message: "Participant report must not make a diagnosis, clinical claim, or medical claim.",
    matchers: [
      { ruleId: "diagnosis_term", pattern: /\bdijagnoz\w*/iu },
      { ruleId: "diagnostic_term", pattern: /\bdijagnostic\w*/iu },
      { ruleId: "clinical_term", pattern: /\bklini[čc]k\w*/iu },
      { ruleId: "medical_term", pattern: /\bmedicinsk\w*/iu },
      { ruleId: "mental_health_term", pattern: /\bmentaln(?:o|og|om)? zdravlj\w*/iu },
      { ruleId: "disorder_term", pattern: /\bporeme[ćc]aj\w*/iu },
      {
        ruleId: "specific_condition_assertion",
        pattern: /\b(?:ima|pokazuje|dokazuje) (?:depresiju|anksioznost|adhd|autizam|psihopatiju)\b/iu,
      },
    ],
  },
  {
    code: "discriminatory_claim",
    message: "Participant report must not infer protected traits or discriminatory suitability.",
    matchers: [
      {
        ruleId: "protected_trait_basis",
        pattern: /\b(?:zbog|na osnovu) (?:rase|etni[čc]ke pripadnosti|vjere|religije|spola|pola|invaliditeta|seksualne orijentacije)\b/iu,
      },
      {
        ruleId: "group_comparison",
        pattern: /\b(?:muškarci|muskarci|žene|zene|romi|muslimani|kršćani|krscani|jevreji) (?:su|nisu) (?:bolji|lošiji|losiji|pogodniji|sposobniji)\b/iu,
      },
    ],
  },
  {
    code: "harmful_or_fatalistic_label",
    message: "Participant report must not use harmful or fatalistic labels.",
    matchers: [
      {
        ruleId: "permanent_incapacity_label",
        pattern: /\b(?:ti si|osoba je|kandidat je|kandidatkinja je|si) (?:trajno |nepopravljivo )?(?:nesposoban|nesposobna|beznadežan|beznadezna|bezvrijedan|bezvrijedna)\b/iu,
      },
      { ruleId: "never_change", pattern: /\bnikada se ne(?:će|ce) (?:promijeniti|popraviti|razviti)\b/iu },
      { ruleId: "cannot_improve", pattern: /\bne može se (?:promijeniti|razviti|poboljšati)\b/iu },
      { ruleId: "destined_failure", pattern: /\bpredodređen[ao]? (?:je )?za neuspjeh\b/iu },
    ],
  },
  {
    code: "degrading_tone",
    message: "Participant report must not use degrading language.",
    matchers: [
      {
        ruleId: "insulting_label",
        pattern: /\b(?:glup|glupa|glupo|idiot|idiotski|lijena osoba|lijen kandidat|loša osoba|losa osoba)\b/iu,
      },
      { ruleId: "worthlessness_claim", pattern: /\b(?:nema nikakvu vrijednost|bez ikakve vrijednosti)\b/iu },
    ],
  },
];

function sanitizeMatchedTerm(value: string): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, 48);
}

export function formatParticipantReportSafetyFinding(
  finding: ParticipantReportSafetyFinding,
): string {
  return `${finding.path}: ${finding.message} [rule=${finding.ruleId}; match=${JSON.stringify(finding.matchedTerm)}]`;
}

function visitStrings(
  value: unknown,
  visitor: (text: string, path: string) => void,
  path = "",
  key: string | null = null,
): void {
  if (typeof value === "string") {
    if (!key || !NON_NARRATIVE_KEYS.has(key)) {
      visitor(value, path || "<root>");
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => visitStrings(item, visitor, `${path}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  Object.entries(value).forEach(([childKey, childValue]) => {
    visitStrings(childValue, visitor, path ? `${path}.${childKey}` : childKey, childKey);
  });
}

export function validateParticipantReportSafety(
  value: unknown,
): ParticipantReportSafetyFinding[] {
  const findings: ParticipantReportSafetyFinding[] = [];

  visitStrings(value, (text, path) => {
    RULES.forEach((rule) => {
      if (
        rule.code === "diagnosis_or_medical_claim" &&
        /(?:nije|ne predstavlja|bez) (?:psihološka |psiholoska |medicinska |klinička |klinicka )?dijagnoz/iu.test(
          text,
        )
      ) {
        return;
      }

      for (const matcher of rule.matchers) {
        const match = text.match(matcher.pattern);

        if (!match) {
          continue;
        }

        findings.push({
          path,
          code: rule.code,
          ruleId: matcher.ruleId,
          matchedTerm: sanitizeMatchedTerm(match[0] ?? ""),
          message: rule.message,
        });
        break;
      }
    });
  });

  return findings;
}
