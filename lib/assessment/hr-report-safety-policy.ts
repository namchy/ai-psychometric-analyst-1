export type HrReportSafetyContext =
  "individual_development_profile_hr_report";

export type HrReportSafetyIssueCode =
  | "HIRING_DECISION"
  | "FIT_OR_ELIMINATION_DECISION"
  | "CLINICAL_OR_DIAGNOSTIC_CLAIM"
  | "PROTECTED_TRAIT_INFERENCE"
  | "CATEGORICAL_PREDICTION"
  | "VALUE_JUDGEMENT"
  | "WORK_OUTCOME_PREDICTION";

export type HrReportSafetyIssue = {
  code: HrReportSafetyIssueCode;
  path: string;
  message: string;
};

type HrReportSafetyRule = {
  code: HrReportSafetyIssueCode;
  pattern: RegExp;
  message: string;
};

const IDP_HR_SAFETY_RULES: HrReportSafetyRule[] = [
  {
    code: "HIRING_DECISION",
    pattern:
      /(?:\bhire\b|\bno-hire\b|treba zaposliti|ne zaposliti|preporu(?:čuje|cuje) se zapošljavanje|preporu(?:čuje|cuje) se zaposljavanje|mora se odbiti|mora biti odbijen)/iu,
    message: "HR report must not make a hire, no-hire or rejection decision.",
  },
  {
    code: "FIT_OR_ELIMINATION_DECISION",
    pattern:
      /(?:\bfit score\b|\bmatch score\b|\bbad fit\b|\bpoor fit\b|\bnot suitable\b|nije pogodan|nije pogodna|nije podoban|nije podobna|ne odgovara (?:ulozi|timu|radnom mjestu))/iu,
    message: "HR report must not make a fit or elimination decision.",
  },
  {
    code: "CLINICAL_OR_DIAGNOSTIC_CLAIM",
    pattern:
      /(?:dijagnosticira|dijagnoz|mentaln(?:o|og)? zdravlj|medicinsk|kliničk|klinick|\bclinical\b|\bdisorder\b|poremećaj|poremecaj|patolog)/iu,
    message: "HR report must not make a clinical, diagnostic or pathological claim.",
  },
  {
    code: "PROTECTED_TRAIT_INFERENCE",
    pattern:
      /(?:zbog (?:njegove|njene|njihove|kandidatove|kandidatkinjine)?\s*(?:dobi|starosti|spola|pola|rase|etničke pripadnosti|etnicke pripadnosti|vjere|vere|invaliditeta|trudnoće|trudnoce|seksualne orijentacije|bračnog statusa|bracnog statusa)|zaključ(?:uje|iti)|zakljuc(?:uje|iti)|infer(?:red|s)?)\s+(?:da\s+)?(?:je\s+)?(?:star|mlad|muškarac|muskarac|žena|zena|određene rase|odredjene rase|određene vjere|odredjene vjere|invalid|trudna|homoseksualan|heteroseksualan|oženjen|ozenjen|udata)/iu,
    message: "HR report must not infer a protected trait.",
  },
  {
    code: "CATEGORICAL_PREDICTION",
    pattern:
      /(?:sigurno (?:će|ce)|sigurno pokazuje|garantuje|dokazuje da|(?<![\p{L}])(?:će|ce) uvijek|uvijek (?:će|ce)|neće nikada|nece nikada|nikada neće|nikada nece)/iu,
    message: "HR report must not make a categorical or guaranteed prediction.",
  },
  {
    code: "VALUE_JUDGEMENT",
    pattern:
      /(?:problematič(?:an|na|no)|problematic(?:an|na|no)|nesposob(?:an|na|no)|(?:osoba|kandidat|kandidatkinja|on|ona)\s+je\s+slab(?:a)?\b|\bslab(?:a)? kandidat(?:kinja)?\b|\bne može\b|\bne moze\b)/iu,
    message: "HR report must not make a demeaning or absolute judgement about capability.",
  },
  {
    code: "WORK_OUTCOME_PREDICTION",
    pattern:
      /(?:\bwill perform\b|\bwill succeed\b|\bwill fail\b|(?:će|ce|neće|nece)\s+(?:uspjeti|uspeti|uspijevati|uspevati|propasti|podbaciti)|(?:neuspjeh|neuspeh) je (?:siguran|izvjestan|izvestan)|uspjeh je (?:siguran|garantovan))/iu,
    message: "HR report must not directly predict work success or failure.",
  },
];

const RULES_BY_CONTEXT: Record<HrReportSafetyContext, HrReportSafetyRule[]> = {
  individual_development_profile_hr_report: IDP_HR_SAFETY_RULES,
};

export function validateHrReportSafety(
  text: string,
  options: {
    context: HrReportSafetyContext;
    path: string;
  },
): HrReportSafetyIssue[] {
  return RULES_BY_CONTEXT[options.context].flatMap((rule) =>
    rule.pattern.test(text)
      ? [
          {
            code: rule.code,
            path: options.path,
            message: rule.message,
          },
        ]
      : [],
  );
}
