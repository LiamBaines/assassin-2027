package com.assassin.api.game;

import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class AdminGameIT extends IntegrationTest {

    private ResultActions create(String json) throws Exception {
        return mvc.perform(asAdmin(post("/api/admin/game").contentType(MediaType.APPLICATION_JSON).content(json)));
    }

    private ResultActions update(String json) throws Exception {
        return mvc.perform(asAdmin(patch("/api/admin/game").contentType(MediaType.APPLICATION_JSON).content(json)));
    }

    @Test
    void getWithoutLiveGameIs404() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/game")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_LIVE_GAME"));
    }

    @Test
    void createNormalizesJoinCodeAndStartsInSetup() throws Exception {
        create("""
                {"name": " Spring 2027 ", "joinCode": " test42ab "}
                """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(notNullValue()))
                .andExpect(jsonPath("$.name").value("Spring 2027"))
                .andExpect(jsonPath("$.joinCode").value("TEST42AB"))
                .andExpect(jsonPath("$.status").value("SETUP"))
                .andExpect(jsonPath("$.signupsOpen").value(true))
                .andExpect(jsonPath("$.startedAt").value(nullValue()));

        mvc.perform(asAdmin(get("/api/admin/game")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.joinCode").value("TEST42AB"));
    }

    @Test
    void createRejectsInvalidInput() throws Exception {
        create("""
                {"name": "", "joinCode": "abc"}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors.length()").value(2));
    }

    @Test
    void secondLiveGameIsRejected() throws Exception {
        create("""
                {"name": "One", "joinCode": "AAAAAA"}
                """).andExpect(status().isCreated());
        create("""
                {"name": "Two", "joinCode": "BBBBBB"}
                """)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LIVE_GAME_EXISTS"));
    }

    @Test
    void patchEditsFields() throws Exception {
        create("""
                {"name": "One", "joinCode": "AAAAAA"}
                """).andExpect(status().isCreated());
        update("""
                {"name": "Renamed", "joinCode": "bbbbbb", "signupsOpen": false}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"))
                .andExpect(jsonPath("$.joinCode").value("BBBBBB"))
                .andExpect(jsonPath("$.signupsOpen").value(false))
                .andExpect(jsonPath("$.status").value("SETUP"));
    }

    @Test
    void patchStatusOnlyToFinished() throws Exception {
        create("""
                {"name": "One", "joinCode": "AAAAAA"}
                """).andExpect(status().isCreated());
        update("""
                {"status": "ACTIVE"}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS"));
    }

    @Test
    void finishingAllowsANewGame() throws Exception {
        create("""
                {"name": "One", "joinCode": "AAAAAA"}
                """).andExpect(status().isCreated());
        update("""
                {"status": "FINISHED"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FINISHED"))
                .andExpect(jsonPath("$.finishedAt").value(notNullValue()));

        mvc.perform(asAdmin(get("/api/admin/game"))).andExpect(status().isNotFound());
        update("""
                {"name": "x"}
                """).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NO_LIVE_GAME"));

        create("""
                {"name": "Two", "joinCode": "BBBBBB"}
                """).andExpect(status().isCreated());
    }
}
