import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN,
  createGame,
  generateRing,
  joinThroughLink,
  pageFor,
  PLAYERS,
  readJoinLinkPath,
  setPlayerStatusInDb,
} from "./support";

// The players roster: every player in a started game sees everyone's name and status.
test.describe.configure({ mode: "serial" });

const GAME = { name: "Roster Game", code: "ROSTER1" };
const LATE = "Dave Late";
const [alice, bob, carol] = PLAYERS;

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

/** The roster as `[name, status]` rows, in display order. */
async function readRoster(page: Page): Promise<string[][]> {
  await page.goto(`/games/${gameId}`);
  const rows = page.getByTestId("roster-row");
  await expect(rows.first()).toBeVisible();
  return rows.evaluateAll((els) =>
    els.map((el) => [
      el.children[0].textContent!.trim(),
      el.querySelector('[data-testid="roster-status"]')!.textContent!.trim(),
    ]),
  );
}

test("there is no Players card before the game starts", async () => {
  gameId = await createGame(admin, GAME.name, GAME.code);
  joinPath = await readJoinLinkPath(admin, gameId);
  for (const p of PLAYERS) {
    await joinThroughLink(pages.get(p.displayName)!, joinPath, GAME.name, p.displayName);
  }

  const page = pages.get(alice.displayName)!;
  await page.goto(`/games/${gameId}`);
  await expect(page.getByTestId("target-name")).toHaveText("No target yet");
  await expect(page.getByRole("heading", { name: "Players" })).toHaveCount(0);
  await expect(page.getByTestId("roster-row")).toHaveCount(0);
});

test("after the ring is generated, a player sees everyone alive and nothing identifying", async () => {
  await generateRing(admin, gameId);

  const page = pages.get(alice.displayName)!;
  expect(await readRoster(page)).toEqual([
    [alice.displayName, "Alive"],
    [bob.displayName, "Alive"],
    [carol.displayName, "Alive"],
  ]);

  const html = await page.content();
  expect(html).not.toContain("@e2e.test");
  await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();
});

test("a dead player shows as dead on every player's page", async () => {
  await setPlayerStatusInDb(gameId, bob.displayName, "DEAD");

  for (const p of PLAYERS) {
    expect(await readRoster(pages.get(p.displayName)!)).toEqual([
      [alice.displayName, "Alive"],
      [bob.displayName, "Dead"],
      [carol.displayName, "Alive"],
    ]);
  }
});

test("a player who joins after the start shows as waiting", async () => {
  // The admin's account plays too: the e2e users are all in the game already.
  await joinThroughLink(admin, joinPath, GAME.name, LATE);

  const page = pages.get(carol.displayName)!;
  expect(await readRoster(page)).toEqual([
    [alice.displayName, "Alive"],
    [bob.displayName, "Dead"],
    [carol.displayName, "Alive"],
    [LATE, "Waiting"],
  ]);

  // The late joiner sees the same roster, including themself.
  expect(await readRoster(admin)).toHaveLength(4);
  await expect(admin.getByTestId("target-name")).toHaveText("No target yet");
});
