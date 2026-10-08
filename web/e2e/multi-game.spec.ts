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
} from "./support";

// Two games run side by side; then one finishes and becomes read-only.
test.describe.configure({ mode: "serial" });

const A = { name: "Multi Game A", code: "MULTIA1" };
const B = { name: "Multi Game B", code: "MULTIB1" };
const [alice, bob, carol] = PLAYERS;

let admin: Page;
let alicePage: Page;
let bobPage: Page;
let carolPage: Page;
let gameA: string;
let gameB: string;

test.beforeAll(async ({ browser }) => {
  admin = await pageFor(browser, ADMIN);
  alicePage = await pageFor(browser, alice);
  bobPage = await pageFor(browser, bob);
  carolPage = await pageFor(browser, carol);
});

test.afterAll(async () => {
  for (const page of [admin, alicePage, bobPage, carolPage]) await page?.context().close();
});

test("game A starts with Alice and Bob", async () => {
  gameA = await createGame(admin, A.name, A.code);
  const joinA = await readJoinLinkPath(admin, gameA);
  await joinThroughLink(alicePage, joinA, A.name, "Alice A");
  await joinThroughLink(bobPage, joinA, A.name, "Bob A");
  await generateRing(admin, gameA);
  await expect(admin.getByTestId("game-status")).toHaveText("Active");
});

test("admin creates game B while game A is active", async () => {
  gameB = await createGame(admin, B.name, B.code);
  await expect(admin.getByTestId("game-status")).toHaveText("Setup");

  // Alice plays in both games, under a different name in each.
  const joinB = await readJoinLinkPath(admin, gameB);
  await joinThroughLink(alicePage, joinB, B.name, "Alice B");
  await joinThroughLink(carolPage, joinB, B.name, "Carol B");
  await generateRing(admin, gameB);

  await admin.goto("/admin");
  for (const g of [A, B]) {
    const row = admin.getByTestId("game-row").filter({ hasText: g.name });
    await expect(row).toContainText(g.code);
    await expect(row.getByTestId("game-status")).toHaveText("Active");
    await expect(row.locator("td").nth(3)).toHaveText("2");
  }
});

test("a player in both games sees both on /me with the right target in each", async () => {
  await alicePage.goto("/me");
  const cardA = alicePage.getByTestId("my-game").filter({ hasText: A.name });
  const cardB = alicePage.getByTestId("my-game").filter({ hasText: B.name });
  await expect(cardA).toContainText("Playing as Alice A");
  await expect(cardB).toContainText("Playing as Alice B");
  await expect(cardA.getByTestId("player-status")).toHaveText("Alive");
  await expect(cardB.getByTestId("player-status")).toHaveText("Alive");

  await cardB.getByRole("link").click();
  await expect(alicePage).toHaveURL(new RegExp(`/games/${gameB}$`));
  await expect(alicePage.getByTestId("player-name")).toHaveText("Alice B");
  await expect(alicePage.getByTestId("target-name")).toHaveText("Carol B");

  await expectTarget(alicePage, gameA, "Bob A");
  await expect(alicePage.getByTestId("player-name")).toHaveText("Alice A");
  await expectTarget(bobPage, gameA, "Alice A");
  await expectTarget(carolPage, gameB, "Alice B");
});

test("closing signups on game B leaves game A open", async () => {
  await admin.goto(`/admin/games/${gameB}`);
  await admin.getByRole("button", { name: "Close signups" }).click();
  await expect(admin.getByTestId("signups-state")).toHaveText("closed");

  await bobPage.goto(`/join/${B.code}`);
  await expect(bobPage.getByRole("heading", { name: `Join ${B.name}` })).toBeVisible();
  await expect(bobPage.getByText("Signups are closed.")).toBeVisible();
  await expect(bobPage.getByLabel("Display name")).toHaveCount(0);

  await admin.goto(`/admin/games/${gameA}`);
  await expect(admin.getByTestId("signups-state")).toHaveText("open");
});

test("a join code used by a live game is rejected", async () => {
  await admin.goto("/admin");
  await admin.getByLabel("Name").fill("Duplicate code");
  await admin.getByLabel("Join code").fill(B.code);
  await admin.getByRole("button", { name: "Create game" }).click();

  await expect(
    admin.getByRole("alert").filter({ hasText: "already uses that join code" }),
  ).toHaveText(
    "Another game that hasn't finished already uses that join code. Pick another one.",
  );
  await expect(admin).toHaveURL(/\/admin$/);
  await expect(admin.getByTestId("game-row").filter({ hasText: "Duplicate code" })).toHaveCount(0);
});

test("admin finishes game A", async () => {
  await admin.goto(`/admin/games/${gameA}`);
  await admin.getByRole("button", { name: "Finish game" }).click();
  await admin.getByRole("button", { name: "Yes, finish it" }).click();

  await expect(admin.getByTestId("game-status")).toHaveText(/^Finished /);
  await expect(admin.getByRole("heading", { name: "Read-only" })).toBeVisible();

  await admin.goto("/admin");
  const rowA = admin.getByTestId("game-row").filter({ hasText: A.name });
  await expect(rowA.getByTestId("game-status")).toHaveText(/^Finished /);
  const rowB = admin.getByTestId("game-row").filter({ hasText: B.name });
  await expect(rowB.getByTestId("game-status")).toHaveText("Active");
});

test("a finished game's admin pages are read-only", async () => {
  await admin.goto(`/admin/games/${gameA}`);
  await expect(admin.getByRole("heading", { name: "Read-only" })).toBeVisible();
  await expect(admin.getByTestId("join-code")).toHaveText(A.code);
  for (const name of ["Save changes", "Close signups", "Open signups", "Finish game"]) {
    await expect(admin.getByRole("button", { name })).toHaveCount(0);
  }
  await expect(admin.getByTestId("join-link")).toHaveCount(0);
  await expect(admin.getByRole("button", { name: "Copy link" })).toHaveCount(0);

  await admin.goto(`/admin/games/${gameA}/players`);
  await expect(admin.getByTestId("player-row")).toHaveCount(2);
  await expect(admin.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(admin.getByRole("button", { name: "Restore" })).toHaveCount(0);

  await admin.goto(`/admin/games/${gameA}/rings`);
  await expect(admin.getByText("The game has finished.")).toBeVisible();
  await expect(admin.getByTestId("ring-pair")).toHaveCount(2);
  await expect(admin.getByRole("button", { name: "Shake up" })).toHaveCount(0);
  await expect(admin.getByRole("button", { name: "Generate ring" })).toHaveCount(0);
});

test("players see game A as finished, and game B carries on", async () => {
  await alicePage.goto("/me");
  const cardA = alicePage.getByTestId("my-game").filter({ hasText: A.name });
  await expect(cardA).toContainText("Finished");
  await expectTarget(alicePage, gameA, "This game has finished");
  await expectTarget(alicePage, gameB, "Carol B");
});

test("a finished game's join link is no longer valid, and its code is free again", async () => {
  await carolPage.goto(`/join/${A.code}`);
  await expect(
    carolPage.getByRole("alert").filter({ hasText: "This join link isn't valid." }),
  ).toBeVisible();
  await expect(carolPage.getByLabel("Display name")).toHaveCount(0);

  const reused = await createGame(admin, "Multi Game C", A.code);
  expect(reused).not.toBe(gameA);
  await carolPage.goto(`/join/${A.code}`);
  await expect(carolPage.getByRole("heading", { name: "Join Multi Game C" })).toBeVisible();
});
