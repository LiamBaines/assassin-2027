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
        mvc.perform(asAdmin(post("/api/admin/rings").contentType(MediaType.APPLICATION_JSON).content("{}")))
                .andExpect(status().isCreated());
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
    void playerInActiveRingCannotBeRemoved() throws Exception {
        shuffle();
        setStatus(alice, "REMOVED")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IN_ACTIVE_RING"));
        assertThat(jdbc.queryForObject("select status from game.player where id = ?", String.class, alice))
                .isEqualTo("ALIVE");
    }

    @Test
    void lateJoinerOutsideRingCanBeRemovedWhileActive() throws Exception {
        shuffle();
        UUID dave = insertPlayer(gameId, "dave@example.com", "Dave", "ALIVE");
        setStatus(dave, "REMOVED").andExpect(status().isOk());
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
