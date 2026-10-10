import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN,
  createGame,
  generateRing,
  joinThroughLink,
  pageFor,
  PLAYERS,
  readJoinLinkPath,
  readRing,
} from "./support";

// Round 1 ends with a kill, then the admin starts round 2: a revived player, a late joiner and an unticked player.
test.describe.configure({ mode: "serial" });

const GAME = { name: "Rounds Game", code: "ROUND01" };
const LATE = "Late Larry";
const [victim, survivor, dropped] = PLAYERS.map((p) => p.displayName);

let admin: Page;
const pages = new Map<string, Page>();
let gameId: string;
let joinPath: string;

test.beforeAll(async ({ browser }) => {
  admin = await pageFor(browser, ADMIN);
  for (const p of PLAYERS) pages.set(p.displayName, await pageFor(browser, p));
});

test.afterAll(async () => {
  await admin?.context().close();
  for (const page of pages.values()) await page.context().close();
});

function playerRow(name: string) {
  return admin.getByTestId("player-row").filter({
    has: admin.locator("td:first-child").getByText(name, { exact: true }),
  });
}

test("round 1 ends with a winner after the kills", async () => {
  gameId = await createGame(admin, GAME.name, GAME.code);
  joinPath = await readJoinLinkPath(admin, gameId);
  for (const p of PLAYERS) {
    await joinThroughLink(pages.get(p.displayName)!, joinPath, GAME.name, p.displayName);
  }
  await generateRing(admin, gameId);
  await pages.get(victim)!.goto(`/games/${gameId}`);
  await expect(pages.get(victim)!.getByTestId("round-badge")).toHaveText("Round 1");

  // Kill the victim, then whoever is hunted by the next in line, until one player is left.
  for (const name of [victim, dropped]) {
    await admin.goto(`/admin/games/${gameId}/players`);
    const row = playerRow(name);
    await row.getByRole("button", { name: "Register kill" }).click();
    await row.getByRole("button", { name: "Register kill" }).last().click();
    await expect(playerRow(name)).toContainText("DEAD");
  }

  await admin.goto(`/admin/games/${gameId}/rings`);
  await expect(admin.getByRole("heading", { name: "Round 1 has ended" })).toBeVisible();
  await expect(admin.getByRole("button", { name: "Shake up" })).toHaveCount(0);
});

test("a late joiner waits on the bench", async () => {
  await joinThroughLink(admin, joinPath, GAME.name, LATE);
  await expect(admin.getByTestId("target-name")).toHaveText("No target yet");
});

test("starting round 2 revives, removes the unticked and includes the late joiner", async () => {
  await admin.goto(`/admin/games/${gameId}/rings`);
  await admin.getByRole("button", { name: "Start new round" }).click();
  const list = admin.getByTestId("round-players");
  await expect(list.locator("input[type=checkbox]:checked")).toHaveCount(4);
  await list.getByLabel(new RegExp(`^${dropped}`)).uncheck();
  await admin.getByRole("button", { name: "Start round 2" }).click();

  await expect(admin.getByRole("heading", { name: /Round 2 — allocation \d+ \(Initial\)/ })).toBeVisible();
  const ring = await readRing(admin, gameId);
  expect(ring.map((p) => p.assassin).sort()).toEqual([victim, survivor, LATE].sort());

  await admin.goto(`/admin/games/${gameId}/players`);
  await expect(playerRow(victim)).toContainText("ALIVE");
  await expect(playerRow(LATE)).toContainText("ALIVE");
  await expect(playerRow(dropped)).toContainText("REMOVED");
});

test("players see Round 2, and past round 1", async () => {
  const page = pages.get(victim)!;
  await page.goto(`/games/${gameId}`);
  await expect(page.getByTestId("round-badge")).toHaveText("Round 2");
  await expect(page.getByTestId("target-name")).not.toHaveText("No target yet");
  await expect(page.getByTestId("past-round")).toHaveCount(1);
  await expect(page.getByTestId("past-round")).toContainText("Round 1");

  const out = pages.get(dropped)!;
  await out.goto(`/games/${gameId}`);
  await expect(out.getByTestId("round-badge")).toHaveText("Round 2");
  await expect(out.getByTestId("target-name")).toHaveText("No target yet");
});
