package com.assassin.api.player;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class AdminPlayersIT extends IntegrationTest {

    @Autowired
    ObjectMapper json;

    private UUID gameId;
    private UUID alice;
    private UUID bob;
    private UUID carol;

    @BeforeEach
    void seed() {
        gameId = insertGame("ABC123", "SETUP", true);
        alice = insertPlayer(gameId, "alice@example.com", "Alice", "ALIVE");
        bob = insertPlayer(gameId, "bob@example.com", "Bob", "ALIVE");
        carol = insertPlayer(gameId, "carol@example.com", "Carol", "ALIVE");
    }

    private ResultActions setStatus(UUID id, String status) throws Exception {
        return mvc.perform(asAdmin(patch("/api/admin/players/" + id)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\": \"" + status + "\"}")));
    }

    private void shuffle() throws Exception {
        shuffle(null);
    }

    private void shuffle(Integer expected) throws Exception {
        mvc.perform(asAdmin(post("/api/admin/rings").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedCurrentRoundNo\": " + expected + "}")))
                .andExpect(status().isCreated());
    }

    private UUID activeTargetOf(UUID assassin) {
        return jdbc.queryForObject("select target_id from game.assignment where assassin_id = ? and status = 'ACTIVE'",
                UUID.class, assassin);
    }

    private UUID activeAssassinOf(UUID target) {
        return jdbc.queryForObject("select assassin_id from game.assignment where target_id = ? and status = 'ACTIVE'",
                UUID.class, target);
    }

    private String column(String column, UUID playerId) {
        return jdbc.queryForObject("select " + column + " from game.player where id = ?", String.class, playerId);
    }

    private int count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private ResultActions myTarget(UUID playerId) throws Exception {
        return mvc.perform(as(column("email", playerId), get("/api/me/target")));
    }

    @Test
    void listsPlayersWithoutTargetsBeforeRing() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/players")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].displayName").value("Alice"))
                .andExpect(jsonPath("$[0].email").value("alice@example.com"))
                .andExpect(jsonPath("$[0].status").value("ALIVE"))
                .andExpect(jsonPath("$[0].currentTarget").value(nullValue()));
    }

    @Test
    void listIncludesCurrentTargetMatchingTheRing() throws Exception {
        shuffle();
        String body = mvc.perform(asAdmin(get("/api/admin/players")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        for (JsonNode p : json.readTree(body)) {
            UUID expected = jdbc.queryForObject(
                    "select target_id from game.assignment where assassin_id = ? and status = 'ACTIVE'",
                    UUID.class, UUID.fromString(p.get("id").asText()));
            assertThat(p.at("/currentTarget/id").asText()).isEqualTo(expected.toString());
            assertThat(p.at("/currentTarget/displayName").asText()).isNotBlank();
        }
    }

    @Test
    void removeAndRestoreBeforeRing() throws Exception {
        setStatus(bob, "REMOVED").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REMOVED"));
        assertThat(jdbc.queryForObject("select status from game.player where id = ?", String.class, bob))
                .isEqualTo("REMOVED");
        setStatus(bob, "ALIVE").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ALIVE"));
    }

    @Test
    void removingAPlayerMidGameSplicesThemOutOfTheRing() throws Exception {
        UUID dave = insertPlayer(gameId, "dave@example.com", "Dave", "ALIVE");
        UUID erin = insertPlayer(gameId, "erin@example.com", "Erin", "ALIVE");
        shuffle();
        UUID x = carol;
        UUID a = activeAssassinOf(x);
        UUID t = activeTargetOf(x);
        UUID roundId = jdbc.queryForObject("select id from game.assignment_round", UUID.class);

        setStatus(x, "REMOVED").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REMOVED"));

        assertThat(column("status", x)).isEqualTo("REMOVED");
        assertThat(count("""
                select count(*) from game.assignment
                 where (assassin_id = ? or target_id = ?) and status = 'VOIDED' and ended_at is not null
                   and round_id = ?
                """, x, x, roundId)).isEqualTo(2);
        assertThat(count("select count(*) from game.assignment where (assassin_id = ? or target_id = ?) and status = 'ACTIVE'",
                x, x)).isZero();
        assertThat(count("""
                select count(*) from game.assignment
                 where assassin_id = ? and target_id = ? and status = 'ACTIVE' and source = 'SPLICE' and round_id = ?
                """, a, t, roundId)).isEqualTo(1);
        assertActiveRingCovers(List.of(alice, bob, dave, erin));

        myTarget(a).andExpect(status().isOk())
                .andExpect(jsonPath("$.target.displayName").value(column("display_name", t)));
        myTarget(x).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NO_TARGET"));
        mvc.perform(asAdmin(get("/api/admin/rings/current")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roundNo").value(1))
                .andExpect(jsonPath("$.ring.length()").value(4));

        // A shakeup supersedes the spliced ring like any other.
        shuffle(1);
        assertThat(count("select count(*) from game.assignment where source = 'SPLICE' and status = 'SUPERSEDED'"))
                .isEqualTo(1);
        assertActiveRingCovers(List.of(alice, bob, dave, erin));
    }

    @Test
    void removingFromATwoPlayerRingLeavesTheAssassinWithoutATarget() throws Exception {
        setStatus(carol, "REMOVED").andExpect(status().isOk());
        shuffle();

        setStatus(alice, "REMOVED").andExpect(status().isOk());

        assertThat(count("select count(*) from game.assignment where status = 'VOIDED' and ended_at is not null"))
                .isEqualTo(2);
        assertThat(count("select count(*) from game.assignment where status = 'ACTIVE'")).isZero();
        assertThat(count("select count(*) from game.assignment where source = 'SPLICE'")).isZero();
        myTarget(bob).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NO_TARGET"));
        mvc.perform(asAdmin(get("/api/admin/rings/current")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ring.length()").value(0));
    }

    @Test
    void lateJoinerOutsideRingCanBeRemovedWhileActive() throws Exception {
        shuffle();
        UUID dave = insertPlayer(gameId, "dave@example.com", "Dave", "ALIVE");
        setStatus(dave, "REMOVED").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REMOVED"));
        assertThat(count("select count(*) from game.assignment where status <> 'ACTIVE'")).isZero();
        assertActiveRingCovers(List.of(alice, bob, carol));
    }

    @Test
    void restoredPlayerHasNoTargetUntilTheNextShakeup() throws Exception {
        shuffle();
        setStatus(alice, "REMOVED").andExpect(status().isOk());

        setStatus(alice, "ALIVE").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ALIVE"));

        myTarget(alice).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NO_TARGET"));
        assertActiveRingCovers(List.of(bob, carol));
        shuffle(1);
        assertActiveRingCovers(List.of(alice, bob, carol));
    }

    @Test
    void onlyRemovedOrAliveAllowed() throws Exception {
        setStatus(carol, "DEAD")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS"));
        mvc.perform(asAdmin(patch("/api/admin/players/" + carol)
                        .contentType(MediaType.APPLICATION_JSON).content("{}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void unknownPlayerIsNotFound() throws Exception {
        setStatus(UUID.randomUUID(), "REMOVED")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PLAYER_NOT_FOUND"));
    }
}
