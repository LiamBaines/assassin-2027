import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN,
  createGame,
  loginCodeFrom,
  magicLinkFrom,
  pageFor,
  readJoinLinkPath,
  requestLoginEmail,
  uniqueEmail,
} from "./support";

// A logged-out visitor opens a join link, logs in with a real login email
// (requested through the login form, read from Mailpit), lands back on the
// link and joins without typing the code.

const GAME_NAME = "Link Game";
const JOIN_CODE = "LINK2027";

let joinPath: string;

test.beforeAll(async ({ browser }) => {
  const admin = await pageFor(browser, ADMIN);
  const gameId = await createGame(admin, GAME_NAME, JOIN_CODE);
  joinPath = await readJoinLinkPath(admin, gameId);
  await admin.context().close();
});

/** Opens the join link logged out and checks it sends us to /login with `next`. */
async function openJoinLinkLoggedOut(page: Page): Promise<void> {
  await page.goto(joinPath);
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(joinPath);
}

async function joinAndExpectGamePage(page: Page, displayName: string): Promise<void> {
  await expect(page.getByRole("heading", { name: `Join ${GAME_NAME}` })).toBeVisible();
  await page.getByLabel("Display name").fill(displayName);
  await page.getByRole("button", { name: "Join the game" }).click();
  await expect(page).toHaveURL(/\/games\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: GAME_NAME })).toBeVisible();
  await expect(page.getByTestId("player-name")).toHaveText(displayName);
}

test("the magic link from the email returns to the join link", async ({ page }) => {
  await openJoinLinkLoggedOut(page);
  const mail = await requestLoginEmail(page, uniqueEmail("joinlink"));

  // The template passes emailRedirectTo through as redirect_to, carrying `next`.
  const link = magicLinkFrom(mail);
  expect(link.pathname).toBe("/auth/confirm");
  const redirectTo = new URL(link.searchParams.get("redirect_to")!);
  expect(redirectTo.pathname).toBe("/auth/confirm");
  expect(redirectTo.searchParams.get("next")).toBe(joinPath);

  await page.goto(link.pathname + link.search);
  await expect(page).toHaveURL(new RegExp(`${joinPath}$`));
  await joinAndExpectGamePage(page, "Link Joiner");
});

test("the 6-digit code login returns to the join link", async ({ page }) => {
  await openJoinLinkLoggedOut(page);
  const mail = await requestLoginEmail(page, uniqueEmail("joincode"));

  await page.getByLabel("6-digit code").fill(loginCodeFrom(mail));
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(new RegExp(`${joinPath}$`));
  await joinAndExpectGamePage(page, "Code Joiner");
});
