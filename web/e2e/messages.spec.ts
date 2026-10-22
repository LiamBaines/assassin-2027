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

const GAME = { name: "Messages Game", code: "MSGS001" };

let admin: Page;
const pages = new Map<string, Page>();
let gameId: string;
let assassin: string;
let target: string;

test.beforeAll(async ({ browser }) => {
  admin = await pageFor(browser, ADMIN);
  for (const p of PLAYERS) pages.set(p.displayName, await pageFor(browser, p));
});

test.afterAll(async () => {
  await admin?.context().close();
  for (const page of pages.values()) await page.context().close();
});

async function openInbox(page: Page): Promise<void> {
  await page.goto(`/${gameId}`);
  await page.getByTestId("nav-inbox").click();
  await expect(page.getByTestId("inbox")).toBeVisible();
}

test("the assassin sends an anonymous message to their target", async () => {
  gameId = await createGame(admin, GAME.name, GAME.code);
  const joinPath = await readJoinLinkPath(admin, gameId);
  for (const p of PLAYERS) {
    await joinThroughLink(pages.get(p.displayName)!, joinPath, GAME.name, p.displayName);
  }
  await generateRing(admin, gameId);
  const ring = await readRing(admin, gameId);
  assassin = ring[0].assassin;
  target = ring[0].target;

  const page = pages.get(assassin)!;
  await openInbox(page);
  await page.getByTestId("inbox-thread-target").click();
  await page.getByTestId("message-body").fill("I am coming for you");
  await page.getByTestId("message-send").click();
  await expect(page.getByTestId("message-body")).toHaveValue("");
  await expect(page.getByTestId("message").filter({ hasText: "I am coming for you" })).toBeVisible();
});

test("the target sees the unread bubble, reads the message and replies", async () => {
  const page = pages.get(target)!;
  await page.goto(`/${gameId}`);
  await expect(page.getByTestId("inbox-unread")).toHaveText("1");

  await page.getByTestId("nav-inbox").click();
  await expect(page.getByTestId("thread-unread")).toContainText("1 unread");
  await page.getByTestId("inbox-thread-assassin").click();
  const message = page.getByTestId("message").filter({ hasText: "I am coming for you" });
  await expect(message).toBeVisible();
  // Messages carry the role only, never a name.
  await expect(message).not.toContainText(assassin);
  await expect(page.getByTestId("inbox-unread")).toHaveCount(0);

  await page.getByTestId("message-body").fill("You will have to find me");
  await page.getByTestId("message-send").click();
  await expect(page.getByTestId("message").filter({ hasText: "You will have to find me" })).toBeVisible();
});

test("the assassin sees the reply", async () => {
  const page = pages.get(assassin)!;
  await page.goto(`/${gameId}`);
  await expect(page.getByTestId("inbox-unread")).toHaveText("1");
  await page.getByTestId("nav-inbox").click();
  await page.getByTestId("inbox-thread-target").click();
  await expect(page.getByTestId("message")).toHaveCount(2);
  await expect(page.getByTestId("message").last()).toContainText("You will have to find me");
});

test("the admin sees the messages with names", async () => {
  await admin.goto(`/admin/games/${gameId}/messages`);
  await expect(admin.getByText("I am coming for you")).toBeVisible();
  await expect(admin.getByText("You will have to find me")).toBeVisible();
});

test("a kill ends the thread for both players", async () => {
  await admin.goto(`/admin/games/${gameId}/players`);
  const row = admin.getByTestId("player-row").filter({
    has: admin.locator("td:first-child").getByText(target, { exact: true }),
  });
  await registerKill(row);
  await expect(row).toContainText("Dead");

  // The killer's new assignment starts with an empty thread.
  const killer = pages.get(assassin)!;
  await openInbox(killer);
  await expect(killer.getByText("I am coming for you")).toHaveCount(0);
  await killer.getByTestId("inbox-thread-target").click();
  await expect(killer.getByTestId("message")).toHaveCount(0);

  // The dead target has no active assignment, so nothing to send.
  const dead = pages.get(target)!;
  await openInbox(dead);
  await expect(dead.getByText("I am coming for you")).toHaveCount(0);
});
