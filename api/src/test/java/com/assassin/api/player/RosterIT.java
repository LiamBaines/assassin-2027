package com.assassin.api.player;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class RosterIT extends IntegrationTest {

    private UUID gameId;

    @BeforeEach
    void seed() {
        gameId = insertGame("ABC123", "SETUP", true);
        // Inserted out of name order on purpose.
        for (String name : new String[] {"Carol", "alice", "Bob"}) {
            insertPlayer(gameId, name.toLowerCase() + "@example.com", name, "ALIVE");
        }
    }

    private void startAndRing() throws Exception {
        jdbc.update("update game.game set status = 'ACTIVE' where id = ?", gameId);
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedCurrentRoundNo\": null}")))
                .andExpect(status().isCreated());
    }

    private String roster(UUID game) {
        return "/api/me/games/" + game + "/players";
    }

    @Test
    void memberSeesEveryoneSortedByDisplayName() throws Exception {
        startAndRing();
        mvc.perform(as("carol@example.com", get(roster(gameId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players.length()").value(3))
                .andExpect(jsonPath("$.players[0].displayName").value("alice"))
                .andExpect(jsonPath("$.players[1].displayName").value("Bob"))
                .andExpect(jsonPath("$.players[2].displayName").value("Carol"))
                .andExpect(jsonPath("$.players[0].status").value("ALIVE"))
                .andExpect(jsonPath("$.players[1].status").value("ALIVE"))
                .andExpect(jsonPath("$.players[2].status").value("ALIVE"));
    }

    @Test
    void deadPlayerShowsDead() throws Exception {
        startAndRing();
        jdbc.update("update game.player set status = 'DEAD' where email = 'bob@example.com'");
        mvc.perform(as("alice@example.com", get(roster(gameId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players[1].displayName").value("Bob"))
                .andExpect(jsonPath("$.players[1].status").value("DEAD"));
    }

    @Test
    void removedPlayerShowsRemoved() throws Exception {
        startAndRing();
        jdbc.update("update game.player set status = 'REMOVED' where email = 'bob@example.com'");
        mvc.perform(as("alice@example.com", get(roster(gameId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players[1].status").value("REMOVED"));
    }

    @Test
    void lateJoinerIsWaitingWhileRingedPlayersAreAlive() throws Exception {
        startAndRing();
        insertPlayer(gameId, "dave@example.com", "Dave", "ALIVE");
        mvc.perform(as("dave@example.com", get(roster(gameId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players.length()").value(4))
                .andExpect(jsonPath("$.players[?(@.displayName=='Dave')].status").value("WAITING"))
                .andExpect(jsonPath("$.players[?(@.displayName=='alice')].status").value("ALIVE"))
                .andExpect(jsonPath("$.players[?(@.displayName=='Bob')].status").value("ALIVE"))
                .andExpect(jsonPath("$.players[?(@.displayName=='Carol')].status").value("ALIVE"));
    }

    @Test
    void deadOrRemovedPlayerWithoutAssignmentIsNeverWaiting() throws Exception {
        startAndRing();
        insertPlayer(gameId, "dave@example.com", "Dave", "DEAD");
        insertPlayer(gameId, "erin@example.com", "Erin", "REMOVED");
        mvc.perform(as("alice@example.com", get(roster(gameId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players[?(@.displayName=='Dave')].status").value("DEAD"))
                .andExpect(jsonPath("$.players[?(@.displayName=='Erin')].status").value("REMOVED"));
    }

    @Test
    void strangerGetsNotInGame() throws Exception {
        startAndRing();
        mvc.perform(as("stranger@example.com", get(roster(gameId))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
    }

    @Test
    void unknownGameIsNotFound() throws Exception {
        startAndRing();
        mvc.perform(as("alice@example.com", get(roster(UUID.randomUUID()))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
    }

    @Test
    void setupGameIsNotStarted() throws Exception {
        mvc.perform(as("alice@example.com", get(roster(gameId))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_STARTED"));
    }

    @Test
    void finishedGameStillShowsTheRoster() throws Exception {
        startAndRing();
        jdbc.update("update game.game set status = 'FINISHED', finished_at = now() where id = ?", gameId);
        mvc.perform(as("alice@example.com", get(roster(gameId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players.length()").value(3));
    }

    @Test
    void playerInGameACannotSeeGameB() throws Exception {
        startAndRing();
        UUID other = insertGame("XYZ789", "ACTIVE", true);
        insertPlayer(other, "zed@example.com", "Zed", "ALIVE");
        mvc.perform(as("alice@example.com", get(roster(other))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
        mvc.perform(as("zed@example.com", get(roster(gameId))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
    }

    @Test
    void entriesExposeOnlyDisplayNameAndStatus() throws Exception {
        startAndRing();
        mvc.perform(as("alice@example.com", get(roster(gameId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players[0].id").doesNotExist())
                .andExpect(jsonPath("$.players[0].email").doesNotExist())
                .andExpect(jsonPath("$.players[0].length()").value(2));
    }
}
