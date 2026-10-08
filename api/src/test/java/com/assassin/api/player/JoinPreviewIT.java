package com.assassin.api.player;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class JoinPreviewIT extends IntegrationTest {

    private ResultActions preview(String email, String code) throws Exception {
        return mvc.perform(as(email, get("/api/join/" + code)));
    }

    @Test
    void previewShowsTheLiveGameForTheCode() throws Exception {
        UUID gameId = insertGame("Spring 2027", "ABC123", "SETUP", true);
        insertGame("Other", "XYZ789", "ACTIVE", true);

        preview("viewer@example.com", "abc123")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gameId").value(gameId.toString()))
                .andExpect(jsonPath("$.name").value("Spring 2027"))
                .andExpect(jsonPath("$.status").value("SETUP"))
                .andExpect(jsonPath("$.signupsOpen").value(true))
                .andExpect(jsonPath("$.alreadyJoined").value(false))
                .andExpect(jsonPath("$.joinCode").doesNotExist());
    }

    @Test
    void alreadyJoinedIsTrueForAPlayerOfThatGameOnly() throws Exception {
        UUID one = insertGame("One", "ABC123", "ACTIVE", true);
        insertGame("Two", "XYZ789", "ACTIVE", true);
        insertPlayer(one, "joined@example.com", "Joined", "ALIVE");

        preview("joined@example.com", "ABC123")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.alreadyJoined").value(true));
        preview("joined@example.com", "XYZ789")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alreadyJoined").value(false));
    }

    @Test
    void closedSignupsStillPreview() throws Exception {
        insertGame("Closed", "ABC123", "ACTIVE", false);
        preview("closed.viewer@example.com", "ABC123")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Closed"))
                .andExpect(jsonPath("$.signupsOpen").value(false));
    }

    @Test
    void unknownOrFinishedCodeIsBadJoinCode() throws Exception {
        insertGame("Done", "ABC123", "FINISHED", true);
        preview("unknown.viewer@example.com", "ABC123")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BAD_JOIN_CODE"));
        preview("unknown.viewer@example.com", "NOPE99")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BAD_JOIN_CODE"));
    }

    @Test
    void finishedCodeReusedByANewGamePreviewsTheNewGame() throws Exception {
        insertGame("Old", "ABC123", "FINISHED", true);
        UUID fresh = insertGame("New", "ABC123", "SETUP", true);
        preview("reuse.viewer@example.com", "ABC123")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gameId").value(fresh.toString()));
    }

    @Test
    void unknownCodesCountTowardsTheAttemptLimit() throws Exception {
        insertGame("Real", "ABC123", "SETUP", true);
        String guesser = "preview.guesser@example.com";
        for (int i = 0; i < JoinCodeAttemptLimiter.MAX_FAILURES; i++) {
            preview(guesser, "WRONG" + i + "X").andExpect(status().isNotFound());
        }
        preview(guesser, "ABC123")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
        // The limit is shared with signup.
        mvc.perform(as(guesser, post("/api/players").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\": \"Guesser\", \"joinCode\": \"ABC123\"}")))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
        // Other accounts are unaffected.
        preview("preview.bystander@example.com", "ABC123").andExpect(status().isOk());
    }

    @Test
    void requiresALogin() throws Exception {
        insertGame("Real", "ABC123", "SETUP", true);
        mvc.perform(get("/api/join/ABC123")).andExpect(status().isUnauthorized());
    }
}
