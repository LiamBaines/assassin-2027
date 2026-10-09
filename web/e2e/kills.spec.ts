import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN,
  createGame,
  expectTarget,
  generateRing,
  joinThroughLink,
  pageFor,
  PLAYERS,
  readJoinLinkPath,
  readRing,
} from "./support";

// The admin registers kills from the players page. Each step builds on the previous one's game state.
test.describe.configure({ mode: "serial" });

const GAME = { name: "Kills Game", code: "KILLS01" };
const VICTIM = PLAYERS[1].displayName;

let admin: Page;
const pages = new Map<string, Page>();
let gameId: string;
let killer: string;
let inherited: string;

test.beforeAll(async ({ browser }) => {
  admin = await pageFor(browser, ADMIN);
  for (const p of PLAYERS) pages.set(p.displayName, await pageFor(browser, p));
});

test.afterAll(async () => {
  await admin?.context().close();
  for (const page of pages.values()) await page.context().close();
});

/** The row whose first (name) cell is exactly `name`; another row can show it as its current target. */
function playerRow(name: string) {
  return admin.getByTestId("player-row").filter({
    has: admin.locator("td:first-child").getByText(name, { exact: true }),
  });
}

/** Registers a kill from the players page: the button, then its confirm step. */
async function registerKill(name: string): Promise<void> {
  await admin.goto(`/admin/games/${gameId}/players`);
  const row = playerRow(name);
  await row.getByRole("button", { name: "Register kill" }).click();
  await row.getByRole("button", { name: "Register kill" }).last().click();
}

test("there is no kill button before the game starts", async () => {
  gameId = await createGame(admin, GAME.name, GAME.code);
  const joinPath = await readJoinLinkPath(admin, gameId);
  for (const p of PLAYERS) {
    await joinThroughLink(pages.get(p.displayName)!, joinPath, GAME.name, p.displayName);
  }
  await admin.goto(`/admin/games/${gameId}/players`);
  await expect(admin.getByTestId("player-row")).toHaveCount(3);
  await expect(admin.getByRole("button", { name: "Register kill" })).toHaveCount(0);
});

test("registering a kill kills the victim and gives their target to their assassin", async () => {
  await generateRing(admin, gameId);
  const ring = await readRing(admin, gameId);
  killer = ring.find((pair) => pair.target === VICTIM)!.assassin;
  inherited = ring.find((pair) => pair.assassin === VICTIM)!.target;

  await registerKill(VICTIM);

  await expect(playerRow(VICTIM)).toContainText("DEAD");
  await expect(playerRow(VICTIM).getByRole("button", { name: "Register kill" })).toHaveCount(0);
  await expect(playerRow(killer)).toContainText(inherited);
  await expectTarget(pages.get(killer)!, gameId, inherited);
});

test("the kill that leaves one player ends the game", async () => {
  await registerKill(inherited);

  await expect(playerRow(inherited)).toContainText("DEAD");
  await admin.goto(`/admin/games/${gameId}`);
  await expect(admin.getByTestId("game-status")).toContainText("Finished");
  await admin.goto(`/admin/games/${gameId}/players`);
  await expect(admin.getByRole("button", { name: "Register kill" })).toHaveCount(0);
});
