package com.assassin.api.targeting;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class TargetIT extends IntegrationTest {

    private UUID gameId;
    private final Map<String, String> emailToName = new LinkedHashMap<>();

    @BeforeEach
    void seed() {
        gameId = insertGame("ABC123", "SETUP", true);
        emailToName.clear();
        for (String name : new String[] {"Alice", "Bob", "Carol", "Dave"}) {
            String email = name.toLowerCase() + "@example.com";
            insertPlayer(gameId, email, name, "ALIVE");
            emailToName.put(email, name);
        }
    }

    private void shuffle(Integer expected) throws Exception {
        shuffle(gameId, expected);
    }

    private void shuffle(UUID game, Integer expected) throws Exception {
        mvc.perform(asAdmin(post("/api/admin/games/" + game + "/rings").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedCurrentRoundNo\": " + expected + "}")))
                .andExpect(status().isCreated());
    }

    private void assertEveryTargetMatchesRing() throws Exception {
        for (String email : emailToName.keySet()) {
            String expected = jdbc.queryForObject("""
                    select t.display_name
                      from game.assignment a
                      join game.player me on me.id = a.assassin_id
                      join game.player t on t.id = a.target_id
                     where a.status = 'ACTIVE' and me.email = ? and a.game_id = ?
                    """, String.class, email, gameId);
            mvc.perform(as(email, get("/api/me/games/" + gameId + "/target")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.target.displayName").value(expected))
                    .andExpect(jsonPath("$.target.displayName").value(Matchers.not(emailToName.get(email))))
                    .andExpect(jsonPath("$.target.id").doesNotExist())
                    .andExpect(jsonPath("$.assignedAt").isNotEmpty());
        }
    }

    @Test
    void noTargetBeforeRing() throws Exception {
        mvc.perform(as("alice@example.com", get("/api/me/games/" + gameId + "/target")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_TARGET"));
    }

    @Test
    void nonPlayerHasNoTarget() throws Exception {
        shuffle(null);
        mvc.perform(as("stranger@example.com", get("/api/me/games/" + gameId + "/target")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_TARGET"));
    }

    @Test
    void targetsMatchTheRingAcrossShakeups() throws Exception {
        shuffle(null);
        assertEveryTargetMatchesRing();
        shuffle(1);
        assertEveryTargetMatchesRing();
    }

    @Test
    void lateJoinerHasNoTargetUntilNextShakeup() throws Exception {
        shuffle(null);
        insertPlayer(gameId, "erin@example.com", "Erin", "ALIVE");
        mvc.perform(as("erin@example.com", get("/api/me/games/" + gameId + "/target")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_TARGET"));
        emailToName.put("erin@example.com", "Erin");
        shuffle(1);
        assertEveryTargetMatchesRing();
    }

    @Test
    void unknownGameHasNoTarget() throws Exception {
        shuffle(null);
        mvc.perform(as("alice@example.com", get("/api/me/games/" + UUID.randomUUID() + "/target")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_TARGET"));
    }

    @Test
    void aPlayerInTwoGamesHasATargetInEach() throws Exception {
        UUID other = insertGame("XYZ789", "SETUP", true);
        insertPlayer(other, "alice@example.com", "Ally", "ALIVE");
        insertPlayer(other, "zed@example.com", "Zed", "ALIVE");
        shuffle(null);

        // Before the other game's ring, Alice has a target here but not there.
        mvc.perform(as("alice@example.com", get("/api/me/games/" + other + "/target")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_TARGET"));
        assertEveryTargetMatchesRing();

        shuffle(other, null);
        // A two-player ring: Alice ("Ally") and Zed target each other.
        mvc.perform(as("alice@example.com", get("/api/me/games/" + other + "/target")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.target.displayName").value("Zed"));
        mvc.perform(as("zed@example.com", get("/api/me/games/" + other + "/target")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.target.displayName").value("Ally"));
        // Zed doesn't play in the first game.
        mvc.perform(as("zed@example.com", get("/api/me/games/" + gameId + "/target")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_TARGET"));
        assertEveryTargetMatchesRing();

        mvc.perform(as("alice@example.com", get("/api/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.games.length()").value(2));
    }

    @Test
    void aFinishedGameStillShowsTheLastTarget() throws Exception {
        shuffle(null);
        jdbc.update("update game.game set status = 'FINISHED', finished_at = now() where id = ?", gameId);
        assertEveryTargetMatchesRing();
    }
}
