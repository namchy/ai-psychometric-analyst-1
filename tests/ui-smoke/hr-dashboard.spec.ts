import { expect, test } from "@playwright/test";
import { loginForDashboard } from "./auth";

test("hr dashboard renders core smoke signal", async ({ page }, testInfo) => {
  await loginForDashboard(page, "hr");
  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", {
      name: "Participant operations",
    }),
  ).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("hr-dashboard.png"),
  });
});
