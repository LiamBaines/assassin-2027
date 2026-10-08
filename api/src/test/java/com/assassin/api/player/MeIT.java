package com.assassin.api.player;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MeIT extends IntegrationTest {

    @Test
    void userWithoutGame() throws Exception {
        mvc.perform(as("someone@example.com", get("/api/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("someone@example.com"))
                .andExpect(jsonPath("$.isAdmin").value(false))
                .andExpect(jsonPath("$.game").value(nullValue()))
                .andExpect(jsonPath("$.player").value(nullValue()));
    }

    @Test
    void adminFlag() throws Exception {
        mvc.perform(as("Admin@Example.com", get("/api/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isAdmin").value(true));
    }

    @Test
    void liveGameWithoutPlayer() throws Exception {
        UUID gameId = insertGame("ABC123", "SETUP", true);
        mvc.perform(as("someone@example.com", get("/api/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.game.id").value(gameId.toString()))
                .andExpect(jsonPath("$.game.status").value("SETUP"))
                .andExpect(jsonPath("$.game.signupsOpen").value(true))
                .andExpect(jsonPath("$.game.joinCode").doesNotExist())
                .andExpect(jsonPath("$.player").value(nullValue()));
    }

    @Test
    void liveGameWithPlayer() throws Exception {
        UUID gameId = insertGame("ABC123", "SETUP", true);
        UUID playerId = insertPlayer(gameId, "alice@example.com", "Alice", "ALIVE");
        mvc.perform(as("alice@example.com", get("/api/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.player.id").value(playerId.toString()))
                .andExpect(jsonPath("$.player.displayName").value("Alice"))
                .andExpect(jsonPath("$.player.status").value("ALIVE"));
    }

    @Test
    void finishedGameIsNotReported() throws Exception {
        insertGame("ABC123", "FINISHED", false);
        mvc.perform(as("someone@example.com", get("/api/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.game").value(nullValue()));
    }

    @Test
    void unknownApiPathIsProblemDetailWithCode() throws Exception {
        mvc.perform(as("someone@example.com", get("/api/nope")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
