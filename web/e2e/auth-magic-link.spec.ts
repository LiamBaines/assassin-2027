import { expect, test, type Page } from "@playwright/test";
import { env } from "./support";

type MailpitMessage = { ID: string };
type MailpitSearch = { messages: MailpitMessage[] };
type MailpitDetail = { Text: string };

/** Polls Mailpit until the login email for `email` arrives and returns its text body. */
async function readLoginEmail(email: string): Promise<string> {
  const mailpit = env("MAILPIT_URL");
  const query = encodeURIComponent(`to:"${email}"`);
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(`${mailpit}/api/v1/search?query=${query}`);
        if (!res.ok) return undefined;
        const body = (await res.json()) as MailpitSearch;
        id = body.messages[0]?.ID;
        return id;
      },
      { message: `login email for ${email} in Mailpit`, timeout: 20_000 },
    )
    .toBeTruthy();
  const res = await fetch(`${mailpit}/api/v1/message/${id}`);
  return ((await res.json()) as MailpitDetail).Text;
}

/** A fresh address per test, so earlier runs' emails and rate limits don't interfere. */
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
}

async function requestLoginEmail(page: Page, email: string): Promise<string> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a login link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  return readLoginEmail(email);
}

test("logs in with the magic link from the email", async ({ page }) => {
  const text = await requestLoginEmail(page, uniqueEmail("link"));

  const link = text.match(/https?:\/\/[^\s)]+\/auth\/confirm\?token_hash=[^\s)]+/)?.[0];
  expect(link, "confirm link in the email").toBeTruthy();
  const url = new URL(link!);
  expect(url.searchParams.get("type")).toBe("email");

  await page.goto(url.pathname + url.search);
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole("heading", { name: "Join the game" })).toBeVisible();
});

test("logs in with the 6-digit code from the email", async ({ page }) => {
  const text = await requestLoginEmail(page, uniqueEmail("code"));

  const code = text.match(/code:\D*(\d{6})/)?.[1];
  expect(code, "6-digit code in the email").toBeTruthy();

  await page.getByLabel("6-digit code").fill(code!);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole("heading", { name: "Join the game" })).toBeVisible();
});
