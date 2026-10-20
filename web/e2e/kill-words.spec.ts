import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN,
  createGame,
  fillRandomWords,
  joinThroughLink,
  pageFor,
  PLAYERS,
  readJoinLinkPath,
  readRing,
  registerKill,
} from "./support";

// Death Sentence kill words: admin list, allocation at ring generation, player reveal, burn on kill.
test.describe.configure({ mode: "serial" });

const GAME = { name: "Kill Words Game", code: "KWORD01" };
const CUSTOM_WORD = "purple elephant";
const ASSASSIN = PLAYERS[0].displayName;

let admin: Page;
const pages = new Map<string, Page>();
let gameId: string;

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

test("the admin adds a word to the list", async () => {
  gameId = await createGame(admin, GAME.name, GAME.code);
  const joinPath = await readJoinLinkPath(admin, gameId);
  for (const p of PLAYERS) {
    await joinThroughLink(pages.get(p.displayName)!, joinPath, GAME.name, p.displayName);
  }

  await admin.goto(`/admin/games/${gameId}/kill-words`);
  await admin.getByTestId("kill-words-input").fill(CUSTOM_WORD);
  await admin.getByRole("button", { name: "Add words" }).click();
  const row = admin.getByTestId("kill-word-row").filter({ hasText: CUSTOM_WORD });
  await expect(row).toContainText("Unused");
});

test("generating the ring gives every player a word, including the chosen one", async () => {
  await admin.goto(`/admin/games/${gameId}/leaderboard`);
  await admin.getByRole("button", { name: "Round actions" }).click();
  await admin.getByRole("menuitem", { name: "Generate ring" }).click();
  await fillRandomWords(admin);
  await admin.getByLabel(`Kill word for ${ASSASSIN}`).fill(CUSTOM_WORD);
  await admin.getByRole("button", { name: "Yes, generate" }).click();
  await expect(admin.getByTestId("game-status")).toHaveText("Active");

  await admin.goto(`/admin/games/${gameId}/kill-words`);
  await expect(admin.getByTestId("kill-word-row")).toHaveCount(3);
  await expect(admin.getByTestId("kill-word-row").filter({ hasText: CUSTOM_WORD })).toContainText("Allocated");
  await expect(admin.getByTestId("kill-word-row").filter({ hasText: CUSTOM_WORD })).toContainText(ASSASSIN);

  await admin.goto(`/admin/games/${gameId}/players`);
  await expect(playerRow(ASSASSIN).getByTestId("player-kill-word")).toHaveText(CUSTOM_WORD);
});

test("the assassin sees their word only while holding the eye", async () => {
  const page = pages.get(ASSASSIN)!;
  await page.goto(`/${gameId}`);
  await expect(page.getByTestId("kill-word-hidden")).toBeVisible();
  await expect(page.getByTestId("kill-word")).toHaveCount(0);

  await page.getByTestId("kill-word-toggle").hover();
  await expect(async () => {
    if ((await page.getByTestId("kill-word-hidden").count()) > 0) {
      await page.mouse.up();
      await page.mouse.down();
    }
    await expect(page.getByTestId("kill-word")).toHaveText(CUSTOM_WORD, { timeout: 1000 });
  }).toPass();
  await page.mouse.up();
  await expect(page.getByTestId("kill-word-hidden")).toBeVisible();
});

test("a Death Sentence kill burns the assassin's word", async () => {
  const ring = await readRing(admin, gameId);
  const victim = ring.find((pair) => pair.assassin === ASSASSIN)!.target;

  await admin.goto(`/admin/games/${gameId}/players`);
  await registerKill(playerRow(victim), "Death Sentence", 10);
  await expect(playerRow(victim)).toContainText("Dead");

  await expect(playerRow(ASSASSIN).getByTestId("player-kill-word")).toContainText("(used)");
  await admin.goto(`/admin/games/${gameId}/kill-words`);
  await expect(admin.getByTestId("kill-word-row").filter({ hasText: CUSTOM_WORD })).toContainText("Used");

  const page = pages.get(ASSASSIN)!;
  await page.goto(`/${gameId}`);
  await expect(page.getByTestId("kill-word-used")).toBeVisible();
  await expect(page.getByTestId("kill-word")).toHaveCount(0);
});
