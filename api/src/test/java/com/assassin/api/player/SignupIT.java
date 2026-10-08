package com.assassin.api.player;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import com.assassin.api.JwtTestSupport;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class SignupIT extends IntegrationTest {

    private static final String ALICE = "Alice@Example.com";

    private ResultActions signup(String email, String displayName, String joinCode) throws Exception {
        String json = """
                {"displayName": "%s", "joinCode": "%s"}
                """.formatted(displayName, joinCode);
        return mvc.perform(as(email, post("/api/players").contentType(MediaType.APPLICATION_JSON).content(json)));
    }

    @Test
    void signupCopiesSubAndEmailAndMatchesJoinCodeCaseInsensitively() throws Exception {
        UUID gameId = insertGame("ABC123", "SETUP", true);

        signup(ALICE, "  Alice ", " abc123 ")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.displayName").value("Alice"))
                .andExpect(jsonPath("$.status").value("ALIVE"));

        Map<String, Object> row = jdbc.queryForMap("select * from game.player");
        assertThat(row.get("game_id")).isEqualTo(gameId);
        assertThat(row.get("auth_user_id")).isEqualTo(JwtTestSupport.subFor(ALICE));
        assertThat(row.get("email")).isEqualTo(ALICE);
        assertThat(row.get("display_name")).isEqualTo("Alice");
    }

    @Test
    void noLiveGame() throws Exception {
        insertGame("ABC123", "FINISHED", true);
        signup(ALICE, "Alice", "ABC123")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_LIVE_GAME"));
    }

    @Test
    void signupsClosed() throws Exception {
        insertGame("ABC123", "SETUP", false);
        signup(ALICE, "Alice", "ABC123")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SIGNUPS_CLOSED"));
    }

    @Test
    void badJoinCode() throws Exception {
        insertGame("ABC123", "SETUP", true);
        signup(ALICE, "Alice", "ABC124")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_JOIN_CODE"));
    }

    @Test
    void alreadyRegistered() throws Exception {
        insertGame("ABC123", "SETUP", true);
        signup(ALICE, "Alice", "ABC123").andExpect(status().isCreated());
        signup(ALICE, "Alice Again", "ABC123")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALREADY_REGISTERED"));
    }

    @Test
    void nameTakenCaseInsensitively() throws Exception {
        insertGame("ABC123", "SETUP", true);
        signup(ALICE, "Alice", "ABC123").andExpect(status().isCreated());
        signup("bob@example.com", "ALICE", "ABC123")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NAME_TAKEN"));
    }

    @Test
    void validationFailed() throws Exception {
        insertGame("ABC123", "SETUP", true);
        signup(ALICE, " A ", "ABC123")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("displayName"));
        signup(ALICE, "A".repeat(33), "ABC123")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        signup(ALICE, "Alice", "")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void malformedJsonIsBadRequest() throws Exception {
        mvc.perform(as(ALICE, post("/api/players").contentType(MediaType.APPLICATION_JSON).content("{")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void lateJoinerIsAllowedWhileGameIsActive() throws Exception {
        insertGame("ABC123", "ACTIVE", true);
        signup(ALICE, "Alice", "ABC123").andExpect(status().isCreated());
    }
}
