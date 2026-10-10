package com.assassin.api.targeting;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LeaderboardEndpointIT extends IntegrationTest {

    private UUID gameId;

    @BeforeEach
    void seed() {
        gameId = insertGame("LDE123", "ACTIVE", false);
        UUID alice = insertPlayer(gameId, "alice@example.com", "alice", "ALIVE");
        insertPlayer(gameId, "bob@example.com", "bob", "DEAD");
        UUID round1 = jdbc.queryForObject(
                "insert into game.game_round (game_id, round_no, created_by) values (?, 1, 'test') returning id",
                UUID.class, gameId);
        jdbc.update("insert into game.point_event (game_id, game_round_id, player_id, points, type) values (?, ?, ?, 10, 'KILL')",
                gameId, round1, alice);
    }

    private String player() {
        return "/api/me/games/" + gameId + "/leaderboard";
    }

    private String admin() {
        return "/api/admin/games/" + gameId + "/leaderboard";
    }

    @Test
    void playerSeesTotalAndRounds() throws Exception {
        mvc.perform(as("bob@example.com", get(player())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roundNo").isEmpty())
                .andExpect(jsonPath("$.rounds[0]").value(1))
                .andExpect(jsonPath("$.entries[0].rank").value(1))
                .andExpect(jsonPath("$.entries[0].player.displayName").value("alice"))
                .andExpect(jsonPath("$.entries[0].points").value(10))
                .andExpect(jsonPath("$.entries[1].status").value("DEAD"));
    }

    @Test
    void adminSeesRoundView() throws Exception {
        mvc.perform(asAdmin(get(admin()).param("roundNo", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roundNo").value(1))
                .andExpect(jsonPath("$.entries.length()").value(2));
    }

    @Test
    void strangerGetsNotInGame() throws Exception {
        mvc.perform(as("stranger@example.com", get(player())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
    }

    @Test
    void unknownGameIsNotInGameForPlayer() throws Exception {
        mvc.perform(as("alice@example.com", get("/api/me/games/" + UUID.randomUUID() + "/leaderboard")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
    }

    @Test
    void nonAdminIsForbiddenFromAdminEndpoint() throws Exception {
        mvc.perform(as("alice@example.com", get(admin())))
                .andExpect(status().isForbidden());
    }

    @Test
    void unknownGameIsNotFoundForAdmin() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/games/" + UUID.randomUUID() + "/leaderboard")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }

    @Test
    void unknownRoundIsNotFoundOnBothEndpoints() throws Exception {
        mvc.perform(as("alice@example.com", get(player()).param("roundNo", "9")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROUND_NOT_FOUND"));
        mvc.perform(asAdmin(get(admin()).param("roundNo", "9")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROUND_NOT_FOUND"));
    }
}
