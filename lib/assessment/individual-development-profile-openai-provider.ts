import "server-only";

import { resolveAiReportLanguagePolicy } from "@/lib/assessment/ai-report-language-policy";
import {
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
  validateIndividualDevelopmentProfileSnapshot,
  type IndividualDevelopmentProfileSnapshot,
} from "@/lib/assessment/individual-development-profile-contract";
import {
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
  type IndividualDevelopmentProfileInputSnapshot,
} from "@/lib/assessment/individual-development-profile-input";

export const INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI = "openai" as const;
export const INDIVIDUAL_DEVELOPMENT_PROFILE_OPENAI_GENERATOR_VERSION =
  "individual_development_profile_openai_v1" as const;

export type IndividualDevelopmentProfileOpenAiRequest = {
  model: string;
  temperature?: number;
  response_format: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: true;
      schema: Record<string, unknown>;
    };
  };
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
};

export type IndividualDevelopmentProfileOpenAiClient = {
  createChatCompletion: (
    request: IndividualDevelopmentProfileOpenAiRequest,
  ) => Promise<{ content: string }>;
};

export type IndividualDevelopmentProfileOpenAiProviderOptions = {
  apiKey: string | null;
  model: string | null;
  timeoutMs?: number;
  temperature?: number | null;
  fetchImpl?: typeof fetch;
  client?: IndividualDevelopmentProfileOpenAiClient;
  now?: () => string;
};

export type IndividualDevelopmentProfileOpenAiProviderResult =
  | {
      ok: true;
      reportSnapshot: IndividualDevelopmentProfileSnapshot;
      modelName: string;
    }
  | {
      ok: false;
      reason:
        | "invalid_input"
        | "config_error"
        | "provider_error"
        | "parse_failure"
        | "validation_failed";
      errors: string[];
      modelName: string | null;
    };

const MAX_VALIDATION_DIAGNOSTICS = 5;
const MAX_DIAGNOSTIC_VALUE_LENGTH = 500;

const nonEmptyStringSchema = {
  type: "string",
  minLength: 1,
} as const;

const narrativeArraySchema = {
  type: "array",
  minItems: 1,
  items: nonEmptyStringSchema,
} as const;

const onboardingStageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["focus", "managerActions", "feedbackGuidance", "riskSignals"],
  properties: {
    focus: {
      ...nonEmptyStringSchema,
      description:
        "The stage-specific onboarding focus: clarity, trust, expectations, ownership, collaboration, autonomy or consolidation.",
    },
    managerActions: {
      ...narrativeArraySchema,
      description:
        "Concrete manager actions appropriate to this onboarding stage.",
    },
    feedbackGuidance: {
      ...narrativeArraySchema,
      description:
        "Stage-specific guidance for feedback cadence, framing and next steps.",
    },
    riskSignals: {
      ...narrativeArraySchema,
      description:
        "Observable early workplace patterns that may require an onboarding adjustment.",
    },
  },
} as const;

export const individualDevelopmentProfileOpenAiSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "reportType",
    "reportVersion",
    "locale",
    "audience",
    "developmentSummary",
    "contributionPattern",
    "developmentRisks",
    "communicationAndFeedbackGuidance",
    "motivationAndEnergyGuidance",
    "oneOnOneGuidance",
    "onboardingPlan",
    "managerWatchpoints",
    "interpretationLimits",
    "metadata",
  ],
  properties: {
    reportType: {
      type: "string",
      const: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
    },
    reportVersion: {
      type: "string",
      const: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
    },
    locale: { type: "string", const: "bs" },
    audience: {
      type: "string",
      const: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
    },
    developmentSummary: {
      type: "object",
      additionalProperties: false,
      required: [
        "headline",
        "overallPattern",
        "strongestContributionSignals",
        "mainSupportNeed",
        "usageNote",
      ],
      properties: {
        headline: {
          ...nonEmptyStringSchema,
          description:
            "One clear HR-development angle on likely contribution and the primary management need; do not list domains, scores, bands or tests.",
        },
        overallPattern: {
          ...nonEmptyStringSchema,
          description:
            "A workplace-oriented synthesis of the main work pattern and its managerial implication.",
        },
        strongestContributionSignals: {
          ...narrativeArraySchema,
          description:
            "Practical contribution patterns connecting evidence to work, responsibility, team conditions or contribution channels.",
        },
        mainSupportNeed: {
          ...nonEmptyStringSchema,
          description:
            "The most important early support condition in practical manager language, without therapeutic framing.",
        },
        usageNote: {
          ...nonEmptyStringSchema,
          description:
            "A short, calm and secondary reminder that the report is a development hypothesis; it must not dominate or weaken the summary.",
        },
      },
    },
    contributionPattern: {
      type: "object",
      additionalProperties: false,
      required: [
        "bestConditions",
        "collaborationConditions",
        "supportPreferences",
        "roleShapingImplications",
      ],
      properties: {
        bestConditions: {
          ...narrativeArraySchema,
          description:
            "Work conditions under which the person is likely to contribute well.",
        },
        collaborationConditions: {
          ...narrativeArraySchema,
          description:
            "Practical collaboration structure covering rhythm, preparation, channels, decision ownership and role clarity.",
        },
        supportPreferences: {
          ...narrativeArraySchema,
          description:
            "Manager behaviors that can support performance without sounding clinical or paternalistic.",
        },
        roleShapingImplications: {
          ...narrativeArraySchema,
          description:
            "Early task design, responsibility level, quality standards and practical role setup.",
        },
      },
    },
    developmentRisks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "possibleBlocker",
          "whyItMatters",
          "whatToCheck",
          "howToSupport",
        ],
        properties: {
          possibleBlocker: {
            ...nonEmptyStringSchema,
            description:
              "A concrete, observable work blocker rather than a personality flaw.",
          },
          whyItMatters: {
            ...nonEmptyStringSchema,
            description:
              "The business, quality, speed or collaboration impact of the blocker.",
          },
          whatToCheck: {
            ...nonEmptyStringSchema,
            description:
              "What HR or the manager should observe or ask about in the work context.",
          },
          howToSupport: {
            ...nonEmptyStringSchema,
            description:
              "A concrete HR or manager support action addressing the blocker.",
          },
        },
      },
    },
    communicationAndFeedbackGuidance: {
      type: "object",
      additionalProperties: false,
      required: ["whatHelps", "whatToAvoid", "howToPhraseFeedback", "whatToClarify"],
      properties: {
        whatHelps: {
          ...narrativeArraySchema,
          description:
            "Practical communication conditions that support clarity and contribution.",
        },
        whatToAvoid: {
          ...narrativeArraySchema,
          description:
            "Avoidable manager behaviors or team conditions, stated without blaming the person.",
        },
        howToPhraseFeedback: {
          ...narrativeArraySchema,
          description:
            "Feedback framing that is specific, behavior-based and linked to expectations and next steps.",
        },
        whatToClarify: {
          ...narrativeArraySchema,
          description:
            "Role, communication, quality or decision expectations that should be explicit early.",
        },
      },
    },
    motivationAndEnergyGuidance: {
      type: "object",
      additionalProperties: false,
      required: [
        "likelySourcesOfEnergy",
        "likelySourcesOfDrain",
        "supportSignals",
        "whatToValidate",
      ],
      properties: {
        likelySourcesOfEnergy: {
          ...narrativeArraySchema,
          description:
            "Work conditions, task qualities or responsibility patterns likely to support engagement.",
        },
        likelySourcesOfDrain: {
          ...narrativeArraySchema,
          description:
            "Work conditions that may reduce energy or create unnecessary pressure.",
        },
        supportSignals: {
          ...narrativeArraySchema,
          description:
            "Observable workplace signs that the current setup is supporting engagement.",
        },
        whatToValidate: {
          ...narrativeArraySchema,
          description:
            "Practical motivation and energy topics for HR or manager check-ins.",
        },
      },
    },
    oneOnOneGuidance: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "question",
          "whatToListenFor",
          "signalBeingChecked",
          "possibleFollowUp",
        ],
        properties: {
          question: nonEmptyStringSchema,
          whatToListenFor: nonEmptyStringSchema,
          signalBeingChecked: nonEmptyStringSchema,
          possibleFollowUp: {
            ...nonEmptyStringSchema,
            description:
              'Must be an open HR/manager question suitable for a one-on-one conversation and must end with "?". It must not be a statement, advice, imperative, title or conversation topic. Good examples: "Koji uslovi rada vam najviše pomažu da održite fokus kada zadatak traži preciznost?" and "Kako prepoznajete da vam je povratna informacija dovoljno jasna za sljedeći korak?"',
          },
        },
      },
    },
    onboardingPlan: {
      type: "object",
      additionalProperties: false,
      required: [
        "summary",
        "first7Days",
        "first30Days",
        "days31To60",
        "days61To90",
        "managerCheckpoints",
        "watchouts",
      ],
      properties: {
        summary: {
          ...nonEmptyStringSchema,
          description:
            "The main person-specific onboarding logic; concrete and manager-actionable, not a generic template.",
        },
        first7Days: {
          ...onboardingStageSchema,
          description:
            "Orientation, clarity, workplace trust, initial expectations and communication rhythm.",
        },
        first30Days: {
          ...onboardingStageSchema,
          description:
            "Early task ownership, quality standards, feedback cadence and first examples of contribution.",
        },
        days31To60: {
          ...onboardingStageSchema,
          description:
            "Increasing responsibility, collaboration patterns and calibration of autonomy.",
        },
        days61To90: {
          ...onboardingStageSchema,
          description:
            "Consolidation, development priorities, role fit evidence and the next-step growth plan.",
        },
        managerCheckpoints: {
          ...narrativeArraySchema,
          description:
            "Concrete moments to check clarity, workload, feedback usefulness, collaboration and contribution.",
        },
        watchouts: {
          ...narrativeArraySchema,
          description:
            "Observable early onboarding patterns that may require adjustment.",
        },
      },
    },
    managerWatchpoints: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "watchpoint",
          "whyItMatters",
          "earlySignal",
          "suggestedManagerResponse",
        ],
        properties: {
          watchpoint: {
            ...nonEmptyStringSchema,
            description:
              "An observable early workplace pattern for the manager to watch.",
          },
          whyItMatters: {
            ...nonEmptyStringSchema,
            description:
              "Why the pattern affects contribution, collaboration, quality, speed or onboarding.",
          },
          earlySignal: {
            ...nonEmptyStringSchema,
            description:
              "What the manager may actually observe in work behavior or delivery.",
          },
          suggestedManagerResponse: {
            ...nonEmptyStringSchema,
            description:
              "A concrete manager action without diagnosing or interpreting the person's inner state.",
          },
        },
      },
    },
    interpretationLimits: {
      ...narrativeArraySchema,
      description:
        "Clear, short and non-dominant responsible-use limits without legalistic or defensive language.",
    },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["generatedAt", "generatorType", "generatorVersion", "inputVersion"],
      properties: {
        generatedAt: nonEmptyStringSchema,
        generatorType: {
          type: "string",
          const: INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI,
        },
        generatorVersion: {
          type: "string",
          const: INDIVIDUAL_DEVELOPMENT_PROFILE_OPENAI_GENERATOR_VERSION,
        },
        inputVersion: {
          type: "string",
          const: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
        },
      },
    },
  },
} as const satisfies Record<string, unknown>;

function isValidInputSnapshot(
  input: IndividualDevelopmentProfileInputSnapshot,
): boolean {
  return (
    input.inputType === INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE &&
    input.inputVersion === INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION &&
    input.locale === "bs" &&
    typeof input.participant?.participantId === "string" &&
    input.participant.participantId.length > 0
  );
}

function readValueAtValidationPath(value: unknown, path: string): unknown {
  const segments = path.match(/[^.[\]]+/g);

  if (!segments) {
    return undefined;
  }

  return segments.reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (current !== null && typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, value);
}

function truncateDiagnosticValue(value: unknown): string {
  let serialized: string;

  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = String(value);
  }

  if (serialized === undefined) {
    serialized = "undefined";
  }

  return serialized.length > MAX_DIAGNOSTIC_VALUE_LENGTH
    ? `${serialized.slice(0, MAX_DIAGNOSTIC_VALUE_LENGTH - 3)}...`
    : serialized;
}

function buildDevelopmentValidationDiagnostics(
  errors: string[],
  parsed: unknown,
): string[] {
  return errors.slice(0, MAX_VALIDATION_DIAGNOSTICS).map((error) => {
    const separatorIndex = error.indexOf(":");
    const path =
      separatorIndex >= 0 ? error.slice(0, separatorIndex).trim() : error.trim();
    const message =
      separatorIndex >= 0 ? error.slice(separatorIndex + 1).trim() : error.trim();
    const offendingValue = truncateDiagnosticValue(
      readValueAtValidationPath(parsed, path),
    );

    return `${path}: ${message} Offending value: ${offendingValue}`;
  });
}

export function buildIndividualDevelopmentProfileAuthoringStandard(): string {
  return [
    "IDP-specific authoring standard",
    "",
    "The Individual Development Profile is an HR-development advisory document.",
    "",
    "Its purpose is to help HR and the responsible manager translate assessment evidence into practical decisions about onboarding, feedback, role shaping, collaboration, development support and early management attention.",
    "",
    "This report must not read like a score summary, a personality essay, a clinical note, a therapy plan, a hiring recommendation, a legal disclaimer or a generic onboarding template.",
    "",
    "Write as a senior HR development advisor: calm, practical, specific and workplace-oriented. The report should help a manager understand what to do differently in the first weeks of work, not merely what the tests measured.",
    "",
    "The writing should be decisive in managerial usefulness, but careful in psychological certainty.",
    "",
    "Core transformation rule:",
    "",
    "assessment evidence → work pattern → managerial implication → concrete action",
    "",
    "Assessment findings are evidence, not the final narrative structure. Do not copy the wording, order, caution pattern or sentence rhythm of the input snapshot. If the input contains score-summary, hedging or technical deterministic phrases, treat them as internal evidence and translate them into natural HR-development language.",
    "",
    "Do not imitate or repeat phrases such as:",
    '- "najizraženiji signali"',
    '- "vrijedi provjeriti"',
    '- "povišen signal"',
    '- "niži relativni signal"',
    '- "ovaj signal može pomagati"',
    '- "signal sugeriše"',
    '- "upućuje na potencijal"',
    '- "deterministic"',
    '- "reduced"',
    '- "driveri"',
    '- "numeric"',
    '- "source"',
    '- "snapshot"',
    "",
    "The upper part of the report must provide immediate HR value. The headline and overall summary must not list domains, scores, bands or tests. They must present a clear development angle: how this person is likely to contribute, what kind of work structure helps them perform well, and what the manager should pay attention to early.",
    "",
    "Use psychological and assessment language sparingly. Prefer workplace language: task clarity, quality standards, collaboration rhythm, feedback format, meeting preparation, decision ownership, workload calibration, check-in cadence, role expectations, contribution channels and observable early patterns.",
    "",
    "Use caution without becoming vague. It is acceptable to frame findings as development hypotheses, but every important hypothesis must lead to a practical HR or manager action.",
    "Use cautious framing, but do not rely on “može” as the default hedge in every sentence.",
    "Prefer concrete advisory phrasing such as “najviše dolazi do izražaja kada…”, “u praksi to znači…”, “korisno je…”, “menadžer treba…”, “dobro je…” and “preporučljivo je…”.",
    "Avoid personality labels when describing risks or watchpoints. Do not write labels such as “perfekcionističko usporavanje”. Prefer observable work-language, for example: “usporavanje prve verzije zbog dodatne provjere kvaliteta”.",
    "When describing meeting contribution, do not use “spontana rasprava” or similar phrasing as the main contrast. Prefer concrete wording such as “brzo uključivanje u grupnu diskusiju”, “doprinos bez prethodno dodijeljene teme”, or “vidljivost u sastanku bez jasne uloge”.",
    "",
    "Avoid therapeutic, clinical or awkward formulations. Do not write phrases such as:",
    '- "postepena izloženost grupnim situacijama"',
    '- "spontana verbalna prisutnost"',
    '- "normalizovati pritisak"',
    '- "raditi na emocionalnoj regulaciji"',
    '- "tretirati otpor"',
    '- "ublažavati simptome"',
    '- "psihološka intervencija"',
    "",
    "Prefer concrete HR and managerial formulations, for example:",
    '- "postepeno uključivati u veće sastanke uz jasnu ulogu i pripremu"',
    '- "unaprijed dogovoriti temu i očekivani doprinos"',
    '- "omogućiti pisani kanal za složenije doprinose"',
    '- "dogovoriti kriterij ‘dovoljno dobro za ovu fazu’"',
    '- "provjeriti kroz konkretan radni primjer"',
    '- "dati jasnu ulogu u saradnji"',
    '- "pratiti opterećenje kroz kratke check-in razgovore"',
    '- "povezati zadatak sa jasnim standardom kvaliteta i realnim rokom"',
    '- "razdvojiti očekivanja za brzinu, kvalitet i samostalnost"',
    '- "dogovoriti kada je potrebna konsultacija, a kada samostalna odluka"',
    "",
    "Interpretation limits must be present, but they must not dominate the development summary. The usage note should be short, calm and secondary to the advisory value of the report.",
    "",
    "Every section must earn its place. Do not repeat the same finding across sections unless each occurrence adds a new practical use: a work condition, a risk check, a feedback move, a motivation check, a one-on-one question, an onboarding action or a manager watchpoint.",
  ].join("\n");
}

export function buildIndividualDevelopmentProfileSegmentGuidance() {
  return {
    standard: "IDP segment-level writing standard",
    developmentSummary: {
      purpose:
        "The development summary is the executive HR entry point. It must give immediate practical value. It should not summarize scores, list assessment domains or start with cautious test language.",
      headline:
        "Write one clear HR-development angle. The headline should help HR understand the person’s likely contribution and primary management need. Do not list domains, scores, bands or tests.",
      overallPattern:
        "Synthesize the main work pattern and its managerial implication. Use assessment evidence silently as grounding, but write the paragraph as workplace guidance. The reader should understand what kind of structure, responsibility, collaboration rhythm or support will help this person contribute well.",
      strongestContributionSignals:
        "Each item must connect evidence to a practical contribution. Do not write “X suggests potential”. Write what kind of work, responsibility, team condition or contribution channel may fit the person.",
      mainSupportNeed:
        "Name the most important early support condition in practical manager language. Focus on clarity, feedback, workload, role expectations, communication rhythm or decision ownership. Do not use therapeutic language.",
      usageNote:
        "Keep this short and secondary. It should remind HR that the report is a development hypothesis, but it must not weaken or dominate the summary.",
    },
    contributionPattern: {
      purpose:
        "This section explains how to shape work conditions and role expectations. It must not merely describe traits.",
      bestConditions:
        "Describe the work conditions under which the person is likely to contribute well.",
      collaborationConditions:
        "Describe how collaboration should be structured: meeting rhythm, preparation, written/verbal channels, decision ownership and clarity of roles.",
      supportPreferences:
        "Describe manager behaviors that can help performance without sounding clinical or paternalistic.",
      roleShapingImplications:
        "Translate the profile into early task design, responsibility level, quality standards and practical role setup.",
    },
    developmentRisks: {
      purpose:
        "Each risk must be business-relevant and observable. Avoid psychological labels and clinical explanations.",
      possibleBlocker:
        "Name a concrete work blocker, not a personality flaw.",
      whyItMatters:
        "Explain the business or collaboration impact.",
      whatToCheck:
        "Describe what HR or the manager should observe or ask about.",
      howToSupport:
        "Give a concrete support action.",
    },
    communicationAndFeedbackGuidance: {
      purpose:
        "This section should help the manager communicate clearly and respectfully.",
      whatHelps:
        "Describe practical communication conditions that support clarity and contribution.",
      whatToAvoid:
        "Name avoidable manager behaviors or team conditions, without blaming the person.",
      howToPhraseFeedback:
        "Give guidance on how feedback should be framed: specific, behavior-based, linked to expectations and next steps.",
      whatToClarify:
        "Name expectations that should be made explicit early.",
    },
    motivationAndEnergyGuidance: {
      purpose:
        "This section translates motivation evidence into engagement conditions. Do not psychologize motives.",
      likelySourcesOfEnergy:
        "Describe work conditions, task qualities or responsibility patterns likely to support engagement.",
      likelySourcesOfDrain:
        "Describe conditions that may reduce energy or create unnecessary pressure.",
      supportSignals:
        "Name observable signs that the current setup is working.",
      whatToValidate:
        "Suggest practical check-in topics for HR or the manager.",
    },
    oneOnOneGuidance: {
      purpose:
        "Questions must be usable in a real HR or manager one-on-one conversation.",
      question:
        "Ask an open, practical question connected to work conditions, feedback, motivation, collaboration or onboarding.",
      whatToListenFor:
        "Explain what kind of answer would help HR or the manager adjust support.",
      signalBeingChecked:
        "Name the work-related hypothesis being checked, not a raw test result.",
      possibleFollowUp:
        "Must be an open follow-up question and must end with a question mark.",
    },
    onboardingPlan: {
      purpose:
        "The onboarding plan must be concrete, staged and manager-actionable. It must not be a generic onboarding template.",
      summary:
        "Describe the main onboarding logic for this person.",
      first7Days:
        "Focus on orientation, clarity, workplace trust, initial expectations and communication rhythm.",
      first30Days:
        "Focus on early task ownership, quality standards, feedback cadence and first examples of contribution.",
      days31To60:
        "Focus on increasing responsibility, collaboration patterns and calibration of autonomy.",
      days61To90:
        "Focus on consolidation, development priorities, role fit evidence and next-step growth plan.",
      managerCheckpoints:
        "List concrete moments where the manager should check clarity, workload, feedback usefulness, collaboration and contribution.",
      watchouts:
        "Name observable early patterns that may require adjustment.",
    },
    managerWatchpoints: {
      purpose:
        "Manager watchpoints must describe observable workplace patterns and practical responses.",
      watchpoint:
        "Name the early pattern to watch.",
      whyItMatters:
        "Explain why it affects contribution, collaboration, quality, speed or onboarding.",
      earlySignal:
        "Describe what the manager may actually observe.",
      suggestedManagerResponse:
        "Give a concrete manager action. Do not diagnose or interpret the person’s inner state.",
    },
    interpretationLimits: {
      purpose:
        "Limits should be clear, short and non-dominant. They should protect responsible use without making the report feel unusable. Avoid legalistic or defensive language.",
    },
  } as const;
}

export function buildIndividualDevelopmentProfileOpenAiSystemPrompt(): string {
  const languagePolicy = resolveAiReportLanguagePolicy("bs");
  const globalPolicy =
    languagePolicy?.buildPromptPolicyBlock({
      audience: "hr",
      includeAuthorityOrder: true,
    }) ?? "";

  return [
    "Generate exactly one Individual Development Profile HR report.",
    "Return JSON only and match the supplied strict JSON schema exactly.",
    "Use only the supplied canonical IDP input. Do not query or infer hidden data.",
    globalPolicy,
    buildIndividualDevelopmentProfileAuthoringStandard(),
    "Write in Bosnian, ijekavica, Latin script, with a professional, calm and practical HR tone.",
    "Use cautious developmental hypotheses, not diagnoses, verdicts or hiring recommendations.",
    'For AGREEABLENESS use the canonical term "Spremnost na saradnju"; never use "ugodnost".',
    'Never place these terms in user-facing text: "HR-facing", "reduced", "AI narativ", "numeric", "source", "metadata", "snapshot".',
    'Do not address the candidate with candidate-facing forms such as "ti" or "tvoj".',
    'Do not copy raw/internal source metadata, technical keys, versions, identifiers or implementation language into narrative fields.',
    'Do not rely on the word "signal" as a repeated sentence template. Vary professional HR wording with "nalaz", "razvojni obrazac", "radna hipoteza", "područje za provjeru", "preporuka", "pitanje za razgovor" and "onboarding fokus" where natural.',
    "Every section must serve its own purpose. Do not paste or lightly paraphrase the same upstream fragment across multiple sections.",
    "Development summary synthesizes the main pattern; contribution pattern explains work conditions; risks identify blockers and checks; communication and motivation sections give practical guidance; one-on-one items are questions; onboarding stages are time-specific; manager watchpoints describe observable early patterns and responses.",
    'Every oneOnOneGuidance[].possibleFollowUp value must be an open HR/manager question suitable for a one-on-one conversation and must end with "?".',
    "A possibleFollowUp must not be a statement, advice, imperative, title or conversation topic.",
    'Good possibleFollowUp examples: "Koji uslovi rada vam najviše pomažu da održite fokus kada zadatak traži preciznost?" and "Kako prepoznajete da vam je povratna informacija dovoljno jasna za sljedeći korak?"',
    "Use available source summaries and relevant/integrated findings as evidence, but translate them into natural HR language.",
    "When input is partial, unavailable or conflicting, lower certainty and state the limitation without exposing internal status or technical metadata.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildIndividualDevelopmentProfileOpenAiUserPrompt(
  inputSnapshot: IndividualDevelopmentProfileInputSnapshot,
): string {
  return JSON.stringify({
    task: "Generate one individual_development_profile_v1 HR report.",
    contentContract: {
      locale: "Bosnian, ijekavica, Latin script",
      audience: "HR and the responsible manager",
      grounding:
        "Use only user-relevant findings in the canonical IDP input and never expose raw/internal source metadata.",
      sectionDistinctness:
        "Each report section must add a distinct HR use: synthesis, work conditions, risk checks, communication, motivation, one-on-one conversation, onboarding or manager observation.",
      terminology:
        'Use "Spremnost na saradnju". Never use "ugodnost", "HR-facing", "reduced", "AI narativ", "numeric", "source", "metadata" or "snapshot" in user-facing text.',
      addressing:
        'Do not use candidate-facing second person such as "ti" or "tvoj".',
      wording:
        'Vary wording naturally and do not repeatedly formulate conclusions as "signal sugeriše".',
      oneOnOneGuidance:
        'Every possibleFollowUp must be an open HR/manager question for a one-on-one conversation, must end with "?", and must not be a statement, advice, imperative, title or conversation topic.',
      creationStandard: {
        segmentGuidance: buildIndividualDevelopmentProfileSegmentGuidance(),
      },
    },
    input: inputSnapshot,
  });
}

export function buildIndividualDevelopmentProfileOpenAiRequest(input: {
  inputSnapshot: IndividualDevelopmentProfileInputSnapshot;
  model: string;
  temperature?: number | null;
}): IndividualDevelopmentProfileOpenAiRequest {
  const request: IndividualDevelopmentProfileOpenAiRequest = {
    model: input.model,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
        strict: true,
        schema: individualDevelopmentProfileOpenAiSchema,
      },
    },
    messages: [
      {
        role: "system",
        content: buildIndividualDevelopmentProfileOpenAiSystemPrompt(),
      },
      {
        role: "user",
        content: buildIndividualDevelopmentProfileOpenAiUserPrompt(input.inputSnapshot),
      },
    ],
  };

  if (typeof input.temperature === "number") {
    request.temperature = input.temperature;
  }

  return request;
}

function createFetchClient(
  options: IndividualDevelopmentProfileOpenAiProviderOptions & {
    apiKey: string;
    model: string;
  },
): IndividualDevelopmentProfileOpenAiClient {
  return {
    async createChatCompletion(request) {
      const timeoutMs = options.timeoutMs ?? 120000;
      const controller = new AbortController();
      const timeout = setTimeout(
        () =>
          controller.abort(
            new Error(`OpenAI IDP request timed out after ${timeoutMs}ms.`),
          ),
        timeoutMs,
      );

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
          throw new Error(
            `OpenAI IDP request failed with status ${response.status}: ${await response.text()}`,
          );
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = payload.choices?.[0]?.message?.content;

        if (typeof content !== "string" || content.trim().length === 0) {
          throw new Error("OpenAI IDP response did not contain structured content.");
        }

        return { content };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export async function generateIndividualDevelopmentProfileWithOpenAi(
  inputSnapshot: IndividualDevelopmentProfileInputSnapshot,
  options: IndividualDevelopmentProfileOpenAiProviderOptions,
): Promise<IndividualDevelopmentProfileOpenAiProviderResult> {
  if (!isValidInputSnapshot(inputSnapshot)) {
    return {
      ok: false,
      reason: "invalid_input",
      errors: ["Expected canonical Bosnian individual development profile input v1."],
      modelName: options.model,
    };
  }

  if (!options.apiKey || !options.model) {
    return {
      ok: false,
      reason: "config_error",
      errors: [
        !options.apiKey
          ? "Missing required env var: OPENAI_API_KEY"
          : "Missing required env var: AI_REPORT_MODEL",
      ],
      modelName: options.model,
    };
  }

  const generatedAt = options.now?.() ?? new Date().toISOString();
  const client =
    options.client ??
    createFetchClient({
      ...options,
      apiKey: options.apiKey,
      model: options.model,
    });

  let rawContent: string;

  try {
    const request = buildIndividualDevelopmentProfileOpenAiRequest({
      inputSnapshot,
      model: options.model,
      temperature: options.temperature,
    });

    const response = await client.createChatCompletion(request);
    rawContent = response.content;
  } catch (error) {
    return {
      ok: false,
      reason: "provider_error",
      errors: [error instanceof Error ? error.message : String(error)],
      modelName: options.model,
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    return {
      ok: false,
      reason: "parse_failure",
      errors: [
        `OpenAI IDP returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
      modelName: options.model,
    };
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    parsed = {
      ...parsed,
      metadata: {
        generatedAt,
        generatorType: INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI,
        generatorVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_OPENAI_GENERATOR_VERSION,
        inputVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
      },
    };
  }

  const validation = validateIndividualDevelopmentProfileSnapshot(parsed);

  if (!validation.ok) {
    const errors =
      process.env.NODE_ENV === "development"
        ? buildDevelopmentValidationDiagnostics(validation.errors, parsed)
        : validation.errors;

    if (process.env.NODE_ENV === "development") {
      console.error(
        [
          "[IDP OpenAI validation diagnostic]",
          ...errors.map((error, index) => `${index + 1}. ${error}`),
        ].join("\n"),
      );
    }

    return {
      ok: false,
      reason: "validation_failed",
      errors,
      modelName: options.model,
    };
  }

  return {
    ok: true,
    reportSnapshot: validation.value,
    modelName: options.model,
  };
}
