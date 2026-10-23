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

let admin: Page;
const pages = new Map<string, Page>();

test.beforeAll(async ({ browser }) => {
  admin = await pageFor(browser, ADMIN);
  for (const p of PLAYERS) pages.set(p.displayName, await pageFor(browser, p));
});

test.afterAll(async () => {
  await admin?.context().close();
  for (const page of pages.values()) await page.context().close();
});

async function startGame(name: string, code: string) {
  const gameId = await createGame(admin, name, code);
  const joinPath = await readJoinLinkPath(admin, gameId);
  for (const p of PLAYERS) {
    await joinThroughLink(pages.get(p.displayName)!, joinPath, name, p.displayName);
  }
  await generateRing(admin, gameId);
  const ring = await readRing(admin, gameId);
  const [first] = ring;
  const third = ring.find((p) => p.assassin === first.target)!.target;
  return { gameId, assassin: first.assassin, target: first.target, other: third };
}

async function openThread(page: Page, gameId: string, role: "target" | "assassin"): Promise<void> {
  await page.goto(`/${gameId}`);
  await page.getByTestId("nav-inbox").click();
  await page.getByTestId(`inbox-thread-${role}`).click();
  await expect(page.getByTestId("inbox-thread")).toBeVisible();
}

async function challenge(page: Page, gameId: string, activity: string): Promise<void> {
  await openThread(page, gameId, "target");
  await page.getByTestId("duel-challenge").click();
  await page.getByTestId("duel-activity-input").fill(activity);
  await page.getByTestId("duel-next").click();
  await expect(page.getByTestId("duel-confirm-activity")).toHaveText(activity);
  await page.getByTestId("duel-send").click();
  await expect(page.getByTestId("duel-card")).toHaveAttribute("data-status", "PENDING");
}

async function expectStatus(page: Page, status: string): Promise<void> {
  await expect(page.getByTestId("duel-card").last()).toHaveAttribute("data-status", status);
}

test.describe("assassin wins", () => {
  let game: Awaited<ReturnType<typeof startGame>>;

  test("the target accepts a challenge and learns who the assassin is", async () => {
    game = await startGame("Duel Win Game", "DUEL001");
    const assassin = pages.get(game.assassin)!;
    await challenge(assassin, game.gameId, "Arm wrestle in the kitchen");

    const target = pages.get(game.target)!;
    await openThread(target, game.gameId, "assassin");
    await expect(target.getByTestId("duel-card")).toContainText("Arm wrestle in the kitchen");
    await expect(target.getByTestId("duel-reveal")).toHaveCount(0);
    await target.getByTestId("duel-accept").click();
    await expectStatus(target, "ACCEPTED");
    await expect(target.getByTestId("duel-reveal")).toContainText(game.assassin);
  });

  test("the assassin reports a win and the target confirms", async () => {
    const assassin = pages.get(game.assassin)!;
    await openThread(assassin, game.gameId, "target");
    await assassin.getByTestId("duel-report").click();
    await assassin.getByTestId("duel-report-me").click();
    await expectStatus(assassin, "REPORTED");

    const target = pages.get(game.target)!;
    await openThread(target, game.gameId, "assassin");
    await target.getByTestId("duel-confirm").click();
    // The loss ends their assignment, and the thread with it.
    await expect(target.getByTestId("duel-card")).toHaveCount(0);
  });

  test("the target is dead and the assassin inherits their target", async () => {
    await admin.goto(`/admin/games/${game.gameId}/players`);
    const row = admin.getByTestId("player-row").filter({
      has: admin.locator("td:first-child").getByText(game.target, { exact: true }),
    });
    await expect(row).toContainText("Dead");
    const ring = await readRing(admin, game.gameId);
    expect(ring).toContainEqual({ assassin: game.assassin, target: game.other });
  });
});

test.describe("void by kill, then the target wins a contested duel", () => {
  let game: Awaited<ReturnType<typeof startGame>>;

  test("an admin kill voids a pending challenge", async () => {
    game = await startGame("Duel Void Game", "DUEL002");
    const assassin = pages.get(game.assassin)!;
    await challenge(assassin, game.gameId, "Rock paper scissors");

    await admin.goto(`/admin/games/${game.gameId}/players`);
    const row = admin.getByTestId("player-row").filter({
      has: admin.locator("td:first-child").getByText(game.target, { exact: true }),
    });
    await registerKill(row);
    await expect(row).toContainText("Dead");

    // The killer's thread with their new target is empty, and the old duel is gone from it.
    await openThread(assassin, game.gameId, "target");
    await expect(assassin.getByTestId("duel-card")).toHaveCount(0);
  });

  test("the challenged target accepts, the report is contested and the admin resolves it", async () => {
    // Remaining players: the original assassin and the third player.
    const challenger = pages.get(game.assassin)!;
    await challenge(challenger, game.gameId, "Thumb war");

    const challenged = pages.get(game.other)!;
    await openThread(challenged, game.gameId, "assassin");
    await challenged.getByTestId("duel-accept").click();
    await expectStatus(challenged, "ACCEPTED");

    await openThread(challenger, game.gameId, "target");
    await challenger.getByTestId("duel-report").click();
    await challenger.getByTestId("duel-report-me").click();
    await expectStatus(challenger, "REPORTED");

    await openThread(challenged, game.gameId, "assassin");
    await challenged.getByTestId("duel-contest").click();
    await expectStatus(challenged, "CONTESTED");

    await admin.goto(`/admin/games/${game.gameId}/kills`);
    const open = admin.getByTestId("open-duel");
    await expect(open).toHaveCount(1);
    await expect(open).toContainText("Thumb war");
    await open.getByRole("button", { name: `${game.other} won` }).click();
    await admin.getByRole("button", { name: "Resolve duel" }).click();
    await expect(admin.getByTestId("open-duel")).toHaveCount(0);

    // The challenger lost, so they are out of the game.
    await admin.goto(`/admin/games/${game.gameId}/players`);
    const row = admin.getByTestId("player-row").filter({
      has: admin.locator("td:first-child").getByText(game.assassin, { exact: true }),
    });
    await expect(row).toContainText("Dead");
  });
});
