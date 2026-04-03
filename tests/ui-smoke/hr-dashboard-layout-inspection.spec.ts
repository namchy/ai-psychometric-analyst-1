import { expect, test, type Locator } from "@playwright/test";
import { loginForDashboard } from "./auth";

function formatBox(box: { x: number; y: number; width: number; height: number }) {
  return {
    x: Number(box.x.toFixed(2)),
    y: Number(box.y.toFixed(2)),
    width: Number(box.width.toFixed(2)),
    height: Number(box.height.toFixed(2)),
  };
}

async function collectElementDiagnostics(locator: Locator) {
  return locator.evaluate((element) => {
    const htmlElement = element as HTMLElement;
    const rect = htmlElement.getBoundingClientRect();
    const style = window.getComputedStyle(htmlElement);
    const ancestors: Array<{
      tag: string;
      className: string;
    }> = [];

    let current: HTMLElement | null = htmlElement;
    while (current && ancestors.length < 6) {
      ancestors.push({
        tag: current.tagName.toLowerCase(),
        className: current.className,
      });
      current = current.parentElement;
    }

    return {
      tag: htmlElement.tagName.toLowerCase(),
      className: htmlElement.className,
      boundingBox: {
        x: Number(rect.x.toFixed(2)),
        y: Number(rect.y.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
      },
      computedStyle: {
        marginTop: style.marginTop,
        marginBottom: style.marginBottom,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        display: style.display,
        position: style.position,
        overflow: style.overflow,
        boxShadow: style.boxShadow,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        border: style.border,
        borderRadius: style.borderRadius,
        zIndex: style.zIndex,
        transform: style.transform,
      },
      ancestors,
    };
  });
}

async function collectOwnerChain(locator: Locator, label: string) {
  return locator.evaluate((element, diagnosticLabel) => {
    const htmlElement = element as HTMLElement;
    const chain: Array<{
      label: string;
      depth: number;
      tag: string;
      id: string | null;
      className: string;
      role: string | null;
      ariaLabel: string | null;
      boundingBox: { x: number; y: number; width: number; height: number };
      computedStyle: {
        display: string;
        position: string;
        overflow: string;
        marginTop: string;
        marginBottom: string;
        paddingTop: string;
        paddingBottom: string;
        gap: string;
        rowGap: string;
        columnGap: string;
        boxShadow: string;
        backgroundColor: string;
        backgroundImage: string;
        border: string;
        borderRadius: string;
        zIndex: string;
        transform: string;
      };
      ownershipSignals: {
        hasSpaceYUtility: boolean;
        hasGapUtility: boolean;
        hasPaddingUtility: boolean;
        hasSurfaceStyling: boolean;
      };
    }> = [];

    let current: HTMLElement | null = htmlElement;
    let depth = 0;

    while (current && depth < 8) {
      const rect = current.getBoundingClientRect();
      const style = window.getComputedStyle(current);
      const className = current.className;

      chain.push({
        label: depth === 0 ? diagnosticLabel : `${diagnosticLabel}:ancestor-${depth}`,
        depth,
        tag: current.tagName.toLowerCase(),
        id: current.id || null,
        className,
        role: current.getAttribute("role"),
        ariaLabel: current.getAttribute("aria-label"),
        boundingBox: {
          x: Number(rect.x.toFixed(2)),
          y: Number(rect.y.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
        },
        computedStyle: {
          display: style.display,
          position: style.position,
          overflow: style.overflow,
          marginTop: style.marginTop,
          marginBottom: style.marginBottom,
          paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom,
          gap: style.gap,
          rowGap: style.rowGap,
          columnGap: style.columnGap,
          boxShadow: style.boxShadow,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          border: style.border,
          borderRadius: style.borderRadius,
          zIndex: style.zIndex,
          transform: style.transform,
        },
        ownershipSignals: {
          hasSpaceYUtility: /\bspace-y-/.test(className),
          hasGapUtility: /\bgap(?:-[xy])?-/.test(className),
          hasPaddingUtility: /\bp[trblxy]?-\d/.test(className),
          hasSurfaceStyling:
            style.backgroundImage !== "none" ||
            style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
            style.boxShadow !== "none" ||
            style.borderStyle !== "none",
        },
      });

      current = current.parentElement;
      depth += 1;
    }

    return chain;
  }, label);
}

test("hr dashboard layout inspection captures overview-to-first-section spacing", async ({
  page,
}, testInfo) => {
  await loginForDashboard(page, "hr");
  await page.goto("/dashboard");

  const overviewHeading = page.getByRole("heading", { name: "Participant operations" });
  await expect(overviewHeading).toBeVisible();

  const overviewSection = overviewHeading.locator("xpath=ancestor::section[1]");
  const firstOuterContentBlock = overviewSection.locator("xpath=following-sibling::*[1]");
  const participantsContentShell = page.locator("[data-participants-section-shell]");
  const participantsHeaderBlock = page.locator("[data-participants-section-header]");
  const participantsBodyBlock = page.locator("[data-participants-section-body]");
  const participantsCreatePanelArea = page.locator("[data-participants-create-panel-area]");
  const firstContentHeading = participantsHeaderBlock.getByRole("heading", { name: "Participants" });
  const participantsListBlock = page.locator("[data-participants-cards-list]");
  const participantsList = participantsListBlock.locator("ul");
  const firstParticipantCardShell = participantsList.locator("li").first().locator("article").first();
  const firstInnerAccordion = firstParticipantCardShell.locator("details").first();
  const mainStack = page.locator("main").first();

  await expect(overviewSection).toBeVisible();
  await expect(firstOuterContentBlock).toBeVisible();
  await expect(participantsContentShell).toBeVisible();
  await expect(participantsHeaderBlock).toBeVisible();
  await expect(participantsBodyBlock).toBeVisible();
  await expect(participantsCreatePanelArea).toBeVisible();
  await expect(firstContentHeading).toBeVisible();
  await expect(participantsListBlock).toBeVisible();
  await expect(firstParticipantCardShell).toBeVisible();
  await expect(firstInnerAccordion).toBeVisible();
  await expect(mainStack).toBeVisible();

  const [
    overviewBox,
    firstOuterContentBlockBox,
    participantsContentShellBox,
    participantsHeaderBlockBox,
    participantsBodyBlockBox,
    firstParticipantCardBox,
    firstInnerAccordionBox,
  ] = await Promise.all([
    overviewSection.boundingBox(),
    firstOuterContentBlock.boundingBox(),
    participantsContentShell.boundingBox(),
    participantsHeaderBlock.boundingBox(),
    participantsBodyBlock.boundingBox(),
    firstParticipantCardShell.boundingBox(),
    firstInnerAccordion.boundingBox(),
  ]);

  if (
    !overviewBox ||
    !firstOuterContentBlockBox ||
    !participantsContentShellBox ||
    !participantsHeaderBlockBox ||
    !participantsBodyBlockBox ||
    !firstParticipantCardBox ||
    !firstInnerAccordionBox
  ) {
    throw new Error("Could not capture bounding boxes for HR dashboard layout inspection.");
  }

  const metrics = {
    heroToFirstOuterBlock: Number(
      (firstOuterContentBlockBox.y - (overviewBox.y + overviewBox.height)).toFixed(2),
    ),
    firstOuterBlockTopToInnerShellStart: Number(
      (participantsContentShellBox.y - firstOuterContentBlockBox.y).toFixed(2),
    ),
    innerShellHeadingToFirstParticipantCard: Number(
      (
        firstParticipantCardBox.y -
        (participantsHeaderBlockBox.y + participantsHeaderBlockBox.height)
      ).toFixed(2),
    ),
    headerToBodyStart: Number(
      (participantsBodyBlockBox.y - (participantsHeaderBlockBox.y + participantsHeaderBlockBox.height)).toFixed(2),
    ),
    participantCardToFirstInnerAccordion: Number(
      (firstInnerAccordionBox.y - firstParticipantCardBox.y).toFixed(2),
    ),
  };
  const [
    overviewDiagnostics,
    firstOuterContentBlockDiagnostics,
    participantsContentShellDiagnostics,
    firstParticipantCardDiagnostics,
    firstInnerAccordionDiagnostics,
    mainStackDiagnostics,
    parentStackDiagnostics,
    siblingChain,
    overviewOwnerChain,
    firstOuterBlockOwnerChain,
    participantsShellOwnerChain,
    participantCardOwnerChain,
    innerAccordionOwnerChain,
  ] = await Promise.all([
    collectElementDiagnostics(overviewSection),
    collectElementDiagnostics(firstOuterContentBlock),
    collectElementDiagnostics(participantsContentShell),
    collectElementDiagnostics(firstParticipantCardShell),
    collectElementDiagnostics(firstInnerAccordion),
    collectElementDiagnostics(mainStack),
    overviewSection.locator("xpath=parent::*[1]").evaluate((element) => {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);

      return {
        tag: htmlElement.tagName.toLowerCase(),
        className: htmlElement.className,
        display: style.display,
        gap: style.gap,
        rowGap: style.rowGap,
        columnGap: style.columnGap,
        marginTop: style.marginTop,
        paddingTop: style.paddingTop,
      };
    }),
    mainStack.locator("xpath=./*").evaluateAll((elements) =>
      elements.map((element, index) => {
        const htmlElement = element as HTMLElement;
        const style = window.getComputedStyle(htmlElement);

        return {
          index,
          tag: htmlElement.tagName.toLowerCase(),
          className: htmlElement.className,
          ariaLabel: htmlElement.getAttribute("aria-label"),
          marginTop: style.marginTop,
          marginBottom: style.marginBottom,
        };
      }),
    ),
    collectOwnerChain(overviewSection, "A"),
    collectOwnerChain(firstOuterContentBlock, "B"),
    collectOwnerChain(participantsContentShell, "C"),
    collectOwnerChain(firstParticipantCardShell, "D"),
    collectOwnerChain(firstInnerAccordion, "E"),
  ]);

  const ownershipAnalysis = await page.evaluate(() => {
    const heroHeading = Array.from(document.querySelectorAll("h2")).find(
      (node) => node.textContent?.trim() === "Participant operations",
    ) as HTMLElement | undefined;
    const participantsHeading = Array.from(document.querySelectorAll("h2")).find(
      (node) => node.textContent?.trim() === "Participants",
    ) as HTMLElement | undefined;

    if (!heroHeading || !participantsHeading) {
      throw new Error("Could not locate hero or Participants headings for ownership analysis.");
    }

    const heroSection = heroHeading.closest("section") as HTMLElement | null;
    const firstOuterBlock = heroSection?.nextElementSibling as HTMLElement | null;
    const participantsShell = document.querySelector("[data-participants-section-shell]") as HTMLElement | null;
    const participantsHeader = document.querySelector("[data-participants-section-header]") as HTMLElement | null;
    const participantsBody = document.querySelector("[data-participants-section-body]") as HTMLElement | null;
    const participantsCreatePanelArea = document.querySelector(
      "[data-participants-create-panel-area]",
    ) as HTMLElement | null;
    const participantsList = document.querySelector("[data-participants-cards-list]") as HTMLElement | null;
    const firstParticipantCard = participantsList?.querySelector("ul li article") as HTMLElement | null;
    const firstInnerAccordion = firstParticipantCard?.querySelector("details") as HTMLElement | null;

    const inspectChain = (from: HTMLElement | null, until: HTMLElement | null) => {
      const nodes: Array<{
        tag: string;
        className: string;
        computedGap: string;
        computedRowGap: string;
        computedColumnGap: string;
        paddingTop: string;
        paddingBottom: string;
        backgroundColor: string;
        backgroundImage: string;
        boxShadow: string;
        notes: string[];
      }> = [];
      let current = from;

      while (current) {
        const style = window.getComputedStyle(current);
        const notes: string[] = [];

        if (/\bspace-y-/.test(current.className)) notes.push("space-y utility");
        if (/\bgap(?:-[xy])?-/.test(current.className)) notes.push("gap utility");
        if (
          style.paddingTop !== "0px" ||
          style.paddingBottom !== "0px" ||
          /\bp[trblxy]?-\d/.test(current.className)
        ) {
          notes.push("padding");
        }
        if (
          style.backgroundImage !== "none" ||
          style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
          style.boxShadow !== "none" ||
          style.borderStyle !== "none"
        ) {
          notes.push("surface");
        }

        nodes.push({
          tag: current.tagName.toLowerCase(),
          className: current.className,
          computedGap: style.gap,
          computedRowGap: style.rowGap,
          computedColumnGap: style.columnGap,
          paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          boxShadow: style.boxShadow,
          notes,
        });

        if (current === until) break;
        current = current.parentElement;
      }

      return nodes;
    };

    const headingStyle = participantsHeader ? window.getComputedStyle(participantsHeader) : null;

    return {
      participantsHeadingSharesShellWithCards:
        !!participantsShell && !!firstParticipantCard && participantsShell.contains(firstParticipantCard),
      participantsHeaderSeparatedFromBody:
        !!participantsHeader &&
        !!participantsBody &&
        participantsHeader.parentElement === participantsShell &&
        participantsBody.parentElement === participantsShell,
      heroToFirstOuterBlockChain: inspectChain(firstOuterBlock, heroSection?.parentElement ?? null),
      outerBlockToParticipantsShellChain: inspectChain(participantsShell, firstOuterBlock),
      participantsShellToHeaderChain: inspectChain(participantsHeader, participantsShell),
      participantsShellToBodyChain: inspectChain(participantsBody, participantsShell),
      participantsBodyToCreatePanelChain: inspectChain(participantsCreatePanelArea, participantsBody),
      participantsBodyToListChain: inspectChain(participantsList, participantsBody),
      participantsShellToFirstCardChain: inspectChain(firstParticipantCard, participantsShell),
      firstCardToInnerAccordionChain: inspectChain(firstInnerAccordion, firstParticipantCard),
      participantsHeader: participantsHeader
        ? {
            tag: participantsHeader.tagName.toLowerCase(),
            className: participantsHeader.className,
            gap: headingStyle?.gap ?? null,
            paddingTop: headingStyle?.paddingTop ?? null,
            paddingBottom: headingStyle?.paddingBottom ?? null,
            marginBottom: headingStyle?.marginBottom ?? null,
          }
        : null,
    };
  });

  await page.evaluate(() => {
    const existing = document.getElementById("pw-layout-diagnostic-overlays");
    if (existing) existing.remove();

    const overlayRoot = document.createElement("div");
    overlayRoot.id = "pw-layout-diagnostic-overlays";
    overlayRoot.style.position = "fixed";
    overlayRoot.style.inset = "0";
    overlayRoot.style.pointerEvents = "none";
    overlayRoot.style.zIndex = "999999";

    const entries = [
      { label: "A Hero", selector: "h2", text: "Participant operations", color: "#0f766e" },
      { label: "B Outer", selector: "div", className: "space-y-6", color: "#2563eb" },
      { label: "C Shell", selector: "[data-participants-section-shell]", color: "#7c3aed" },
      { label: "D Card", selector: "article", participantCard: true, color: "#dc2626" },
    ];

    const createHighlight = (rect: DOMRect, color: string, label: string) => {
      const box = document.createElement("div");
      box.style.position = "fixed";
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.style.border = `3px solid ${color}`;
      box.style.borderRadius = "14px";
      box.style.background = `${color}12`;

      const tag = document.createElement("div");
      tag.textContent = label;
      tag.style.position = "absolute";
      tag.style.left = "8px";
      tag.style.top = "8px";
      tag.style.padding = "3px 8px";
      tag.style.borderRadius = "999px";
      tag.style.background = color;
      tag.style.color = "#fff";
      tag.style.font = "600 12px/1.2 sans-serif";
      box.appendChild(tag);

      overlayRoot.appendChild(box);
    };

    const headings = Array.from(document.querySelectorAll("h2"));
    const heroHeading = headings.find((node) => node.textContent?.trim() === "Participant operations") as
      | HTMLElement
      | undefined;
    const heroSection = heroHeading?.closest("section") as HTMLElement | null;
    const firstOuterBlock = heroSection?.nextElementSibling as HTMLElement | null;
    const participantsShell = document.querySelector("[data-participants-section-shell]") as HTMLElement | null;
    const participantsList = document.querySelector("[data-participants-cards-list]") as HTMLElement | null;
    const firstParticipantCard = participantsList?.querySelector("ul li article") as HTMLElement | null;

    if (heroSection) createHighlight(heroSection.getBoundingClientRect(), entries[0].color, entries[0].label);
    if (firstOuterBlock) createHighlight(firstOuterBlock.getBoundingClientRect(), entries[1].color, entries[1].label);
    if (participantsShell) createHighlight(participantsShell.getBoundingClientRect(), entries[2].color, entries[2].label);
    if (firstParticipantCard) createHighlight(firstParticipantCard.getBoundingClientRect(), entries[3].color, entries[3].label);

    document.body.appendChild(overlayRoot);
  });

  const diagnostics = {
    locatorStrategy: {
      A: 'getByRole("heading", { name: "Participant operations" }) -> xpath=ancestor::section[1]',
      B: "A -> xpath=following-sibling::*[1]",
      C: "locator('[data-participants-section-shell]')",
      D: "locator('[data-participants-cards-list]') -> locator('ul') -> li:first-child -> article:first-child",
      E: "D -> locator('details').first()",
    },
    metrics,
    A: {
      ...overviewDiagnostics,
      ownerChain: overviewOwnerChain,
    },
    B: {
      ...firstOuterContentBlockDiagnostics,
      ownerChain: firstOuterBlockOwnerChain,
    },
    C: {
      ...participantsContentShellDiagnostics,
      ownerChain: participantsShellOwnerChain,
    },
    D: {
      ...firstParticipantCardDiagnostics,
      ownerChain: participantCardOwnerChain,
    },
    E: {
      ...firstInnerAccordionDiagnostics,
      ownerChain: innerAccordionOwnerChain,
    },
    mainStack: mainStackDiagnostics,
    parentStack: parentStackDiagnostics,
    mainStackChildren: siblingChain,
    ownershipAnalysis,
  };

  console.log("[hr-dashboard-layout-inspection] metrics", diagnostics.metrics);
  console.log("[hr-dashboard-layout-inspection] parentStack", diagnostics.parentStack);
  console.log("[hr-dashboard-layout-inspection] A", diagnostics.A);
  console.log("[hr-dashboard-layout-inspection] B", diagnostics.B);
  console.log("[hr-dashboard-layout-inspection] C", diagnostics.C);
  console.log("[hr-dashboard-layout-inspection] D", diagnostics.D);
  console.log("[hr-dashboard-layout-inspection] E", diagnostics.E);
  console.log(
    "[hr-dashboard-layout-inspection] mainStackChildren",
    diagnostics.mainStackChildren,
  );
  console.log("[hr-dashboard-layout-inspection] ownershipAnalysis", diagnostics.ownershipAnalysis);

  await testInfo.attach("hr-dashboard-layout-inspection.json", {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: "application/json",
  });

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("hr-dashboard-layout-full.png"),
  });

  const clipPadding = 24;
  const clipX = Math.max(
    0,
    Math.min(
      overviewBox.x,
      firstOuterContentBlockBox.x,
      participantsContentShellBox.x,
      firstParticipantCardBox.x,
    ) - clipPadding,
  );
  const clipY = Math.max(
    0,
    Math.min(
      overviewBox.y,
      firstOuterContentBlockBox.y,
      participantsContentShellBox.y,
      firstParticipantCardBox.y,
    ) - clipPadding,
  );
  const clipRight =
    Math.max(
      overviewBox.x + overviewBox.width,
      firstOuterContentBlockBox.x + firstOuterContentBlockBox.width,
      participantsContentShellBox.x + participantsContentShellBox.width,
      firstParticipantCardBox.x + firstParticipantCardBox.width,
    ) + clipPadding;
  const clipBottom =
    Math.max(
      overviewBox.y + overviewBox.height,
      firstOuterContentBlockBox.y + firstOuterContentBlockBox.height,
      participantsContentShellBox.y + participantsContentShellBox.height,
      firstParticipantCardBox.y + firstParticipantCardBox.height,
    ) + clipPadding;

  await page.screenshot({
    path: testInfo.outputPath("hr-dashboard-layout-focus.png"),
    clip: {
      x: clipX,
      y: clipY,
      width: clipRight - clipX,
      height: clipBottom - clipY,
    },
  });
});
