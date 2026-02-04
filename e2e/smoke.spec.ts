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
  await page.locator('select[name="type"]').first().selectOption("COMPANY");
  await page.locator('input[name="name"]').first().fill(clientName);
  await page.locator('input[name="email"]').first().fill(`smoke-${suffix}@example.test`);
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByRole("link", { name: clientName })).toBeVisible();

  await page.goto("/dossiers");
  await page.locator('select[name="clientId"]').selectOption({ label: clientName });
  await page.locator('input[name="title"]').first().fill(dossierTitle);
  await page.getByRole("button", { name: "Create dossier" }).click();
  await expect(page.getByRole("link", { name: dossierTitle })).toBeVisible();

  await page.getByRole("link", { name: dossierTitle }).first().click();
  await expect(page.getByRole("heading", { name: dossierTitle })).toBeVisible();

  await page.getByPlaceholder("Task title").fill(taskTitle);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText(taskTitle)).toBeVisible();

  await expect(page.getByText("AI output is a suggestion only.")).toBeVisible();
});
