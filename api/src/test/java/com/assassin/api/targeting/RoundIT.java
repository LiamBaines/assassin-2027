package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class RoundIT extends IntegrationTest {

    private UUID gameId;

    @BeforeEach
    void createGame() {
        gameId = insertGame("RND123", "SETUP", true);
    }

    private UUID player(String name, String status) {
        return insertPlayer(gameId, name + "@example.com", "player-" + name, status);
    }

    private ResultActions ring(Integer expected) throws Exception {
        return mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings")
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedCurrentRoundNo\": " + expected + "}")));
    }

    private ResultActions startRound(Integer expected, List<UUID> picked) throws Exception {
        String ids = picked.stream().map(id -> "\"" + id + "\"").collect(Collectors.joining(","));
        return mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rounds")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedRoundNo\": " + expected + ", \"playerIds\": [" + ids + "]}")));
    }

    private String statusOf(UUID player) {
        return jdbc.queryForObject("select status from game.player where id = ?", String.class, player);
    }

    @Test
    void startsRoundTwoMidRoundWithLateJoinerAndRevivedPlayer() throws Exception {
        UUID a = player("a", "ALIVE");
        UUID b = player("b", "ALIVE");
        UUID c = player("c", "ALIVE");
        UUID dead = player("dead", "DEAD");
        ring(null).andExpect(status().isCreated());
        // Round 1 is still open, with an open claim in it.
        Long assignment = jdbc.queryForObject("select id from game.assignment where assassin_id = ?", Long.class, a);
        UUID victim = jdbc.queryForObject("select target_id from game.assignment where assassin_id = ?", UUID.class, a);
        jdbc.update("insert into game.kill_claim (game_id, assignment_id, killer_id, victim_id, status) values (?, ?, ?, ?, 'PENDING')",
                gameId, assignment, a, victim);
        UUID lateJoiner = player("late", "ALIVE");
        UUID unticked = c;

        startRound(1, List.of(a, b, dead, lateJoiner))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.gameRoundNo").value(2))
                .andExpect(jsonPath("$.roundNo").value(2))
                .andExpect(jsonPath("$.reason").value("INITIAL"))
                .andExpect(jsonPath("$.ring.length()").value(4));

        assertThat(statusOf(dead)).isEqualTo("ALIVE");
        assertThat(statusOf(unticked)).isEqualTo("REMOVED");
        assertActiveRingCovers(gameId, List.of(a, b, dead, lateJoiner));
        assertThat(jdbc.queryForObject("select count(*) from game.assignment where status = 'SUPERSEDED'", Integer.class))
                .isEqualTo(3);
        assertThat(jdbc.queryForObject("select status from game.kill_claim", String.class)).isEqualTo("VOIDED");
        assertThat(jdbc.queryForObject(
                "select count(*) from game.game_round where game_id = ? and round_no = 1 and ended_at is not null and winner_id is null",
                Integer.class, gameId)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "select count(*) from game.game_round where game_id = ? and round_no = 2 and ended_at is null",
                Integer.class, gameId)).isEqualTo(1);
    }

    @Test
    void removedPlayerCanBeBroughtBack() throws Exception {
        UUID a = player("a", "ALIVE");
        UUID b = player("b", "ALIVE");
        UUID removed = player("removed", "REMOVED");
        ring(null).andExpect(status().isCreated());

        startRound(1, List.of(a, b, removed)).andExpect(status().isCreated());

        assertThat(statusOf(removed)).isEqualTo("ALIVE");
        assertActiveRingCovers(gameId, List.of(a, b, removed));
    }

    @Test
    void secondRoundCanFollowAnEndedRound() throws Exception {
        UUID a = player("a", "ALIVE");
        UUID b = player("b", "ALIVE");
        ring(null).andExpect(status().isCreated());
        startRound(1, List.of(a, b)).andExpect(status().isCreated());
        startRound(2, List.of(a, b)).andExpect(status().isCreated()).andExpect(jsonPath("$.gameRoundNo").value(3))
                .andExpect(jsonPath("$.roundNo").value(3));
    }

    @Test
    void rejectsBadRequests() throws Exception {
        UUID a = player("a", "ALIVE");
        UUID b = player("b", "ALIVE");
        startRound(null, List.of(a, b)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NO_ROUND"));
        ring(null).andExpect(status().isCreated());

        startRound(5, List.of(a, b)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_ROUND"));
        startRound(1, List.of(a)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_ENOUGH_PLAYERS"));
        startRound(1, List.of(a, a)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_ENOUGH_PLAYERS"));
        startRound(1, List.of(a, UUID.randomUUID())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PLAYER_NOT_FOUND"));

        // Nothing changed.
        assertThat(jdbc.queryForObject("select count(*) from game.game_round", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from game.assignment where status = 'ACTIVE'", Integer.class)).isEqualTo(2);

        jdbc.update("update game.game set status = 'FINISHED' where id = ?", gameId);
        startRound(1, List.of(a, b)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GAME_FINISHED"));
    }
}
