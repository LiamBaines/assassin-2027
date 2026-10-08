import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { Client } from "pg";
import { ALL_USERS, confirmPathFor, env, storageStatePath } from "./support";

/**
 * Empties every game table except Flyway's history. Talks to the local
 * Supabase database directly: this exists only for e2e and is never an API
 * endpoint.
 */
async function resetGameData(): Promise<void> {
  const client = new Client({ connectionString: env("E2E_DATABASE_URL") });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `select tablename from pg_tables
        where schemaname = 'game' and tablename <> 'flyway_schema_history'`,
    );
    if (rows.length === 0) {
      throw new Error("No game tables found. Has the API run its Flyway migration?");
    }
    const tables = rows.map((r) => `game."${r.tablename}"`).join(", ");
    await client.query(`truncate ${tables} restart identity cascade`);
  } finally {
    await client.end();
  }
}

/** Logs every e2e user in through /auth/confirm and saves their cookies. */
async function createSessions(baseURL: string): Promise<void> {
  await mkdir(path.dirname(storageStatePath(ALL_USERS[0])), { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const user of ALL_USERS) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await page.goto(await confirmPathFor(user.email));
      // `/` shows admins a menu and sends players without a game entry to /join.
      await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/join");
      await context.storageState({ path: storageStatePath(user) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  await resetGameData();
  await createSessions(baseURL);
}
