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
  registerKill,
} from "./support";

// Each step builds on the previous one's game state.
test.describe.configure({ mode: "serial" });

const GAME = { name: "Log Game", code: "LOG0001" };
const REMOVED = PLAYERS[1].displayName;

let admin: Page;
const pages = new Map<string, Page>();
let gameId: string;
let killer: string;
let victim: string;

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

test("joins and the round start are logged, newest first", async () => {
  gameId = await createGame(admin, GAME.name, GAME.code);
  const joinPath = await readJoinLinkPath(admin, gameId);
  for (const p of PLAYERS) {
    await joinThroughLink(pages.get(p.displayName)!, joinPath, GAME.name, p.displayName);
  }
  await generateRing(admin, gameId);

  await admin.goto(`/admin/games/${gameId}/log`);
  const items = admin.getByTestId("event-item");
  await expect(items).toHaveCount(4);
  await expect(items.first()).toContainText("Round 1 started with 3 players");
  await expect(items.last()).toContainText("joined the game");
});

test("a removal appears in the admin and player logs", async () => {
  await admin.goto(`/admin/games/${gameId}/players`);
  const row = admin.getByTestId("player-row").filter({ hasText: PLAYERS[1].email });
  await row.getByRole("button", { name: "Remove" }).click();
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(row).toContainText("Removed");

  await admin.goto(`/admin/games/${gameId}/log`);
  await expect(admin.getByTestId("event-item").first()).toContainText(
    `${REMOVED} was removed from the game`,
  );

  const other = pages.get(PLAYERS[0].displayName)!;
  await other.goto(`/games/${gameId}?view=log`);
  await expect(other.getByTestId("event-item").first()).toContainText(
    `${REMOVED} was removed from the game`,
  );
});

test("a kill appears at the top of the log with its method", async () => {
  const ring = await readRing(admin, gameId);
  killer = ring[0].assassin;
  victim = ring[0].target;

  await admin.goto(`/admin/games/${gameId}/players`);
  const row = playerRow(victim);
  await registerKill(row, "Duel", 15);
  await expect(playerRow(victim)).toContainText("Dead");

  const text = `${killer} killed ${victim} (Duel)`;
  await admin.goto(`/admin/games/${gameId}/log`);
  await expect(admin.getByTestId("event-item").first()).toContainText(text);

  const other = pages.get(killer)!;
  await other.goto(`/games/${gameId}?view=log`);
  await expect(other.getByTestId("event-item").first()).toContainText(text);
});
