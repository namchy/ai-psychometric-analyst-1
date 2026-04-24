export type SafranPracticeExample = {
  index: 1 | 2 | 3 | 4;
  title: string;
  helperText: string;
  stimulusImagePath: string;
  stimulusSecondaryImagePath: string | null;
  optionImagePaths: string[];
};

const BASE_PATH = "/tests/safran/v1/practice";

export const SAFRAN_PRACTICE_EXAMPLES: readonly SafranPracticeExample[] = [
  {
    index: 1,
    title: "Primjer 1 od 4",
    helperText: "Odaberi odgovor koji najbolje odgovara zadatku.",
    stimulusImagePath: `${BASE_PATH}/PRACTICE_01/stimulus.jpg`,
    stimulusSecondaryImagePath: null,
    optionImagePaths: [
      `${BASE_PATH}/PRACTICE_01/option_dis1.jpg`,
      `${BASE_PATH}/PRACTICE_01/option_dis2.jpg`,
      `${BASE_PATH}/PRACTICE_01/option_correct.jpg`,
      `${BASE_PATH}/PRACTICE_01/option_dis3.jpg`,
      `${BASE_PATH}/PRACTICE_01/option_dis4.jpg`,
      `${BASE_PATH}/PRACTICE_01/option_dis5.jpg`,
    ],
  },
  {
    index: 2,
    title: "Primjer 2 od 4",
    helperText: "Pažljivo pogledaj sve ponuđene opcije prije nego odabereš odgovor.",
    stimulusImagePath: `${BASE_PATH}/PRACTICE_02/stimulus.jpg`,
    stimulusSecondaryImagePath: null,
    optionImagePaths: [
      `${BASE_PATH}/PRACTICE_02/option_dis1.jpg`,
      `${BASE_PATH}/PRACTICE_02/option_dis2.jpg`,
      `${BASE_PATH}/PRACTICE_02/option_correct.jpg`,
      `${BASE_PATH}/PRACTICE_02/option_dis3.jpg`,
      `${BASE_PATH}/PRACTICE_02/option_dis4.jpg`,
    ],
  },
  {
    index: 3,
    title: "Primjer 3 od 4",
    helperText: "Kod ovakvih zadataka obrati pažnju na odnos između oblika i obrazaca.",
    stimulusImagePath: `${BASE_PATH}/PRACTICE_03/stimulus.jpg`,
    stimulusSecondaryImagePath: null,
    optionImagePaths: [
      `${BASE_PATH}/PRACTICE_03/option_dis1.jpg`,
      `${BASE_PATH}/PRACTICE_03/option_dis2.jpg`,
      `${BASE_PATH}/PRACTICE_03/option_correct.jpg`,
      `${BASE_PATH}/PRACTICE_03/option_dis3.jpg`,
      `${BASE_PATH}/PRACTICE_03/option_dis4.jpg`,
    ],
  },
  {
    index: 4,
    title: "Primjer 4 od 4",
    helperText: "Ovo je posljednji primjer. Nakon njega prelaziš na pravi test.",
    stimulusImagePath: `${BASE_PATH}/PRACTICE_04/stimulus.jpg`,
    stimulusSecondaryImagePath: null,
    optionImagePaths: [
      `${BASE_PATH}/PRACTICE_04/option_dis1.jpg`,
      `${BASE_PATH}/PRACTICE_04/option_dis2.jpg`,
      `${BASE_PATH}/PRACTICE_04/option_correct.jpg`,
      `${BASE_PATH}/PRACTICE_04/option_dis3.jpg`,
      `${BASE_PATH}/PRACTICE_04/option_dis4.jpg`,
      `${BASE_PATH}/PRACTICE_04/option_dis5.jpg`,
    ],
  },
] as const;

export function getSafranPracticeExample(
  exampleIndex: string | number,
): SafranPracticeExample | null {
  const normalizedIndex = Number(exampleIndex);

  if (!Number.isInteger(normalizedIndex)) {
    return null;
  }

  return SAFRAN_PRACTICE_EXAMPLES.find((example) => example.index === normalizedIndex) ?? null;
}
