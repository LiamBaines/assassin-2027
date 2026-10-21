import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN,
  createGame,
  fillRandomWords,
  joinThroughLink,
  pageFor,
  PLAYERS,
  readJoinLinkPath,
} from "./support";

// Names are chosen once per account and may collide. The admin can rename a player in one game, and a ring can't
// be generated while two players share a name: the admin renames them from the error dialog and tries again.
test.describe.configure({ mode: "serial" });

const GAME = { name: "Duplicate Names Game", code: "DUPES01" };
const [alice, bob] = PLAYERS;

let admin: Page;
const pages = new Map<string, Page>();
let gameId: string;

test.beforeAll(async ({ browser }) => {
  admin = await pageFor(browser, ADMIN);
  for (const p of [alice, bob]) pages.set(p.displayName, await pageFor(browser, p));
});

test.afterAll(async () => {
  await admin?.context().close();
  for (const page of pages.values()) await page.context().close();
});

test("two players join, then the admin renames one to match the other", async () => {
  gameId = await createGame(admin, GAME.name, GAME.code);
  const joinPath = await readJoinLinkPath(admin, gameId);
  for (const p of [alice, bob]) {
    await joinThroughLink(pages.get(p.displayName)!, joinPath, GAME.name, p.displayName);
  }

  await admin.goto(`/admin/games/${gameId}/players`);
  await admin.getByRole("button", { name: `Edit name of ${alice.displayName}` }).click();
  await admin.getByRole("textbox", { name: `Edit name of ${alice.displayName}` }).fill(bob.displayName);
  await admin.getByRole("textbox", { name: `Edit name of ${alice.displayName}` }).press("Enter");
  await expect(admin.getByTestId("admin-player-name").filter({ hasText: bob.displayName })).toHaveCount(2);

  // The player sees the new name in this game only.
  await pages.get(alice.displayName)!.goto(`/${gameId}`);
  await expect(pages.get(alice.displayName)!.getByTestId("player-name")).toHaveText(bob.displayName);
});

test("generating the ring is blocked until the names differ", async () => {
  await admin.goto(`/admin/games/${gameId}/leaderboard`);
  await admin.getByRole("button", { name: "Round actions" }).click();
  await admin.getByRole("menuitem", { name: "Generate ring" }).click();
  await fillRandomWords(admin);
  await admin.getByRole("button", { name: "Yes, generate" }).click();

  const dialog = admin.getByRole("dialog", { name: "Some players share a name" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("duplicate-names").getByText(bob.displayName)).toHaveCount(2);

  await dialog.getByRole("button", { name: `Edit name of ${bob.displayName}` }).first().click();
  const input = dialog.getByRole("textbox", { name: `Edit name of ${bob.displayName}` });
  await input.fill("Bob E2E Jr");
  await input.press("Enter");
  await expect(dialog.getByText("The names are different now")).toBeVisible();

  await dialog.getByRole("button", { name: "Close" }).click();
  await admin.getByRole("button", { name: "Yes, generate" }).click();
  await expect(admin.getByTestId("game-status")).toHaveText("Active");
});
