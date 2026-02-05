import { expect, test } from "@playwright/test";

test("admin can login and run core CRUD smoke flow", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const clientName = `Smoke Client ${suffix}`;
  const dossierTitle = `Smoke Dossier ${suffix}`;
  const taskTitle = `Smoke Task ${suffix}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@demo.law");
  await page.getByLabel("Password").fill("demo1234");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/clients");
  await page.getByRole("link", { name: "+ Nieuwe cliënt" }).click();
  await page.locator('select[name="type"]').selectOption("COMPANY");
  await page.locator('input[name="companyName"]').fill(clientName);
  await page.locator('input[name="email"]').fill(`smoke-${suffix}@example.test`);
  await page.getByRole("button", { name: "Toevoegen" }).click();
  await expect(page.getByRole("link", { name: clientName })).toBeVisible();

  await page.goto("/dossiers");
  await page.getByRole("link", { name: "+ Nieuw dossier" }).click();
  await page.locator('input[name="title"]').fill(dossierTitle);
  await page.locator('select[name="clientId"]').selectOption({ label: clientName });
  await page.getByRole("button", { name: "Aanmaken" }).click();
  await expect(page.getByRole("link", { name: dossierTitle })).toBeVisible();

  await page.goto("/tasks");
  await page.getByRole("link", { name: "+ Nieuwe taak" }).click();
  await page.locator('select[name="dossierId"]').selectOption({ label: dossierTitle });
  await page.locator('input[name="title"]').fill(taskTitle);
  await page.getByRole("button", { name: "Toevoegen" }).click();
  await expect(page.getByText(taskTitle)).toBeVisible();
});
