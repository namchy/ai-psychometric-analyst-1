import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getObjectKeys(source, constName) {
  const start = source.indexOf(`const ${constName}`);
  assert(start >= 0, `Missing ${constName}.`);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  let braceEnd = -1;

  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        braceEnd = index;
        break;
      }
    }
  }

  assert(braceEnd > braceStart, `Could not parse ${constName}.`);

  return [...source.slice(braceStart, braceEnd).matchAll(/^\s*([A-Z_]+):/gm)].map((match) => match[1]);
}

async function main() {
  const labelsSource = await fs.readFile(
    path.join(root, "lib/assessment/ipip-neo-120-labels.ts"),
    "utf8",
  );
  const componentSource = await fs.readFile(
    path.join(root, "components/assessment/completed-assessment-summary.tsx"),
    "utf8",
  );
  const schema = JSON.parse(
    await fs.readFile(
      path.join(root, "lib/assessment/schemas/ipip-neo-120-participant-v1.json"),
      "utf8",
    ),
  );
  const prompts = JSON.parse(
    await fs.readFile(
      path.join(root, "assessment-packages/ipip-neo-120-v1/prompts.json"),
      "utf8",
    ),
  );

  const domainKeys = getObjectKeys(labelsSource, "IPIP_NEO_120_DOMAIN_LABELS_BS");
  const facetKeys = getObjectKeys(labelsSource, "IPIP_NEO_120_FACET_LABELS_BS");

  assert(domainKeys.length === 5, `Expected 5 domain labels, got ${domainKeys.length}.`);
  assert(facetKeys.length === 30, `Expected 30 facet labels, got ${facetKeys.length}.`);
  assert(
    schema.properties?.contract_version?.const === "ipip_neo_120_participant_v1",
    "Schema contract_version mismatch.",
  );
  assert(
    Array.isArray(schema.properties?.domains?.items ? [] : schema.required) &&
      schema.required.includes("domains"),
    "Schema must require domains.",
  );
  assert(
    prompts.some((prompt) => prompt.prompt_key === "ipip_neo_120_participant_v1"),
    "Missing ipip_neo_120_participant_v1 prompt.",
  );
  assert(
    componentSource.includes("ipip_neo_120_participant_v1") &&
      componentSource.includes("Poddimenzije"),
    "Renderer hook for ipip_neo_120_participant_v1 not found.",
  );

  console.log("ipip-neo-120 participant report verification passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
