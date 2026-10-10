import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN,
  assertSingleCycle,
  expectTarget,
  JOIN_CODE,
  joinThroughLink,
  pageFor,
  PLAYERS,
  readJoinLinkPath,
  readRing,
  type Pair,
} from "./support";

const GAME_NAME = "E2E Game";

// Each step builds on the previous one's game state.
test.describe.configure({ mode: "serial" });

let admin: Page;
const players = new Map<string, Page>();
let gameId: string;
let joinPath: string;
let ringAfterShakeup: Pair[];

test.beforeAll(async ({ browser }) => {
  admin = await pageFor(browser, ADMIN);
  for (const p of PLAYERS) players.set(p.displayName, await pageFor(browser, p));
});

test.afterAll(async () => {
  await admin?.context().close();
  for (const page of players.values()) await page.context().close();
});

test("admin creates game TEST42 and gets its join link", async () => {
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { level: 1, name: "Games" })).toBeVisible();
  await admin.getByLabel("Name").fill(GAME_NAME);
  await admin.getByLabel("Join code").fill(JOIN_CODE.toLowerCase());
  await admin.getByRole("button", { name: "Create game" }).click();

  await admin.waitForURL(/\/admin\/games\/[^/]+$/);
  gameId = new URL(admin.url()).pathname.split("/").pop()!;
  await expect(admin.getByRole("heading", { level: 1, name: GAME_NAME })).toBeVisible();
  await expect(admin.getByTestId("game-status")).toHaveText("Setup");
  await expect(admin.getByTestId("join-code")).toHaveText(JOIN_CODE);
  await expect(admin.getByTestId("signups-state")).toHaveText("open");
  await expect(admin.getByTestId("join-link")).toHaveValue(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/join/${JOIN_CODE}`,
  );

  joinPath = await readJoinLinkPath(admin, gameId);
  expect(joinPath).toBe(`/join/${JOIN_CODE}`);

  await admin.goto("/admin");
  const row = admin.getByTestId("game-row").filter({ hasText: GAME_NAME });
  await expect(row).toContainText(JOIN_CODE);
  await expect(row.getByTestId("game-status")).toHaveText("Setup");
});

test("a wrong join code is rejected", async () => {
  const page = players.get(PLAYERS[0].displayName)!;
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "Join a game" })).toBeVisible();
  await page.getByLabel("Join code").fill("WRONG99");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/join\/WRONG99$/);
  // Next's route announcer is also role=alert, so match the message itself.
  await expect(
    page.getByRole("alert").filter({ hasText: "This join link isn't valid." }),
  ).toBeVisible();
  await expect(page.getByLabel("Display name")).toHaveCount(0);
});

test("a player joins by typing the code on /join", async () => {
  const p = PLAYERS[0];
  const page = players.get(p.displayName)!;
  await page.goto("/join");
  await page.getByLabel("Join code").fill(JOIN_CODE.toLowerCase());
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(new RegExp(`/join/${JOIN_CODE}$`));
  await expect(page.getByRole("heading", { name: `Join ${GAME_NAME}` })).toBeVisible();
  await page.getByLabel("Display name").fill(p.displayName);
  await page.getByRole("button", { name: "Join the game" }).click();

  await expect(page).toHaveURL(new RegExp(`/games/${gameId}$`));
  await expect(page.getByRole("heading", { level: 1, name: GAME_NAME })).toBeVisible();
  await expect(page.getByTestId("player-name")).toHaveText(p.displayName);
  await expect(page.getByTestId("player-status")).toHaveText(/waiting for the game to start/);
  await expect(page.getByTestId("target-name")).toHaveText("No target yet");
});

test("the other players join through the join link", async () => {
  for (const p of PLAYERS.slice(1)) {
    await joinThroughLink(players.get(p.displayName)!, joinPath, GAME_NAME, p.displayName);
  }

  // Opening the link again after joining goes straight to the game page.
  const page = players.get(PLAYERS[1].displayName)!;
  await page.goto(joinPath);
  await expect(page).toHaveURL(new RegExp(`/games/${gameId}$`));

  await admin.goto(`/admin/games/${gameId}/players`);
  await expect(admin.getByRole("heading", { name: "Players" })).toBeVisible();
  await expect(admin.getByTestId("player-row")).toHaveCount(3);
});

test("a player's home lists the game", async () => {
  const p = PLAYERS[0];
  const page = players.get(p.displayName)!;
  await page.goto("/");
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("heading", { level: 1, name: "My games" })).toBeVisible();
  // Other specs (claims, kills) leave games behind for the same players, so scope to this spec's game.
  const card = page.getByTestId("my-game").filter({ hasText: GAME_NAME });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(`Playing as ${p.displayName}`);
  await card.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/games/${gameId}$`));
});

test("admin generates a ring that forms a single cycle", async () => {
  await admin.goto(`/admin/games/${gameId}/rings`);
  await expect(admin.getByRole("heading", { name: "No ring yet" })).toBeVisible();
  await admin.getByRole("button", { name: "Generate ring" }).click();
  await admin.getByRole("button", { name: "Yes, generate" }).click();

  await expect(admin.getByRole("heading", { name: /allocation 1 \(Initial\)/ })).toBeVisible();
  await expect(admin.getByTestId("ring-pair")).toHaveCount(3);
  await expect(admin.getByTestId("game-status")).toHaveText("Active");

  const ring = await readRing(admin, gameId);
  expect(new Set(ring.map((p) => p.assassin))).toEqual(
    new Set(PLAYERS.map((p) => p.displayName)),
  );
  assertSingleCycle(ring);
});

test("each player's target matches the admin ring", async () => {
  const ring = await readRing(admin, gameId);
  for (const { assassin, target } of ring) {
    await expectTarget(players.get(assassin)!, gameId, target);
  }
});

test("a shakeup shows round 2 in the history", async () => {
  await admin.goto(`/admin/games/${gameId}/rings`);
  await admin.getByRole("button", { name: "Shake up" }).click();
  await admin.getByRole("button", { name: "Yes, shake up" }).click();

  await expect(admin.getByRole("heading", { name: /allocation 2 \(Shakeup\)/ })).toBeVisible();
  const rounds = admin.getByTestId("round-row");
  await expect(rounds).toHaveCount(2);
  await expect(rounds.nth(0)).toContainText("Shakeup");
  await expect(rounds.nth(1)).toContainText("Initial");

  ringAfterShakeup = await readRing(admin, gameId);
  expect(ringAfterShakeup).toHaveLength(3);
  assertSingleCycle(ringAfterShakeup);
  for (const { assassin, target } of ringAfterShakeup) {
    await expectTarget(players.get(assassin)!, gameId, target);
  }
});

test("removing a player splices them out of the ring", async () => {
  const victim = PLAYERS[1].displayName;
  const victimsAssassin = ringAfterShakeup.find((p) => p.target === victim)!.assassin;
  const victimsTarget = ringAfterShakeup.find((p) => p.assassin === victim)!.target;

  await admin.goto(`/admin/games/${gameId}/players`);
  // Filter on the email: the display name also appears as another row's target.
  const row = admin.getByTestId("player-row").filter({ hasText: PLAYERS[1].email });
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(row).toContainText(`Their assassin will inherit their target, ${victimsTarget}.`);
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(row).toContainText("REMOVED");
  await expect(row.getByRole("button", { name: "Restore" })).toBeVisible();

  const ring = await readRing(admin, gameId);
  expect(ring).toHaveLength(2);
  assertSingleCycle(ring);
  expect(ring).toContainEqual({ assassin: victimsAssassin, target: victimsTarget });
  expect(ring.flatMap((p) => [p.assassin, p.target])).not.toContain(victim);

  await expectTarget(players.get(victimsAssassin)!, gameId, victimsTarget);
  await expectTarget(players.get(victim)!, gameId, "No target yet");
});

test("a non-admin gets 404 on /admin", async () => {
  const page = players.get(PLAYERS[0].displayName)!;
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  const gamePage = await page.goto(`/admin/games/${gameId}`);
  expect(gamePage?.status()).toBe(404);
});
