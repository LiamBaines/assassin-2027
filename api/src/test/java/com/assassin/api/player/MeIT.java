package com.assassin.api.player;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MeIT extends IntegrationTest {

    @Test
    void userWithoutGames() throws Exception {
        insertGame("ABC123", "SETUP", true);
        mvc.perform(as("someone@example.com", get("/api/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("someone@example.com"))
                .andExpect(jsonPath("$.isAdmin").value(false))
                .andExpect(jsonPath("$.games.length()").value(0));
    }

    @Test
    void adminFlag() throws Exception {
        mvc.perform(as("Admin@Example.com", get("/api/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isAdmin").value(true));
    }

    @Test
    void oneGame() throws Exception {
        UUID gameId = insertGame("Spring", "ABC123", "SETUP", true);
        UUID playerId = insertPlayer(gameId, "alice@example.com", "Alice", "ALIVE");
        insertPlayer(gameId, "bob@example.com", "Bob", "ALIVE");
        mvc.perform(as("alice@example.com", get("/api/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.games.length()").value(1))
                .andExpect(jsonPath("$.games[0].game.id").value(gameId.toString()))
                .andExpect(jsonPath("$.games[0].game.name").value("Spring"))
                .andExpect(jsonPath("$.games[0].game.status").value("SETUP"))
                .andExpect(jsonPath("$.games[0].game.signupsOpen").value(true))
                .andExpect(jsonPath("$.games[0].game.joinCode").doesNotExist())
                .andExpect(jsonPath("$.games[0].player.id").value(playerId.toString()))
                .andExpect(jsonPath("$.games[0].player.displayName").value("Alice"))
                .andExpect(jsonPath("$.games[0].player.status").value("ALIVE"))
                .andExpect(jsonPath("$.games[0].player.joinedAt").isNotEmpty());
    }

    @Test
    void everyGameIncludingFinishedOnesMostRecentlyJoinedFirst() throws Exception {
        UUID finished = insertGame("Finished", "AAA111", "FINISHED", false);
        UUID active = insertGame("Active", "BBB222", "ACTIVE", true);
        UUID setup = insertGame("Setup", "CCC333", "SETUP", true);
        insertGame("Not mine", "DDD444", "SETUP", true);
        UUID inFinished = insertPlayer(finished, "alice@example.com", "Alice", "DEAD");
        UUID inSetup = insertPlayer(setup, "alice@example.com", "Ally", "ALIVE");
        UUID inActive = insertPlayer(active, "alice@example.com", "Alice", "REMOVED");
        jdbc.update("update game.player set joined_at = now() - interval '3 days' where id = ?", inFinished);
        jdbc.update("update game.player set joined_at = now() - interval '2 days' where id = ?", inSetup);
        jdbc.update("update game.player set joined_at = now() - interval '1 day' where id = ?", inActive);

        mvc.perform(as("alice@example.com", get("/api/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.games.length()").value(3))
                .andExpect(jsonPath("$.games[0].game.id").value(active.toString()))
                .andExpect(jsonPath("$.games[0].player.id").value(inActive.toString()))
                .andExpect(jsonPath("$.games[0].player.status").value("REMOVED"))
                .andExpect(jsonPath("$.games[1].game.id").value(setup.toString()))
                .andExpect(jsonPath("$.games[1].player.displayName").value("Ally"))
                .andExpect(jsonPath("$.games[2].game.id").value(finished.toString()))
                .andExpect(jsonPath("$.games[2].game.status").value("FINISHED"))
                .andExpect(jsonPath("$.games[2].player.status").value("DEAD"));
    }

    @Test
    void unknownApiPathIsProblemDetailWithCode() throws Exception {
        mvc.perform(as("someone@example.com", get("/api/nope")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
