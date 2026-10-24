import path from "node:path";
import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run the specs through scripts/e2e.sh.`);
  return value;
}

export const JOIN_CODE = "TEST42";

export type E2eUser = { key: string; email: string; displayName: string };

export const ADMIN = {
  key: "admin",
  email: "admin@e2e.test",
  displayName: "Admin E2E",
} as const satisfies E2eUser;

export const PLAYERS = [
  { key: "player1", email: "player1@e2e.test", displayName: "Alice E2E" },
  { key: "player2", email: "player2@e2e.test", displayName: "Bob E2E" },
  { key: "player3", email: "player3@e2e.test", displayName: "Carol E2E" },
] as const satisfies readonly E2eUser[];

export const ALL_USERS: readonly E2eUser[] = [ADMIN, ...PLAYERS];

/** Saved storageState (session cookies) for a user, written by global setup. */
export function storageStatePath(user: E2eUser): string {
  return path.join(__dirname, ".auth", `${user.key}.json`);
}

/** Supabase admin client using the local secret key. e2e only. */
export function supabaseAdmin() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Mints a one-time login link for `email` without sending an email. The
 * returned path goes through the app's own /auth/confirm route, like the link
 * in the magic-link email does.
 */
export async function confirmPathFor(email: string): Promise<string> {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;
  const tokenHash = data.properties.hashed_token;
  // generateLink reports `signup` for new users and `magiclink` for existing
  // ones. verifyOtp's `email` type accepts both, and it is what the email
  // template links use.
  return `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=email&next=/`;
}

/** A cycle check: every pair's target is the next pair's assassin, ending where it began. */
export function assertSingleCycle(pairs: { assassin: string; target: string }[]): void {
  const next = new Map(pairs.map((p) => [p.assassin, p.target]));
  if (next.size !== pairs.length) throw new Error("an assassin appears twice in the ring");
  const start = pairs[0].assassin;
  let current = start;
  for (let i = 0; i < pairs.length; i++) {
    const target = next.get(current);
    if (target === undefined) throw new Error(`${current} has no target in the ring`);
    if (target === current) throw new Error(`${current} targets themself`);
    current = target;
    if (current === start && i !== pairs.length - 1) {
      throw new Error(`the ring closes after ${i + 1} of ${pairs.length} pairs`);
    }
  }
  if (current !== start) throw new Error("the ring does not close into a cycle");
}

/** A page in a fresh context logged in as `user` (cookies from global setup). */
export async function pageFor(browser: Browser, user: E2eUser): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStatePath(user) });
  return context.newPage();
}

/**
 * Creates a game through the admin console and returns its id, read from the
 * game page the create action redirects to.
 */
export async function createGame(admin: Page, name: string, joinCode: string): Promise<string> {
  await admin.goto("/admin");
  await admin.getByRole("button", { name: "New game" }).click();
  await admin.getByLabel("Name").fill(name);
  await admin.getByLabel("Join code").fill(joinCode);
  await admin.getByRole("button", { name: "Create game" }).click();
  await admin.waitForURL(/\/admin\/games\/[^/]+\/leaderboard$/);
  await expect(admin.getByRole("heading", { level: 1, name })).toBeVisible();
  return decodeURIComponent(new URL(admin.url()).pathname.split("/")[3]);
}

/** The game's join link as shown to the admin, as a same-origin path. */
export async function readJoinLinkPath(admin: Page, gameId: string): Promise<string> {
  await admin.goto(`/admin/games/${gameId}/settings`);
  const link = await admin.getByTestId("join-link").inputValue();
  return new URL(link).pathname;
}

export type Pair = { assassin: string; target: string };

/** The current ring as shown by the "Current target" column of the admin players tab. */
export async function readRing(admin: Page, gameId: string): Promise<Pair[]> {
  await admin.goto(`/admin/games/${gameId}/players`);
  const rows = admin.getByTestId("player-row");
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  const pairs: Pair[] = [];
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const eye = row.getByRole("button", { name: /^Hold to show target of / });
    if ((await eye.count()) === 0) continue; // no current target
    const assassin = (await row.locator("td").first().textContent())!.trim();
    // Targets show only while the eye is held (waits for hydration, like revealTarget).
    await eye.hover();
    const name = row.getByTestId("admin-player-target");
    await expect(async () => {
      if ((await name.count()) === 0) {
        await admin.mouse.up();
        await admin.mouse.down();
      }
      await expect(name).toBeVisible({ timeout: 1000 });
    }).toPass();
    pairs.push({ assassin, target: (await name.textContent())!.trim() });
    await admin.mouse.up();
  }
  return pairs;
}

/** Fills every player's kill word in an open start dialog with random words. */
export async function fillRandomWords(admin: Page): Promise<void> {
  const dialog = admin.getByRole("dialog");
  await dialog.getByTestId("fill-random-words").click();
  const inputs = dialog.getByTestId("kill-word-assignment").getByRole("textbox");
  for (const input of await inputs.all()) await expect(input).not.toHaveValue("");
}

/** Generates the first ring of a game from the Round actions menu on the leaderboard tab. */
export async function generateRing(admin: Page, gameId: string): Promise<void> {
  await admin.goto(`/admin/games/${gameId}/leaderboard`);
  await admin.getByRole("button", { name: "Round actions" }).click();
  await admin.getByRole("menuitem", { name: "Generate ring" }).click();
  await fillRandomWords(admin);
  await admin.getByRole("button", { name: "Yes, generate" }).click();
  await expect(admin.getByTestId("game-status")).toHaveText("Active");
}

/** Asserts the target a player sees on their page for one game. */
/** Picks a kill method in the "Kill method" select inside `scope`. */
export async function selectMethod(scope: Page | Locator, name = "Clamp", points = 10): Promise<void> {
  await scope.getByRole("combobox", { name: "Kill method" }).click();
  await scope.getByRole("option", { name: `${name} (${points} pts)` }).click();
}

/** Registers a kill from a row or player page: open the form, pick a method, confirm. */
export async function registerKill(scope: Page | Locator, name = "Clamp", points = 10): Promise<void> {
  await scope.getByRole("button", { name: "Register kill" }).click();
  await selectMethod(scope, name, points);
  // The admin form opens in a dialog, so the row's icon button is still in the tree.
  await scope.getByRole("button", { name: "Register kill" }).last().click();
}

/**
 * Targets show only while the eye is held: press and leave the mouse down until
 * the name shows (waits for hydration). Call `releaseTarget` when done.
 */
export async function revealTarget(page: Page): Promise<void> {
  const toggle = page.getByTestId("target-toggle");
  if ((await toggle.count()) === 0) return;
  await toggle.hover();
  await expect(async () => {
    if ((await page.getByTestId("target-name-hidden").count()) > 0) {
      await page.mouse.up();
      await page.mouse.down();
    }
    await expect(page.getByTestId("target-name")).toBeVisible({ timeout: 1000 });
  }).toPass();
}

export async function releaseTarget(page: Page): Promise<void> {
  await page.mouse.up();
}

export async function expectTarget(page: Page, gameId: string, name: string): Promise<void> {
  await page.goto(`/${gameId}`);
  await revealTarget(page);
  await expect(page.getByTestId("target-name")).toHaveText(name);
  await releaseTarget(page);
}

/** Sets a new account's display name on /welcome, where first login lands, and waits for it to carry on. */
export async function setProfileName(page: Page, displayName: string): Promise<void> {
  await expect(page).toHaveURL(/\/welcome(\?|$)/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/welcome(\?|$)/);
}

/** Joins a game from its join page (`/join/CODE`), landing on the game page. */
export async function joinThroughLink(
  page: Page,
  joinPath: string,
  gameName: string,
  displayName: string,
): Promise<void> {
  await page.goto(joinPath);
  await expect(page.getByRole("heading", { name: `Join ${gameName}` })).toBeVisible();
  // The name comes from the profile, set once at first login.
  await expect(page.getByText(`You'll play as ${displayName}`)).toBeVisible();
  await page.getByRole("button", { name: "Join the game" }).click();
  await page.waitForURL(/:\d+\/[a-z0-9]+(-[a-z0-9]+)*$/);
  await expect(page.getByRole("heading", { level: 1, name: gameName })).toBeVisible();
}

type MailpitSearch = { messages: { ID: string }[] };
type MailpitDetail = { Text: string; HTML: string };

/** Polls Mailpit until the login email for `email` arrives and returns it. */
export async function readLoginEmail(email: string): Promise<MailpitDetail> {
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
  return (await res.json()) as MailpitDetail;
}

/** The magic link (href) in a login email, exactly as the template rendered it. */
export function magicLinkFrom(mail: MailpitDetail): URL {
  const href = mail.HTML.match(/href="([^"]*\/auth\/confirm\?[^"]*)"/)?.[1];
  if (!href) throw new Error(`no /auth/confirm link in the email:\n${mail.HTML}`);
  return new URL(href.replaceAll("&amp;", "&"));
}

/** The 6-digit code in a login email. */
export function loginCodeFrom(mail: MailpitDetail): string {
  const code = mail.Text.match(/code:\D*(\d{6})/)?.[1];
  if (!code) throw new Error(`no 6-digit code in the email:\n${mail.Text}`);
  return code;
}

/** A fresh address per test, so earlier runs' emails and rate limits don't interfere. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
}

/** Submits the login form's email step, from whichever /login URL the page is on. */
export async function requestLoginEmail(page: Page, email: string): Promise<MailpitDetail> {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a login link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  return readLoginEmail(email);
}

/**
 * Sets a player's status straight in the database. There is no kill feature
 * yet, so this is the only way to get a DEAD player. e2e only.
 */
export async function setPlayerStatusInDb(
  gameId: string,
  displayName: string,
  status: "ALIVE" | "DEAD" | "REMOVED",
): Promise<void> {
  const client = new Client({ connectionString: env("E2E_DATABASE_URL") });
  await client.connect();
  try {
    const res = await client.query(
      "update game.player set status = $1 where game_id = $2 and display_name = $3",
      [status, gameId, displayName],
    );
    if (res.rowCount !== 1) throw new Error(`expected to update one player, got ${res.rowCount}`);
  } finally {
    await client.end();
  }
}
