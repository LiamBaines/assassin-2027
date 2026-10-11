package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class KillMethodRoundIT extends IntegrationTest {

    private UUID gameId;
    private UUID a;
    private UUID b;

    @BeforeEach
    void setUp() {
        gameId = insertGame("KMR123", "SETUP", true);
        a = insertPlayer(gameId, "a@example.com", "Alice", "ALIVE");
        b = insertPlayer(gameId, "b@example.com", "Bob", "ALIVE");
    }

    private long methodId(String name) {
        return jdbc.queryForObject("select id from game.kill_method where game_id = ? and name = ?", Long.class, gameId, name);
    }

    private ResultActions ring(Integer expected, String methods) throws Exception {
        String extra = methods == null ? "" : ", \"killMethods\": " + methods;
        return mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings")
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedCurrentRoundNo\": " + expected + extra + "}")));
    }

    private ResultActions round(int expected, String methods) throws Exception {
        String extra = methods == null ? "" : ", \"killMethods\": " + methods;
        return mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rounds")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedRoundNo\": " + expected + ", \"playerIds\": [\"" + a + "\",\"" + b + "\"]" + extra + "}")));
    }

    @Test
    void generateRingAppliesEditsAndAdds() throws Exception {
        ring(null, "[{\"id\": " + methodId("Clamp") + ", \"name\": \"Garrotte\", \"points\": 12, \"enabled\": true},"
                + "{\"id\": " + methodId("Duel") + ", \"name\": \"Duel\", \"points\": 15, \"enabled\": false},"
                + "{\"name\": \"Sniper\", \"points\": 20, \"enabled\": true}]").andExpect(status().isCreated());

        mvc.perform(asAdmin(get("/api/admin/games/" + gameId + "/kill-methods")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].name").value("Garrotte"))
                .andExpect(jsonPath("$[0].points").value(12))
                .andExpect(jsonPath("$[1].enabled").value(false))
                .andExpect(jsonPath("$[2].name").value("Sniper"));
    }

    @Test
    void startRoundAppliesEditsAndOmittedIsUnchanged() throws Exception {
        ring(null, null).andExpect(status().isCreated());
        round(1, null).andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("select count(*) from game.kill_method where game_id = ? and enabled", Integer.class,
                gameId)).isEqualTo(2);

        round(2, "[{\"id\": " + methodId("Duel") + ", \"name\": \"Duel\", \"points\": 25, \"enabled\": false}]")
                .andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("select points from game.kill_method where id = ?", Integer.class, methodId("Duel")))
                .isEqualTo(25);
        assertThat(jdbc.queryForObject("select enabled from game.kill_method where id = ?", Boolean.class, methodId("Duel")))
                .isFalse();
    }

    @Test
    void rejectsInvalidEditsAndRollsBack() throws Exception {
        ring(null, "[{\"id\": " + methodId("Clamp") + ", \"name\": \"Clamp\", \"points\": 10, \"enabled\": false},"
                + "{\"id\": " + methodId("Duel") + ", \"name\": \"Duel\", \"points\": 15, \"enabled\": false}]")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NO_ENABLED_METHODS"));
        ring(null, "[{\"name\": \"clamp\", \"points\": 1, \"enabled\": true}]")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("KILL_METHOD_NAME_TAKEN"));
        ring(null, "[{\"name\": \"Neg\", \"points\": -1, \"enabled\": true}]")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_KILL_METHOD"));
        ring(null, "[{\"id\": 999999, \"name\": \"X\", \"points\": 1, \"enabled\": true}]")
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("KILL_METHOD_NOT_FOUND"));

        assertThat(jdbc.queryForObject("select count(*) from game.kill_method where game_id = ? and enabled", Integer.class,
                gameId)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from game.game_round", Integer.class)).isZero();
    }

    @Test
    void startRoundNeedsAnEnabledMethod() throws Exception {
        ring(null, null).andExpect(status().isCreated());
        round(1, "[{\"id\": " + methodId("Clamp") + ", \"name\": \"Clamp\", \"points\": 10, \"enabled\": false},"
                + "{\"id\": " + methodId("Duel") + ", \"name\": \"Duel\", \"points\": 15, \"enabled\": false}]")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NO_ENABLED_METHODS"));
        assertThat(jdbc.queryForObject("select count(*) from game.game_round", Integer.class)).isEqualTo(1);
    }

    @Test
    void shakeupCannotChangeMethods() throws Exception {
        ring(null, null).andExpect(status().isCreated());
        ring(1, "[{\"name\": \"Sniper\", \"points\": 20, \"enabled\": true}]")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("KILL_METHODS_LOCKED"));
        ring(1, null).andExpect(status().isCreated());
    }

    @Test
    void playersSeeOnlyEnabledMethodsOfTheirGame() throws Exception {
        jdbc.update("update game.kill_method set enabled = false where game_id = ? and name = 'Duel'", gameId);
        mvc.perform(as("a@example.com", get("/api/me/games/" + gameId + "/kill-methods")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Clamp"));
        mvc.perform(as("stranger@example.com", get("/api/me/games/" + gameId + "/kill-methods")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
        mvc.perform(asAdmin(get("/api/admin/games/" + UUID.randomUUID() + "/kill-methods")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }
}
