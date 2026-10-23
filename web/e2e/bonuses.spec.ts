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

const GAME = { name: "Bonus Game", code: "BONUS01" };

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

async function award(player: string, points: string, reason: string, kill?: string): Promise<void> {
  await admin.goto(`/admin/games/${gameId}/bonuses`);
  await admin.getByTestId("award-bonus-open").click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Player" }).click();
  await admin.getByRole("option", { name: player, exact: true }).click();
  await dialog.getByTestId("bonus-points").fill(points);
  await dialog.getByTestId("bonus-reason").fill(reason);
  if (kill) {
    await dialog.getByRole("combobox", { name: "Linked kill (optional)" }).click();
    await admin.getByRole("option", { name: kill }).click();
  }
  await dialog.getByRole("button", { name: "Award points" }).click();
  await expect(dialog).toBeHidden();
}

function leaderboardRow(name: string) {
  return admin.getByTestId("leaderboard-row").filter({
    has: admin.getByTestId("lb-name").getByText(name, { exact: true }),
  });
}

test("an ad hoc and a kill-linked bonus are awarded and listed", async () => {
  gameId = await createGame(admin, GAME.name, GAME.code);
  const joinPath = await readJoinLinkPath(admin, gameId);
  for (const p of PLAYERS) {
    await joinThroughLink(pages.get(p.displayName)!, joinPath, GAME.name, p.displayName);
  }
  await generateRing(admin, gameId);
  const ring = await readRing(admin, gameId);
  killer = ring[0].assassin;
  victim = ring[0].target;

  await admin.goto(`/admin/games/${gameId}/players`);
  await registerKill(
    admin.getByTestId("player-row").filter({
      has: admin.locator("td:first-child").getByText(victim, { exact: true }),
    }),
    "Duel",
    15,
  );

  await award(victim, "5", "Best costume");
  await award(killer, "-2", "Broke the safe zone rule");
  await award(killer, "3", "Style points", `${killer} → ${victim}`);

  await admin.goto(`/admin/games/${gameId}/bonuses`);
  const rows = admin.getByTestId("bonus-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Style points");
  await expect(rows.first()).toContainText(`${killer} → ${victim}`);
  await expect(rows.last()).toContainText("Best costume");
});

test("the leaderboard shows a BP column", async () => {
  await admin.goto(`/admin/games/${gameId}/leaderboard`);
  await expect(leaderboardRow(victim).getByTestId("lb-bonus")).toHaveText("5");
  await expect(leaderboardRow(killer).getByTestId("lb-bonus")).toHaveText("1");
  // Points include bonuses: 15 for the duel + 1 net bonus.
  await expect(leaderboardRow(killer).getByTestId("lb-points")).toHaveText("16");
});

test("the log shows each bonus publicly", async () => {
  const other = pages.get(killer)!;
  await other.goto(`/${gameId}?view=log`);
  const items = other.getByTestId("event-item");
  await expect(items.first()).toContainText(
    `${killer} was awarded +3 bonus points (for the kill of ${victim}): Style points`,
  );
  await expect(items.filter({ hasText: `${killer} lost 2 bonus points: Broke the safe zone rule` })).toHaveCount(1);
  await expect(items.filter({ hasText: `${victim} was awarded +5 bonus points: Best costume` })).toHaveCount(1);
});

test("the player gets a read-only Admin message", async () => {
  const page = pages.get(victim)!;
  await page.goto(`/${gameId}`);
  await expect(page.getByTestId("inbox-unread")).toHaveText("1");
  await page.getByTestId("nav-inbox").click();
  await expect(page.getByTestId("thread-unread")).toContainText("1 unread");
  await page.getByTestId("inbox-thread-admin").click();
  await expect(
    page.getByTestId("message").filter({ hasText: "You were awarded +5 bonus points: Best costume." }),
  ).toBeVisible();
  await expect(page.getByTestId("message-body")).toHaveCount(0);
  await expect(page.getByTestId("inbox-unread")).toHaveCount(0);
});
