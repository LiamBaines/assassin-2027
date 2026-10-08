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
        mvc.perform(asAdmin(post("/api/admin/rings").contentType(MediaType.APPLICATION_JSON)
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
                     where a.status = 'ACTIVE' and me.email = ?
                    """, String.class, email);
            mvc.perform(as(email, get("/api/me/target")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.target.displayName").value(expected))
                    .andExpect(jsonPath("$.target.displayName").value(Matchers.not(emailToName.get(email))))
                    .andExpect(jsonPath("$.target.id").doesNotExist())
                    .andExpect(jsonPath("$.assignedAt").isNotEmpty());
        }
    }

    @Test
    void noTargetBeforeRing() throws Exception {
        mvc.perform(as("alice@example.com", get("/api/me/target")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_TARGET"));
    }

    @Test
    void nonPlayerHasNoTarget() throws Exception {
        shuffle(null);
        mvc.perform(as("stranger@example.com", get("/api/me/target")))
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
        mvc.perform(as("erin@example.com", get("/api/me/target")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_TARGET"));
        emailToName.put("erin@example.com", "Erin");
        shuffle(1);
        assertEveryTargetMatchesRing();
    }
}
