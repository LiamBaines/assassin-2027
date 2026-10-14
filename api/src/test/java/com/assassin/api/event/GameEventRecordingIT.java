package com.assassin.api.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class GameEventRecordingIT extends IntegrationTest {

    private final ObjectMapper json = new ObjectMapper();
    private UUID gameId;
    private UUID alice;
    private UUID bob;
    private UUID carol;

    @BeforeEach
    void seed() {
        gameId = insertGame("EVT456", "SETUP", true);
        alice = insertPlayer(gameId, "alice@example.com", "Alice", "ALIVE");
        bob = insertPlayer(gameId, "bob@example.com", "Bob", "ALIVE");
        carol = insertPlayer(gameId, "carol@example.com", "Carol", "ALIVE");
    }

    /** Events of the game, oldest first. */
    private List<JsonNode> events() throws Exception {
        return jdbc.query("select type, payload::text as payload from game.game_event where game_id = ? order by id",
                (rs, i) -> {
                    ObjectNode n = json.createObjectNode().put("type", rs.getString("type"));
                    try {
                        n.set("data", json.readTree(rs.getString("payload")));
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                    return (JsonNode) n;
                }, gameId);
    }

    private void ring(Integer expected) throws Exception {
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": " + expected + "}"))).andExpect(status().isCreated());
    }

    @Test
    void signupRecordsPlayerJoined() throws Exception {
        mvc.perform(as("dave@example.com", post("/api/players").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\": \"Dave\", \"joinCode\": \"EVT456\"}"))).andExpect(status().isCreated());
        JsonNode e = events().getLast();
        assertThat(e.get("type").asText()).isEqualTo("PLAYER_JOINED");
        assertThat(e.at("/data/player/displayName").asText()).isEqualTo("Dave");
        assertThat(e.at("/data/player/id").asText()).isNotBlank();
    }

    @Test
    void firstRingRecordsRoundStartedThenShakeup() throws Exception {
        ring(null);
        JsonNode first = events().getLast();
        assertThat(first.get("type").asText()).isEqualTo("ROUND_STARTED");
        assertThat(first.at("/data/roundNo").asInt()).isEqualTo(1);
        assertThat(first.at("/data/playerCount").asInt()).isEqualTo(3);

        ring(1);
        JsonNode second = events().getLast();
        assertThat(second.get("type").asText()).isEqualTo("SHAKEUP");
        assertThat(second.at("/data/roundNo").asInt()).isEqualTo(1);
    }

    @Test
    void startRoundRecordsRoundStarted() throws Exception {
        ring(null);
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rounds").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedRoundNo\": 1, \"playerIds\": [\"" + alice + "\",\"" + bob + "\"]}")))
                .andExpect(status().isCreated());
        JsonNode e = events().getLast();
        assertThat(e.get("type").asText()).isEqualTo("ROUND_STARTED");
        assertThat(e.at("/data/roundNo").asInt()).isEqualTo(2);
        assertThat(e.at("/data/playerCount").asInt()).isEqualTo(2);
    }

    @Test
    void killRecordsKillerVictimAndMethod() throws Exception {
        ring(null);
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/kills").contentType(MediaType.APPLICATION_JSON)
                .content("{\"victimId\": \"" + bob + "\", \"killMethodId\": " + methodId(gameId, "Clamp") + "}")))
                .andExpect(status().isCreated());
        JsonNode e = events().getLast();
        assertThat(e.get("type").asText()).isEqualTo("KILL");
        assertThat(e.at("/data/victim/displayName").asText()).isEqualTo("Bob");
        assertThat(e.at("/data/killer/id").asText()).isNotBlank();
        assertThat(e.at("/data/method/name").asText()).isEqualTo("Clamp");
    }

    @Test
    void removeAndRestoreRecordEvents() throws Exception {
        setStatus(carol, "REMOVED");
        setStatus(carol, "ALIVE");
        List<JsonNode> all = events();
        assertThat(all).extracting(n -> n.get("type").asText()).containsExactly("PLAYER_REMOVED", "PLAYER_RESTORED");
        assertThat(all.get(0).at("/data/player/displayName").asText()).isEqualTo("Carol");
    }

    private void setStatus(UUID player, String status) throws Exception {
        mvc.perform(asAdmin(patch("/api/admin/games/" + gameId + "/players/" + player)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\": \"" + status + "\"}")))
                .andExpect(status().isOk());
    }
}
