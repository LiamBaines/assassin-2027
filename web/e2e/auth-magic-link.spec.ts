import { expect, test } from "@playwright/test";
import { loginCodeFrom, magicLinkFrom, requestLoginEmail, uniqueEmail } from "./support";

// A new account with no games lands on /join after logging in from /login.

test("logs in with the magic link from the email", async ({ page }) => {
  await page.goto("/login");
  const mail = await requestLoginEmail(page, uniqueEmail("link"));

  const link = magicLinkFrom(mail);
  expect(link.pathname).toBe("/auth/confirm");
  expect(link.searchParams.get("type")).toBe("email");
  expect(link.searchParams.get("token_hash")).toBeTruthy();

  await page.goto(link.pathname + link.search);
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole("heading", { name: "Join a game" })).toBeVisible();
});

test("logs in with the 6-digit code from the email", async ({ page }) => {
  await page.goto("/login");
  const mail = await requestLoginEmail(page, uniqueEmail("code"));

  await page.getByLabel("6-digit code").fill(loginCodeFrom(mail));
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole("heading", { name: "Join a game" })).toBeVisible();
});
