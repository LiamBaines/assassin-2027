import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  ADMIN,
  assertSingleCycle,
  JOIN_CODE,
  PLAYERS,
  storageStatePath,
  type E2eUser,
} from "./support";

type Pair = { assassin: string; target: string };

// Each step builds on the previous one's game state.
test.describe.configure({ mode: "serial" });

async function pageFor(browser: Browser, user: E2eUser): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStatePath(user) });
  return context.newPage();
}

/** The current ring as shown on /admin/rings, in display order. */
async function readRing(admin: Page): Promise<Pair[]> {
  await admin.goto("/admin/rings");
  const rows = admin.getByTestId("ring-pair");
  await expect(rows.first()).toBeVisible();
  return rows.evaluateAll((els) =>
    els.map((el) => ({
      assassin: el.querySelector('[data-role="assassin"]')!.textContent!.trim(),
      target: el.querySelector('[data-role="target"]')!.textContent!.trim(),
    })),
  );
}

async function expectTarget(page: Page, name: string): Promise<void> {
  await page.goto("/target");
  await expect(page.getByTestId("target-name")).toHaveText(name);
}

let admin: Page;
const players = new Map<string, Page>();
let ringAfterShakeup: Pair[];

test.beforeAll(async ({ browser }) => {
  admin = await pageFor(browser, ADMIN);
  for (const p of PLAYERS) players.set(p.displayName, await pageFor(browser, p));
});

test.afterAll(async () => {
  await admin?.context().close();
  for (const page of players.values()) await page.context().close();
});

test("admin creates game TEST42", async () => {
  await admin.goto("/admin");
  await admin.getByLabel("Name").fill("E2E Game");
  await admin.getByLabel("Join code").fill(JOIN_CODE.toLowerCase());
  await admin.getByRole("button", { name: "Create game" }).click();

  await expect(admin.getByRole("heading", { name: "Details" })).toBeVisible();
  await expect(admin.getByText("Setup — no ring yet")).toBeVisible();
  await expect(admin.getByLabel("Join code")).toHaveValue(JOIN_CODE);
  await expect(admin.getByTestId("signups-state")).toHaveText("open");
});

test("a wrong join code is rejected", async () => {
  const page = players.get(PLAYERS[0].displayName)!;
  await page.goto("/join");
  await page.getByLabel("Display name").fill(PLAYERS[0].displayName);
  await page.getByLabel("Join code").fill("WRONG99");
  await page.getByRole("button", { name: "Join the game" }).click();

  // Next's route announcer is also role=alert, so match the message itself.
  await expect(page.getByRole("alert").filter({ hasText: "join code" })).toHaveText(
    /That join code isn't right/,
  );
  await expect(page).toHaveURL(/\/join$/);
});

test("three players join", async () => {
  for (const p of PLAYERS) {
    const page = players.get(p.displayName)!;
    await page.goto("/join");
    await page.getByLabel("Display name").fill(p.displayName);
    await page.getByLabel("Join code").fill(JOIN_CODE);
    await page.getByRole("button", { name: "Join the game" }).click();

    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole("heading", { name: p.displayName })).toBeVisible();
    await expect(page.getByTestId("player-status")).toHaveText(/waiting for the game to start/);
  }

  await admin.goto("/admin/players");
  await expect(admin.getByTestId("player-row")).toHaveCount(3);
});

test("admin generates a ring that forms a single cycle", async () => {
  await admin.goto("/admin/rings");
  await expect(admin.getByRole("heading", { name: "No ring yet" })).toBeVisible();
  await admin.getByRole("button", { name: "Generate ring" }).click();
  await admin.getByRole("button", { name: "Yes, generate" }).click();

  await expect(admin.getByRole("heading", { name: /round 1 \(Initial\)/ })).toBeVisible();
  await expect(admin.getByTestId("ring-pair")).toHaveCount(3);

  const ring = await readRing(admin);
  expect(new Set(ring.map((p) => p.assassin))).toEqual(
    new Set(PLAYERS.map((p) => p.displayName)),
  );
  assertSingleCycle(ring);
});

test("each player's target matches the admin ring", async () => {
  const ring = await readRing(admin);
  for (const { assassin, target } of ring) {
    await expectTarget(players.get(assassin)!, target);
  }
});

test("a shakeup shows round 2 in the history", async () => {
  await admin.goto("/admin/rings");
  await admin.getByRole("button", { name: "Shake up" }).click();
  await admin.getByRole("button", { name: "Yes, shake up" }).click();

  await expect(admin.getByRole("heading", { name: /round 2 \(Shakeup\)/ })).toBeVisible();
  const rounds = admin.getByTestId("round-row");
  await expect(rounds).toHaveCount(2);
  await expect(rounds.nth(0)).toContainText("Shakeup");
  await expect(rounds.nth(1)).toContainText("Initial");

  ringAfterShakeup = await readRing(admin);
  expect(ringAfterShakeup).toHaveLength(3);
  assertSingleCycle(ringAfterShakeup);
  for (const { assassin, target } of ringAfterShakeup) {
    await expectTarget(players.get(assassin)!, target);
  }
});

test("removing a player splices them out of the ring", async () => {
  const victim = PLAYERS[1].displayName;
  const victimsAssassin = ringAfterShakeup.find((p) => p.target === victim)!.assassin;
  const victimsTarget = ringAfterShakeup.find((p) => p.assassin === victim)!.target;

  await admin.goto("/admin/players");
  // Filter on the email: the display name also appears as another row's target.
  const row = admin.getByTestId("player-row").filter({ hasText: PLAYERS[1].email });
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(row).toContainText(`Their assassin will inherit their target, ${victimsTarget}.`);
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(row).toContainText("REMOVED");
  await expect(row.getByRole("button", { name: "Restore" })).toBeVisible();

  const ring = await readRing(admin);
  expect(ring).toHaveLength(2);
  assertSingleCycle(ring);
  expect(ring).toContainEqual({ assassin: victimsAssassin, target: victimsTarget });
  expect(ring.flatMap((p) => [p.assassin, p.target])).not.toContain(victim);

  await expectTarget(players.get(victimsAssassin)!, victimsTarget);
  await expectTarget(players.get(victim)!, "No target yet");
});

test("a non-admin gets 404 on /admin", async () => {
  const page = players.get(PLAYERS[0].displayName)!;
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
});
