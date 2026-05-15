const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

const candidateReportsPageSource = fs.readFileSync(
  path.join(projectRoot, "app/(protected)/dashboard/participants/[participantId]/reports/page.tsx"),
  "utf8",
);
const dashboardPrimitivesSource = fs.readFileSync(
  path.join(projectRoot, "components/dashboard/primitives.tsx"),
  "utf8",
);

assert.equal(
  candidateReportsPageSource.includes("PageNavigation"),
  true,
  "Expected HR participant detail page to use shared PageNavigation.",
);
assert.equal(
  candidateReportsPageSource.includes('backLabel="Nazad na dashboard"'),
  true,
  "Expected HR participant detail page to keep dashboard back label in PageNavigation.",
);
assert.equal(
  candidateReportsPageSource.includes('contextLabel="HR procjena kandidata"'),
  true,
  "Expected HR participant detail page to provide HR context label in PageNavigation.",
);
assert.equal(
  candidateReportsPageSource.includes("Sažetak procjene"),
  false,
  "Expected HR participant detail page to remove the redundant summary block below the hero.",
);
assert.equal(
  candidateReportsPageSource.includes('title="Pojedinačni HR izvještaji"'),
  true,
  "Expected HR participant detail page to use the updated single-report section title.",
);
assert.equal(
  candidateReportsPageSource.includes(
    'description="Pregled statusa i izvještaja za svaku završenu procjenu kandidata."',
  ),
  true,
  "Expected HR participant detail page to use the updated single-report section description.",
);
assert.equal(
  candidateReportsPageSource.includes("Dostupni testovi i statusi"),
  false,
  "Expected outdated single-report section title to be removed.",
);
assert.equal(
  candidateReportsPageSource.includes("nalaz"),
  false,
  "Expected updated participant report page copy to avoid the word 'nalaz'.",
);
assert.equal(
  candidateReportsPageSource.includes("max-w-[920px]"),
  true,
  "Expected composite inner card to use a fixed max width on desktop.",
);
assert.equal(
  candidateReportsPageSource.includes("min-[900px]:grid-cols-[minmax(0,1fr)_auto]"),
  true,
  "Expected composite inner card to switch to a two-column desktop layout.",
);
assert.equal(
  candidateReportsPageSource.includes("min-[900px]:whitespace-nowrap"),
  true,
  "Expected composite CTA to remain nowrap on desktop.",
);
assert.equal(
  candidateReportsPageSource.includes("bg-[rgba(6,214,160,0.14)]"),
  true,
  "Expected emerald status semantics on the participant reports page.",
);
assert.equal(
  candidateReportsPageSource.includes(
    'border-[rgba(7,59,76,0.08)] bg-[rgba(255,255,255,0.72)] text-[#073b4c]',
  ),
  true,
  "Expected organization chip to use the neutral treatment instead of emerald.",
);
assert.equal(
  candidateReportsPageSource.includes('eyebrowClassName="text-[#118ab2]"'),
  true,
  "Expected single-report section eyebrow to use the ocean blue accent.",
);
assert.equal(
  candidateReportsPageSource.includes('eyebrowClassName="text-[#073b4c]"'),
  true,
  "Expected composite section eyebrow to use the dark teal accent.",
);
assert.equal(
  candidateReportsPageSource.includes(
    "shadow-[inset_0_3px_0_rgba(17,138,178,0.22),0_28px_60px_rgba(15,23,42,0.12)]",
  ),
  true,
  "Expected the single-report section shell to use an ocean-blue accent shadow.",
);
assert.equal(
  candidateReportsPageSource.includes(
    "shadow-[inset_0_3px_0_rgba(7,59,76,0.24),0_28px_60px_rgba(15,23,42,0.12)]",
  ),
  true,
  "Expected the composite section shell to use a dark-teal accent shadow.",
);
assert.equal(
  candidateReportsPageSource.includes("border-l-4 border-l-[#073b4c]"),
  true,
  "Expected the composite inner card to use a dark-teal left accent strip.",
);
assert.equal(
  candidateReportsPageSource.includes("bg-[rgba(255,255,255,0.82)]"),
  true,
  "Expected the composite inner card to use the specified translucent white background.",
);
assert.equal(
  dashboardPrimitivesSource.includes("bg-[#079985]"),
  true,
  "Expected shared dashboard primary CTA to use the updated default teal.",
);
assert.equal(
  dashboardPrimitivesSource.includes("hover:bg-[#073b4c]"),
  true,
  "Expected shared dashboard primary CTA to darken to dark teal on hover.",
);
assert.equal(
  dashboardPrimitivesSource.includes("text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white default text.",
);
assert.equal(
  dashboardPrimitivesSource.includes("hover:text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white text on hover.",
);
assert.equal(
  dashboardPrimitivesSource.includes("focus-visible:text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white text on focus-visible.",
);
assert.equal(
  dashboardPrimitivesSource.includes("active:text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white text when active.",
);
assert.equal(
  dashboardPrimitivesSource.includes("focus-visible:ring-[rgba(17,138,178,0.32)]"),
  true,
  "Expected shared dashboard primary CTA to use the specified focus ring color.",
);
assert.equal(
  candidateReportsPageSource.includes('title="Kompozitni HR izvještaj"'),
  false,
  "Composite section title should continue to come from model content, not be hardcoded in the page header.",
);
assert.equal(
  candidateReportsPageSource.includes("{model.organizationName}"),
  true,
  "Expected organization context to remain in hero metadata, not in page navigation.",
);
assert.equal(
  dashboardPrimitivesSource.includes("export function getDashboardCtaClassName"),
  true,
  "Expected dashboard primitives to expose a shared CTA helper.",
);
assert.equal(
  dashboardPrimitivesSource.includes("hover:text-white"),
  true,
  "Expected shared dashboard CTA helper to keep white text on darker hover states.",
);
assert.equal(
  candidateReportsPageSource.includes('getDashboardCtaClassName({ variant: "primary" })'),
  true,
  "Expected HR participant detail page to use shared primary CTA styling.",
);
assert.equal(
  candidateReportsPageSource.includes('getDashboardCtaClassName({ variant: "disabled" })'),
  true,
  "Expected HR participant detail page to use shared disabled CTA styling.",
);

console.log("HR participant reports renderer hygiene tests passed.");
