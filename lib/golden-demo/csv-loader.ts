import fs from "node:fs";
import path from "node:path";
import {
  GOLDEN_DEMO_CSV_FILES,
  GOLDEN_DEMO_FIXTURE_RELATIVE_PATH,
  type GoldenDemoCsvDocument,
  type GoldenDemoCsvFoundation,
  type GoldenDemoQuestionContract,
  type GoldenDemoRepoContract,
  type GoldenDemoResponseKind,
  type GoldenDemoTestContract,
  type GoldenDemoTestSlug,
} from "./csv-contract";

export class GoldenDemoCsvParseError extends Error {
  constructor(
    message: string,
    readonly file: string,
    readonly row?: number,
  ) {
    super(message);
    this.name = "GoldenDemoCsvParseError";
  }
}

function parseCsvMatrix(text: string, file: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let rowNumber = 1;

  const pushRow = () => {
    row.push(field);
    field = "";
    if (!row.every((value) => value.length === 0)) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
        if (character === "\n") {
          rowNumber += 1;
        }
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new GoldenDemoCsvParseError(
          "Quoted CSV field must start at the beginning of a field.",
          file,
          rowNumber,
        );
      }
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      pushRow();
      rowNumber += 1;
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    throw new GoldenDemoCsvParseError("CSV contains an unterminated quoted field.", file, rowNumber);
  }

  if (row.length > 0 || field.length > 0) {
    pushRow();
  }

  if (rows.length === 0) {
    throw new GoldenDemoCsvParseError("CSV must contain a header row.", file, 1);
  }

  return rows;
}

export function parseGoldenDemoCsv(text: string, file: string): GoldenDemoCsvDocument {
  const matrix = parseCsvMatrix(text, file);
  const headers = matrix[0] ?? [];

  if (headers.length === 0 || headers.some((header) => header.length === 0)) {
    throw new GoldenDemoCsvParseError("CSV header contains an empty column name.", file, 1);
  }

  if (new Set(headers).size !== headers.length) {
    throw new GoldenDemoCsvParseError("CSV header contains duplicate column names.", file, 1);
  }

  return {
    file,
    headers,
    rows: matrix.slice(1).map((columns, index) => ({
      rowNumber: index + 2,
      columnCount: columns.length,
      values: Object.fromEntries(headers.map((header, columnIndex) => [header, columns[columnIndex] ?? ""])),
    })),
  };
}

export function loadGoldenDemoCsvDocument(filePath: string): GoldenDemoCsvDocument {
  return parseGoldenDemoCsv(fs.readFileSync(filePath, "utf8"), path.basename(filePath));
}

export function loadGoldenDemoCsvFoundation(
  projectRoot = process.cwd(),
): GoldenDemoCsvFoundation {
  const fixtureRoot = path.resolve(projectRoot, GOLDEN_DEMO_FIXTURE_RELATIVE_PATH);

  return {
    candidates: loadGoldenDemoCsvDocument(path.join(fixtureRoot, GOLDEN_DEMO_CSV_FILES.candidates)),
    answers: loadGoldenDemoCsvDocument(path.join(fixtureRoot, GOLDEN_DEMO_CSV_FILES.answers)),
    expectedScores: loadGoldenDemoCsvDocument(
      path.join(fixtureRoot, GOLDEN_DEMO_CSV_FILES.expectedScores),
    ),
    expectedAiFindings: loadGoldenDemoCsvDocument(
      path.join(fixtureRoot, GOLDEN_DEMO_CSV_FILES.expectedAiFindings),
    ),
  };
}

type PackageItem = {
  code: string;
  question_type: GoldenDemoResponseKind;
};

type PackageOption = {
  code: string;
};

type SafranSeedItem = {
  item_id: string;
  renderer_type: "text_choice" | "image_choice" | "numeric_input";
  options?: Array<{ option_id: string }>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function buildPackageTestContract(
  projectRoot: string,
  slug: "ipip-neo-120-v1" | "mwms_v1",
  packageDirectory: string,
): GoldenDemoTestContract {
  const packageRoot = path.join(projectRoot, "assessment-packages", packageDirectory);
  const items = readJson<PackageItem[]>(path.join(packageRoot, "items.json"));
  const options = readJson<PackageOption[]>(path.join(packageRoot, "options.json"));
  const optionCodes = new Set(options.map((option) => option.code));
  const questions = new Map<string, GoldenDemoQuestionContract>();

  for (const item of items) {
    questions.set(item.code, {
      code: item.code,
      responseKind: item.question_type,
      optionCodes: new Set(optionCodes),
    });
  }

  return { slug, questions };
}

function buildSafranTestContract(projectRoot: string): GoldenDemoTestContract {
  const seed = readJson<{ items: SafranSeedItem[] }>(path.join(projectRoot, "safran_v1_seed.json"));
  const questions = new Map<string, GoldenDemoQuestionContract>();

  for (const item of seed.items) {
    const responseKind: GoldenDemoResponseKind =
      item.renderer_type === "numeric_input" ? "text" : "single_choice";
    questions.set(item.item_id, {
      code: item.item_id,
      responseKind,
      optionCodes: new Set((item.options ?? []).map((option) => option.option_id)),
    });
  }

  return { slug: "safran_v1", questions };
}

export function loadGoldenDemoRepoContract(projectRoot = process.cwd()): GoldenDemoRepoContract {
  const contracts: GoldenDemoTestContract[] = [
    buildPackageTestContract(projectRoot, "ipip-neo-120-v1", "ipip-neo-120-v1"),
    buildPackageTestContract(projectRoot, "mwms_v1", "mwms_v1"),
    buildSafranTestContract(projectRoot),
  ];

  return {
    tests: new Map(
      contracts.map((contract) => [contract.slug as GoldenDemoTestSlug, contract]),
    ),
  };
}
