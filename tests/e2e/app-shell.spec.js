import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { installMockSupabase, mockUser } from "./utils/mockSupabase";

test.beforeEach(async ({ page }) => {
  await installMockSupabase(page);
});

test("redesigned app routes render on protected pages", async ({ page }) => {
  test.setTimeout(120000);

  const routes = [
    { path: "/app", assert: () => page.getByRole("heading", { name: /Welcome back,/i }) },
    { path: "/app/calendar", assert: () => page.getByPlaceholder("Search client, service, phone") },
    { path: "/app/services", assert: () => page.getByRole("heading", { name: "Manage Services" }) },
    { path: "/app/availability", assert: () => page.getByText("Quick presets") },
    { path: "/app/payouts", assert: () => page.getByRole("heading", { name: "Payouts" }) },
    { path: "/app/subscription", assert: () => page.getByRole("heading", { name: "Subscription" }) },
    { path: "/app/studio", assert: () => page.getByText("Team members") },
    { path: "/app/analytics", assert: () => page.getByRole("heading", { name: "Analytics" }) },
    { path: "/app/settings", assert: () => page.getByRole("heading", { name: "Settings" }) },
    { path: "/app/profile", assert: () => page.getByRole("heading", { name: "Profile" }) },
  ];

  for (const route of routes) {
    await page.goto(route.path, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(new RegExp(`${route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await expect(route.assert()).toBeVisible();
  }
});

test("desktop dashboard theme toggle and primary CTAs behave correctly", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");

  await page.addInitScript(() => {
    window.__openCalls = [];
    window.open = (...args) => {
      window.__openCalls.push(args);
      return null;
    };
  });

  await page.goto("/app", { waitUntil: "networkidle" });

  const shell = page.locator(".shell");
  await expect(shell).toHaveAttribute("data-shell-scheme", "dark");

  await page.getByRole("switch", { name: /Color theme dark/i }).click();
  await expect(shell).toHaveAttribute("data-shell-scheme", "light");

  await page.reload();
  await expect(shell).toHaveAttribute("data-shell-scheme", "light");

  await page.getByRole("button", { name: "Edit Profile" }).click();
  await expect(page).toHaveURL(/\/app\/profile$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole("button", { name: "Manage Services" }).click();
  await expect(page).toHaveURL(/\/app\/services$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole("button", { name: "Preview Public Profile" }).click();
  const openCalls = await page.evaluate(() => window.__openCalls);
  expect(openCalls.at(-1)?.[0]).toBe(`/professional/${mockUser.id}`);

  const scrollY = await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    return window.scrollY;
  });
  expect(scrollY).toBeGreaterThan(0);
});

test("mobile app shell keeps the page scrollable and exposes bottom navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  test.setTimeout(90000);

  await page.goto("/app/profile", { waitUntil: "networkidle" });

  await expect(page.locator(".shellSidebar")).toBeHidden();
  await expect(page.locator(".shellMobileNav")).toBeVisible();

  const scrollY = await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    return window.scrollY;
  });
  expect(scrollY).toBeGreaterThan(0);

  await page.getByRole("link", { name: "Pay" }).click();
  await expect(page).toHaveURL(/\/app\/payouts$/);
  await expect(page.getByRole("heading", { name: "Payouts" })).toBeVisible();

  await page.getByRole("link", { name: "Studio" }).click();
  await expect(page).toHaveURL(/\/app\/studio$/);
  await expect(page.getByText("Team members")).toBeVisible();
});

test("dashboard has no serious or critical accessibility violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");

  await page.goto("/app", { waitUntil: "networkidle" });

  const accessibility = await new AxeBuilder({ page }).analyze();
  const seriousViolations = accessibility.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );

  expect(seriousViolations, JSON.stringify(seriousViolations, null, 2)).toEqual([]);
});
