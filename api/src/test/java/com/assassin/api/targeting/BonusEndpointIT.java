package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class BonusEndpointIT extends IntegrationTest {

    @Autowired
    private BonusService bonusService;

    private String gameId;
    private String url;
    private UUID alice;
    private UUID bob;

    @BeforeEach
    void seed() throws Exception {
        gameId = insertGame("BNE123", "SETUP", true);
        url = "/api/admin/games/" + gameId + "/bonuses";
        alice = insertPlayer(gameId, "alice@example.com", "Alice", "ALIVE");
        bob = insertPlayer(gameId, "bob@example.com", "Bob", "ALIVE");
        insertPlayer(gameId, "carol@example.com", "Carol", "ALIVE");
    }

    @AfterEach
    void dropTrigger() {
        jdbc.execute("drop trigger if exists fail_admin_message on game.message");
        jdbc.execute("drop function if exists game.fail_admin_message()");
    }

    private String body(Object player, Object points, Object reason, Object killId) {
        return "{\"playerId\": " + (player == null ? "null" : "\"" + player + "\"") + ", \"points\": " + points
                + ", \"reason\": " + (reason == null ? "null" : "\"" + reason + "\"")
                + (killId == null ? "" : ", \"killId\": " + killId) + "}";
    }

    private ResultActions award(Object player, Object points, Object reason,
            Object killId) throws Exception {
        return mvc.perform(asAdmin(post(url).contentType(MediaType.APPLICATION_JSON)
                .content(body(player, points, reason, killId))));
    }

    private long registerKill() throws Exception {
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null}"))).andExpect(status().isCreated());
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/kills").contentType(MediaType.APPLICATION_JSON)
                .content("{\"victimId\": \"" + bob + "\", \"killMethodId\": " + methodId(gameId, "Clamp") + "}")))
                .andExpect(status().isCreated());
        return jdbc.queryForObject("select id from game.kill", Long.class);
    }

    private UUID killerOf(long killId) {
        return jdbc.queryForObject("select killer_id from game.kill where id = ?", UUID.class, killId);
    }

    @Test
    void requiresAdmin() throws Exception {
        mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(body(alice, 5, "x", null)))
                .andExpect(status().isUnauthorized());
        mvc.perform(as("alice@example.com", post(url).contentType(MediaType.APPLICATION_JSON)
                .content(body(alice, 5, "x", null)))).andExpect(status().isForbidden());
        mvc.perform(get(url)).andExpect(status().isUnauthorized());
        mvc.perform(as("alice@example.com", get(url))).andExpect(status().isForbidden());
    }

    @Test
    void awardWritesLedgerEventAndAdminMessage() throws Exception {
        award(alice, 5, "  Best costume ", null).andExpect(status().isCreated())
                .andExpect(jsonPath("$.player.displayName").value("Alice"))
                .andExpect(jsonPath("$.points").value(5))
                .andExpect(jsonPath("$.reason").value("Best costume"))
                .andExpect(jsonPath("$.roundNo").isEmpty())
                .andExpect(jsonPath("$.kill").isEmpty());

        assertThat(jdbc.queryForObject("select sum(points) from game.point_event where player_id = ? and type = 'BONUS'",
                Integer.class, alice)).isEqualTo(5);
        assertThat(jdbc.queryForObject("select payload->>'reason' from game.game_event where type = 'BONUS_AWARDED'",
                String.class)).isEqualTo("Best costume");
        assertThat(jdbc.queryForObject(
                "select body from game.message where kind = 'ADMIN' and recipient_id = ? and sender_id is null and assignment_id is null",
                String.class, alice)).isEqualTo("You were awarded +5 bonus points: Best costume.");
    }

    @Test
    void negativeBonusMessageSaysLost() throws Exception {
        award(alice, -3, "Late to briefing", null).andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("select body from game.message where recipient_id = ?", String.class, alice))
                .isEqualTo("You lost 3 bonus points: Late to briefing.");
    }

    @Test
    void invalidPoints() throws Exception {
        for (int p : new int[] {0, 101, -101}) {
            award(alice, p, "x", null).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_BONUS_POINTS"));
        }
        award(alice, 100, "x", null).andExpect(status().isCreated());
        award(alice, -100, "x", null).andExpect(status().isCreated());
    }

    @Test
    void reasonIsRequiredAndCapped() throws Exception {
        for (String r : new String[] {null, "", "   ", "x".repeat(141)}) {
            award(alice, 5, r, null).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("REASON_REQUIRED"));
        }
        award(alice, 5, "x".repeat(140), null).andExpect(status().isCreated());
    }

    @Test
    void unknownPlayerOrOtherGamesPlayer() throws Exception {
        award(UUID.randomUUID(), 5, "x", null).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PLAYER_NOT_FOUND"));
        String other = insertGame("Other", "OTH123", "SETUP", true);
        UUID stranger = insertPlayer(other, "zed@example.com", "Zed", "ALIVE");
        award(stranger, 5, "x", null).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PLAYER_NOT_FOUND"));
    }

    @Test
    void unknownKill() throws Exception {
        award(alice, 5, "x", 9999).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("KILL_NOT_FOUND"));
    }

    @Test
    void killLinkedBonusGoesToKillerOnly() throws Exception {
        long killId = registerKill();
        UUID killer = killerOf(killId);
        UUID notKiller = killer.equals(alice) ? bob : alice;

        award(notKiller, 5, "x", killId).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("KILL_PLAYER_MISMATCH"));
        award(killer, 5, "Clean kill", killId).andExpect(status().isCreated())
                .andExpect(jsonPath("$.kill.id").value(killId))
                .andExpect(jsonPath("$.roundNo").value(1));
        award(killer, 2, "Style points", killId).andExpect(status().isCreated());
    }

    @Test
    void listIsNewestFirst() throws Exception {
        award(alice, 5, "first", null).andExpect(status().isCreated());
        award(bob, -2, "second", null).andExpect(status().isCreated());
        mvc.perform(asAdmin(get(url))).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].reason").value("second"))
                .andExpect(jsonPath("$[1].reason").value("first"));
        mvc.perform(asAdmin(get("/api/admin/games/nope/bonuses"))).andExpect(status().isNotFound());
    }

    @Test
    void rollsBackWhenTheMessageWriteFails() {
        jdbc.execute("""
                create function game.fail_admin_message() returns trigger language plpgsql as
                $$ begin raise exception 'boom'; end $$""");
        jdbc.execute("create trigger fail_admin_message before insert on game.message "
                + "for each row execute function game.fail_admin_message()");

        assertThatThrownBy(() -> bonusService.award(gameId, alice, 5, "x", null, "admin@e2e.test"))
                .isInstanceOf(RuntimeException.class);

        assertThat(jdbc.queryForObject("select count(*) from game.point_event", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from game.game_event where type = 'BONUS_AWARDED'",
                Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from game.message", Integer.class)).isZero();
    }
}
