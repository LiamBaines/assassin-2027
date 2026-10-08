import { expect, test } from "@playwright/test";
import { env } from "./support";

const GAME_TABLES = ["game", "player", "assignment_round", "assignment", "flyway_schema_history"];

// Game data is only reachable through the Spring API. The publishable key must
// not be able to read it through PostgREST in any way.
test.describe("PostgREST lockdown", () => {
  const rest = () => `${env("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1`;
  const headers = () => ({ apikey: env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") });

  test("schema game is not exposed", async ({ request }) => {
    const res = await request.get(`${rest()}/player`, {
      headers: { ...headers(), "Accept-Profile": "game" },
    });
    expect(res.status()).toBe(406);
    const body = await res.json();
    expect(body.code).toBe("PGRST106");
    expect(body.message).toMatch(/Invalid schema: game/);
  });

  for (const table of GAME_TABLES) {
    test(`game.${table} is not readable`, async ({ request }) => {
      const viaGame = await request.get(`${rest()}/${table}?select=*`, {
        headers: { ...headers(), "Accept-Profile": "game" },
      });
      expect(viaGame.ok()).toBe(false);
      expect(viaGame.status()).toBe(406);

      // Without a profile, PostgREST looks in `public`, where no game table exists.
      const viaDefault = await request.get(`${rest()}/${table}?select=*`, {
        headers: headers(),
      });
      expect(viaDefault.ok()).toBe(false);
      expect(viaDefault.status()).toBe(404);
    });
  }
});
