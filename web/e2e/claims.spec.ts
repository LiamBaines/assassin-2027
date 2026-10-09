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

// Players claim kills from their game page; the victim accepts or contests, and the admin resolves contested claims.
// Each test builds its own game, so none depends on another's state.
test.describe.configure({ mode: "serial" });

const VICTIM = PLAYERS[1].displayName;

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

type Setup = { gameId: string; killer: string; inherited: string };

/** Creates a game, joins all players, generates the ring and works out who hunts the victim. */
async function startGame(code: string): Promise<Setup> {
  const name = `Claims ${code}`;
  const gameId = await createGame(admin, name, code);
  const joinPath = await readJoinLinkPath(admin, gameId);
  for (const p of PLAYERS) {
    await joinThroughLink(pages.get(p.displayName)!, joinPath, name, p.displayName);
  }
  await generateRing(admin, gameId);
  const ring = await readRing(admin, gameId);
  return {
    gameId,
    killer: ring.find((pair) => pair.target === VICTIM)!.assassin,
    inherited: ring.find((pair) => pair.assassin === VICTIM)!.target,
  };
}

/** The killer files a claim on their game page: the button, then its confirm step. */
async function fileClaim(killer: Page, gameId: string): Promise<void> {
  await killer.goto(`/games/${gameId}`);
  await killer.getByRole("button", { name: "Register kill" }).click();
  await killer.getByRole("button", { name: "Yes, I killed them" }).click();
  await expect(killer.getByTestId("claim-status")).toContainText("Waiting for your target");
}

async function respond(victim: Page, gameId: string, button: string, killer: string) {
  await victim.goto(`/games/${gameId}`);
  await expect(victim.getByTestId("incoming-claim")).toContainText(killer);
  await victim.getByRole("button", { name: button }).click();
}

/** The admin players page row whose first (name) cell is exactly `name`. */
function playerRow(name: string) {
  return admin.getByTestId("player-row").filter({
    has: admin.locator("td:first-child").getByText(name, { exact: true }),
  });
}

async function openAdminClaims(gameId: string) {
  await admin.goto(`/admin/games/${gameId}/players`);
  const claim = admin.getByTestId("kill-claim");
  await expect(claim).toHaveCount(1);
  return claim;
}

test("the victim accepts a claim and is killed without the admin", async () => {
  const { gameId, killer, inherited } = await startGame("CLAIMS01");
  const killerPage = pages.get(killer)!;
  const victimPage = pages.get(VICTIM)!;

  await fileClaim(killerPage, gameId);
  await respond(victimPage, gameId, "Yes, I was killed", killer);
  await expect(victimPage.getByTestId("incoming-claim")).toHaveCount(0);

  await admin.goto(`/admin/games/${gameId}/players`);
  await expect(playerRow(VICTIM)).toContainText("DEAD");
  await expect(admin.getByTestId("kill-claim")).toHaveCount(0);
  await expectTarget(killerPage, gameId, inherited);
});

test("a contested claim stays open until the admin dismisses it", async () => {
  const { gameId, killer } = await startGame("CLAIMS02");
  const killerPage = pages.get(killer)!;

  await fileClaim(killerPage, gameId);
  await respond(pages.get(VICTIM)!, gameId, "No, contest", killer);

  await killerPage.goto(`/games/${gameId}`);
  await expect(killerPage.getByTestId("claim-status")).toContainText("contested");

  const claim = await openAdminClaims(gameId);
  await expect(claim).toContainText("Contested by the victim");
  await claim.getByRole("button", { name: "Dismiss" }).click();
  await expect(admin.getByTestId("kill-claim")).toHaveCount(0);
  await expect(playerRow(VICTIM)).toContainText("ALIVE");

  await killerPage.goto(`/games/${gameId}`);
  await expect(killerPage.getByTestId("claim-status")).toContainText("dismissed");
  await expect(killerPage.getByRole("button", { name: "Register kill" })).toBeVisible();
});

test("the admin can confirm a contested claim", async () => {
  const { gameId, killer, inherited } = await startGame("CLAIMS03");
  const killerPage = pages.get(killer)!;

  await fileClaim(killerPage, gameId);
  await respond(pages.get(VICTIM)!, gameId, "No, contest", killer);

  const claim = await openAdminClaims(gameId);
  await claim.getByRole("button", { name: "Confirm kill" }).click();
  await claim.getByRole("button", { name: "Confirm kill" }).last().click();
  await expect(admin.getByTestId("kill-claim")).toHaveCount(0);
  await expect(playerRow(VICTIM)).toContainText("DEAD");
  await expectTarget(killerPage, gameId, inherited);
});
