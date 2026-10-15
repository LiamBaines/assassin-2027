package com.assassin.api.event;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

class GameEventEndpointIT extends IntegrationTest {

    @Autowired
    GameEventService events;
    @Autowired
    TransactionTemplate tx;

    private String gameId;

    @BeforeEach
    void seed() {
        gameId = insertGame("EVT123", "ACTIVE", false);
        insertPlayer(gameId, "alice@example.com", "alice", "ALIVE");
        tx.executeWithoutResult(s -> {
            for (int i = 1; i <= 5; i++) {
                events.record(gameId, "SHAKEUP", Map.of("roundNo", i));
            }
        });
    }

    private String player() {
        return "/api/me/games/" + gameId + "/events";
    }

    @Test
    void playerGetsNewestFirstAndPaginates() throws Exception {
        String body = mvc.perform(as("alice@example.com", get(player()).param("limit", "2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.events.length()").value(2))
                .andExpect(jsonPath("$.events[0].type").value("SHAKEUP"))
                .andExpect(jsonPath("$.events[0].data.roundNo").value(5))
                .andExpect(jsonPath("$.events[1].data.roundNo").value(4))
                .andExpect(jsonPath("$.nextBefore").isNumber())
                .andReturn().getResponse().getContentAsString();
        long next = new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).get("nextBefore").asLong();

        mvc.perform(as("alice@example.com", get(player()).param("limit", "2").param("before", String.valueOf(next))))
                .andExpect(jsonPath("$.events[0].data.roundNo").value(3))
                .andExpect(jsonPath("$.events[1].data.roundNo").value(2))
                .andExpect(jsonPath("$.nextBefore").isNumber());

        mvc.perform(as("alice@example.com", get(player()).param("limit", "10")))
                .andExpect(jsonPath("$.events.length()").value(5))
                .andExpect(jsonPath("$.nextBefore").isEmpty());
    }

    @Test
    void adminSeesLog() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/games/" + gameId + "/events")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.events.length()").value(5));
    }

    @Test
    void strangerGetsNotInGame() throws Exception {
        mvc.perform(as("stranger@example.com", get(player())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
    }

    @Test
    void unknownGameIsNotFoundForAdmin() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/games/" + "no-such-game" + "/events")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }
}
