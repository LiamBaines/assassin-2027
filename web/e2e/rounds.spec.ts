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

/** One leaderboard row per player name, read from the page's table. */
async function readLeaderboard(page: Page, path: string, view: string) {
  await page.goto(path);
  await page.getByTestId("leaderboard-view").filter({ hasText: new RegExp(`^${view}$`) }).click();
  await expect(page.getByTestId("leaderboard-view").filter({ hasText: new RegExp(`^${view}$`) })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const rows = await page.getByTestId("leaderboard-row").evaluateAll((els) =>
    els.map((el) => {
      const text = (id: string) => el.querySelector(`[data-testid="${id}"]`)!.textContent!.trim();
      return {
        rank: Number(text("lb-rank")),
        name: text("lb-name"),
        points: Number(text("lb-points")),
        kills: Number(text("lb-kills")),
        deaths: Number(text("lb-deaths")),
      };
    }),
  );
  return new Map(rows.map((r) => [r.name, r]));
}

test("the leaderboard totals points across both rounds", async () => {
  // A kill in round 2: the late joiner dies.
  await admin.goto(`/admin/games/${gameId}/players`);
  const row = playerRow(LATE);
  await row.getByRole("button", { name: "Register kill" }).click();
  await row.getByRole("button", { name: "Register kill" }).last().click();
  await expect(playerRow(LATE)).toContainText("DEAD");

  const adminPath = `/admin/games/${gameId}/leaderboard`;
  const playerPath = `/games/${gameId}/leaderboard`;

  // Round 1: two kills and two deaths. The survivor killed the dropped player, so they lead.
  const r1 = await readLeaderboard(admin, adminPath, "Round 1");
  expect(r1.size).toBe(4);
  expect(r1.get(victim)!.deaths).toBe(1);
  expect(r1.get(dropped)!.deaths).toBe(1);
  expect(r1.get(survivor)!.deaths).toBe(0);
  expect([...r1.values()].reduce((n, e) => n + e.kills, 0)).toBe(2);
  expect(r1.get(survivor)!.rank).toBe(1);
  expect(r1.get(LATE)).toMatchObject({ points: 0, kills: 0, deaths: 0 });

  // Round 2: one kill, one death.
  const r2 = await readLeaderboard(admin, adminPath, "Round 2");
  expect(r2.get(LATE)).toMatchObject({ points: -5, kills: 0, deaths: 1 });
  expect([...r2.values()].reduce((n, e) => n + e.kills, 0)).toBe(1);
  expect([...r2.values()].reduce((n, e) => n + e.points, 0)).toBe(5);

  // Total: each entry is the sum of its two rounds.
  const total = await readLeaderboard(admin, adminPath, "Total");
  for (const [name, e] of total) {
    expect(e.points).toBe(r1.get(name)!.points + r2.get(name)!.points);
    expect(e.kills).toBe(r1.get(name)!.kills + r2.get(name)!.kills);
    expect(e.deaths).toBe(r1.get(name)!.deaths + r2.get(name)!.deaths);
  }

  // Players see the same table.
  const seen = await readLeaderboard(pages.get(survivor)!, playerPath, "Total");
  expect([...seen.values()]).toEqual([...total.values()]);
});
