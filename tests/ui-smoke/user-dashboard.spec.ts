import { expect, test } from "@playwright/test";
import { loginForDashboard } from "./auth";

test("candidate dashboard renders core smoke signal", async ({ page }, testInfo) => {
  await loginForDashboard(page, "candidate");
  await page.goto("/app");

  await expect(
    page.getByRole("heading", {
      name: "Dostupni testovi",
    }),
  ).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("user-dashboard.png"),
  });
});
