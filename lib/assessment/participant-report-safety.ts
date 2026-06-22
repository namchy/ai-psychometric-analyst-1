export type ParticipantReportSafetyFinding = {
  path: string;
  code:
    | "hire_decision"
    | "diagnosis_or_medical_claim"
    | "discriminatory_claim"
    | "harmful_or_fatalistic_label"
    | "degrading_tone";
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
  patterns: RegExp[];
}> = [
  {
    code: "hire_decision",
    message: "Participant report must not make a hire/no-hire decision.",
    patterns: [
      /\bno-hire\b/iu,
      /\bhire\b/iu,
      /\btreba (?:ga|je|ih|ovu osobu )?zaposliti\b/iu,
      /\bne (?:treba )?(?:ga|je|ih|ovu osobu )?zaposliti\b/iu,
      /\bpreporu(?:čuje|cuje) se zapošljavanje\b/iu,
      /\bpreporu(?:čuje|cuje) se zaposljavanje\b/iu,
    ],
  },
  {
    code: "diagnosis_or_medical_claim",
    message: "Participant report must not make a diagnosis, clinical claim, or medical claim.",
    patterns: [
      /\bdijagnoz\w*/iu,
      /\bdijagnostic\w*/iu,
      /\bklini[čc]k\w*/iu,
      /\bmedicinsk\w*/iu,
      /\bmentaln(?:o|og|om)? zdravlj\w*/iu,
      /\bporeme[ćc]aj\w*/iu,
      /\b(?:ima|pokazuje|dokazuje) (?:depresiju|anksioznost|adhd|autizam|psihopatiju)\b/iu,
    ],
  },
  {
    code: "discriminatory_claim",
    message: "Participant report must not infer protected traits or discriminatory suitability.",
    patterns: [
      /\b(?:zbog|na osnovu) (?:rase|etni[čc]ke pripadnosti|vjere|religije|spola|pola|invaliditeta|seksualne orijentacije)\b/iu,
      /\b(?:muškarci|muskarci|žene|zene|romi|muslimani|kršćani|krscani|jevreji) (?:su|nisu) (?:bolji|lošiji|losiji|pogodniji|sposobniji)\b/iu,
    ],
  },
  {
    code: "harmful_or_fatalistic_label",
    message: "Participant report must not use harmful or fatalistic labels.",
    patterns: [
      /\b(?:ti si|osoba je|kandidat je|kandidatkinja je|si) (?:trajno |nepopravljivo )?(?:nesposoban|nesposobna|beznadežan|beznadezna|bezvrijedan|bezvrijedna)\b/iu,
      /\bnikada se ne(?:će|ce) (?:promijeniti|popraviti|razviti)\b/iu,
      /\bne može se (?:promijeniti|razviti|poboljšati)\b/iu,
      /\bpredodređen[ao]? (?:je )?za neuspjeh\b/iu,
    ],
  },
  {
    code: "degrading_tone",
    message: "Participant report must not use degrading language.",
    patterns: [
      /\b(?:glup|glupa|glupo|idiot|idiotski|lijena osoba|lijen kandidat|loša osoba|losa osoba)\b/iu,
      /\b(?:nema nikakvu vrijednost|bez ikakve vrijednosti)\b/iu,
    ],
  },
];

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

      if (rule.patterns.some((pattern) => pattern.test(text))) {
        findings.push({ path, code: rule.code, message: rule.message });
      }
    });
  });

  return findings;
}
