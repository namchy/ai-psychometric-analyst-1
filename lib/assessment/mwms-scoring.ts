export const MWMS_V1_TEST_SLUG = "mwms_v1" as const;

export const MWMS_DIMENSION_ITEM_CODES = {
  amotivation: ["MWMS_01", "MWMS_02", "MWMS_03"],
  external_social: ["MWMS_04", "MWMS_05", "MWMS_06"],
  external_material: ["MWMS_07", "MWMS_08", "MWMS_09"],
  introjected: ["MWMS_10", "MWMS_11", "MWMS_12", "MWMS_13"],
  identified: ["MWMS_14", "MWMS_15", "MWMS_16"],
  intrinsic: ["MWMS_17", "MWMS_18", "MWMS_19"],
} as const;

export const MWMS_COMPOSITE_DIMENSIONS = {
  autonomous_motivation: ["identified", "intrinsic"],
  controlled_motivation: ["introjected", "external_social", "external_material"],
} as const;

export type MwmsDimensionCode = keyof typeof MWMS_DIMENSION_ITEM_CODES;
export type MwmsCompositeCode = keyof typeof MWMS_COMPOSITE_DIMENSIONS;
export type MwmsItemCode =
  (typeof MWMS_DIMENSION_ITEM_CODES)[keyof typeof MWMS_DIMENSION_ITEM_CODES][number];

export type MwmsDimensionScore = {
  score: number;
  answeredItems: number;
  requiredItems: number;
};

export type MwmsCompositeScore = {
  score: number;
  sourceDimensions: MwmsDimensionCode[];
};

export type MwmsScoringErrorCode =
  | "unknown_item"
  | "missing_required_item"
  | "invalid_value";

export type MwmsScoringInvalidResult = {
  testSlug: typeof MWMS_V1_TEST_SLUG;
  isComplete: false;
  error: {
    code: MwmsScoringErrorCode;
    message: string;
    details: string[];
  };
};

export type MwmsScoringCompleteResult = {
  testSlug: typeof MWMS_V1_TEST_SLUG;
  isComplete: true;
  dimensions: Record<MwmsDimensionCode, MwmsDimensionScore>;
  composites: Record<MwmsCompositeCode, MwmsCompositeScore>;
};

export type MwmsScoringResult = MwmsScoringCompleteResult | MwmsScoringInvalidResult;

export const MWMS_DIMENSION_CODES = Object.keys(
  MWMS_DIMENSION_ITEM_CODES,
) as MwmsDimensionCode[];

export const MWMS_ITEM_CODES = MWMS_DIMENSION_CODES.flatMap(
  (dimensionCode) => MWMS_DIMENSION_ITEM_CODES[dimensionCode],
) as MwmsItemCode[];

export const MWMS_REQUIRED_ITEM_COUNT = MWMS_ITEM_CODES.length;

export const MWMS_ITEM_TO_DIMENSION = MWMS_DIMENSION_CODES.reduce(
  (mapping, dimensionCode) => {
    for (const itemCode of MWMS_DIMENSION_ITEM_CODES[dimensionCode]) {
      mapping[itemCode] = dimensionCode;
    }

    return mapping;
  },
  {} as Record<MwmsItemCode, MwmsDimensionCode>,
);

function roundMwmsScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildInvalidResult(
  code: MwmsScoringErrorCode,
  message: string,
  details: string[],
): MwmsScoringInvalidResult {
  return {
    testSlug: MWMS_V1_TEST_SLUG,
    isComplete: false,
    error: {
      code,
      message,
      details,
    },
  };
}

function getMean(values: number[]): number {
  return roundMwmsScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function scoreMwmsV1Responses(
  responsesByItemCode: Record<string, number>,
): MwmsScoringResult {
  const providedItemCodes = Object.keys(responsesByItemCode);
  const unknownItemCodes = providedItemCodes.filter(
    (itemCode): itemCode is string => !MWMS_ITEM_CODES.includes(itemCode as MwmsItemCode),
  );

  if (unknownItemCodes.length > 0) {
    return buildInvalidResult(
      "unknown_item",
      "MWMS scoring received unknown item codes.",
      unknownItemCodes.sort().map((itemCode) => `Unknown MWMS item code: ${itemCode}`),
    );
  }

  const missingItemCodes = MWMS_ITEM_CODES.filter(
    (itemCode) => !Object.prototype.hasOwnProperty.call(responsesByItemCode, itemCode),
  );

  if (missingItemCodes.length > 0) {
    return buildInvalidResult(
      "missing_required_item",
      "MWMS scoring requires responses for all required items.",
      missingItemCodes.map((itemCode) => `Missing required MWMS item: ${itemCode}`),
    );
  }

  const invalidValueDetails: string[] = [];

  for (const itemCode of MWMS_ITEM_CODES) {
    const value = responsesByItemCode[itemCode];

    if (!Number.isInteger(value) || value < 1 || value > 7) {
      invalidValueDetails.push(
        `Invalid MWMS response value for ${itemCode}: expected integer 1-7, received ${String(value)}`,
      );
    }
  }

  if (invalidValueDetails.length > 0) {
    return buildInvalidResult(
      "invalid_value",
      "MWMS scoring accepts only integer response values from 1 to 7.",
      invalidValueDetails,
    );
  }

  const dimensions = MWMS_DIMENSION_CODES.reduce(
    (dimensionScores, dimensionCode) => {
      const itemCodes = MWMS_DIMENSION_ITEM_CODES[dimensionCode];
      const values = itemCodes.map((itemCode) => responsesByItemCode[itemCode]);

      dimensionScores[dimensionCode] = {
        score: getMean(values),
        answeredItems: values.length,
        requiredItems: itemCodes.length,
      };

      return dimensionScores;
    },
    {} as Record<MwmsDimensionCode, MwmsDimensionScore>,
  );

  const composites = (
    Object.entries(MWMS_COMPOSITE_DIMENSIONS) as Array<
      [MwmsCompositeCode, readonly MwmsDimensionCode[]]
    >
  ).reduce((compositeScores, [compositeCode, sourceDimensions]) => {
    compositeScores[compositeCode] = {
      score: getMean(sourceDimensions.map((dimensionCode) => dimensions[dimensionCode].score)),
      sourceDimensions: [...sourceDimensions],
    };

    return compositeScores;
  }, {} as Record<MwmsCompositeCode, MwmsCompositeScore>);

  return {
    testSlug: MWMS_V1_TEST_SLUG,
    isComplete: true,
    dimensions,
    composites,
  };
}
