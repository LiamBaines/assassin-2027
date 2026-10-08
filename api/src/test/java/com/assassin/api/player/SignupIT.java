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
                .andExpect(jsonPath("$.game.id").value(gameId.toString()))
                .andExpect(jsonPath("$.game.name").value("Test game"))
                .andExpect(jsonPath("$.game.status").value("SETUP"))
                .andExpect(jsonPath("$.game.signupsOpen").value(true))
                .andExpect(jsonPath("$.game.joinCode").doesNotExist())
                .andExpect(jsonPath("$.player.id").isNotEmpty())
                .andExpect(jsonPath("$.player.displayName").value("Alice"))
                .andExpect(jsonPath("$.player.status").value("ALIVE"))
                .andExpect(jsonPath("$.player.joinedAt").isNotEmpty());

        Map<String, Object> row = jdbc.queryForMap("select * from game.player");
        assertThat(row.get("game_id")).isEqualTo(gameId);
        assertThat(row.get("auth_user_id")).isEqualTo(JwtTestSupport.subFor(ALICE));
        assertThat(row.get("email")).isEqualTo(ALICE);
        assertThat(row.get("display_name")).isEqualTo("Alice");
    }

    @Test
    void aFinishedGamesCodeIsABadJoinCode() throws Exception {
        insertGame("ABC123", "FINISHED", true);
        signup("finished.code@example.com", "Alice", "ABC123")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_JOIN_CODE"));
    }

    @Test
    void theCodePicksTheGame() throws Exception {
        insertGame("Old", "ABC123", "FINISHED", true);
        UUID one = insertGame("One", "ABC123", "ACTIVE", true);
        UUID two = insertGame("Two", "XYZ789", "SETUP", true);

        signup(ALICE, "Alice", "xyz789").andExpect(status().isCreated())
                .andExpect(jsonPath("$.game.id").value(two.toString()))
                .andExpect(jsonPath("$.game.name").value("Two"));
        // The same account and display name may join another game.
        signup(ALICE, "Alice", "ABC123").andExpect(status().isCreated())
                .andExpect(jsonPath("$.game.id").value(one.toString()));

        assertThat(jdbc.queryForList("select game_id from game.player", UUID.class))
                .containsExactlyInAnyOrder(one, two);
    }

    @Test
    void signupsClosed() throws Exception {
        insertGame("ABC123", "SETUP", false);
        signup(ALICE, "Alice", "ABC123")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SIGNUPS_CLOSED"));
    }

    @Test
    void closedSignupsInOneGameDoNotAffectAnother() throws Exception {
        insertGame("ABC123", "SETUP", false);
        insertGame("XYZ789", "SETUP", true);
        signup(ALICE, "Alice", "XYZ789").andExpect(status().isCreated());
    }

    @Test
    void badJoinCode() throws Exception {
        insertGame("ABC123", "SETUP", true);
        signup("bad.code@example.com", "Alice", "ABC124")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_JOIN_CODE"));
    }

    @Test
    void wrongJoinCodesAreRateLimitedPerAccount() throws Exception {
        insertGame("ABC123", "SETUP", true);
        String guesser = "guesser@example.com";
        for (int i = 0; i < JoinCodeAttemptLimiter.MAX_FAILURES; i++) {
            signup(guesser, "Guesser", "WRONG" + i + "X").andExpect(status().isBadRequest());
        }
        signup(guesser, "Guesser", "ABC123")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
        // Other accounts are unaffected.
        signup("bystander@example.com", "Bystander", "ABC123").andExpect(status().isCreated());
    }

    @Test
    void displayNamesAreMeasuredInCodePointsAndMustBeVisible() throws Exception {
        insertGame("ABC123", "SETUP", true);
        signup(ALICE, "\uD83D\uDD2A", "ABC123")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_DISPLAY_NAME"));
        signup(ALICE, "Ali\u200Bce", "ABC123")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_DISPLAY_NAME"));
        signup(ALICE, "\uD83D\uDD2A\uD83D\uDD2A", "ABC123").andExpect(status().isCreated());
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
    void alreadyRegisteredIsPerGame() throws Exception {
        insertGame("ABC123", "SETUP", true);
        insertGame("XYZ789", "SETUP", true);
        signup(ALICE, "Alice", "ABC123").andExpect(status().isCreated());
        signup(ALICE, "Alice", "XYZ789").andExpect(status().isCreated());
        signup(ALICE, "Alice", "XYZ789")
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
