import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

type DashboardTarget = "candidate" | "hr";

const DEFAULT_CANDIDATE_EMAIL = "user1@nesto.com";
const DEFAULT_HR_EMAIL = "hr1@nesto.com";

function readRequiredCredential(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Run the local demo bootstrap first and provide the matching password for Playwright.`,
    );
  }

  return value;
}

function getCredentials(target: DashboardTarget) {
  if (target === "candidate") {
    return {
      email: process.env.PLAYWRIGHT_CANDIDATE_EMAIL ?? DEFAULT_CANDIDATE_EMAIL,
      password:
        process.env.PLAYWRIGHT_CANDIDATE_PASSWORD ??
        process.env.LOCAL_DEMO_CANDIDATE_PASSWORD ??
        readRequiredCredential("PLAYWRIGHT_CANDIDATE_PASSWORD"),
      expectedPath: "/app",
    };
  }

  return {
    email: process.env.PLAYWRIGHT_HR_EMAIL ?? DEFAULT_HR_EMAIL,
    password:
      process.env.PLAYWRIGHT_HR_PASSWORD ??
      process.env.LOCAL_DEMO_HR_PASSWORD ??
      readRequiredCredential("PLAYWRIGHT_HR_PASSWORD"),
    expectedPath: "/dashboard",
  };
}

export async function loginForDashboard(page: Page, target: DashboardTarget) {
  const credentials = getCredentials(target);

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`**${credentials.expectedPath}`);
  await expect(page).toHaveURL(new RegExp(`${credentials.expectedPath}$`));
}
