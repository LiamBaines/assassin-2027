package com.assassin.api.player;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import org.junit.jupiter.api.Test;

class ProfileIT extends IntegrationTest {

    private static final String ALICE = "alice@example.com";

    @Test
    void setsTheNameOnceAndMeReturnsIt() throws Exception {
        mvc.perform(as(ALICE, put("/api/me/profile")).contentType(APPLICATION_JSON)
                        .content("{\"displayName\":\"  Alice A  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.displayName").value("Alice A"));
        mvc.perform(as(ALICE, get("/api/me")))
                .andExpect(jsonPath("$.profile.displayName").value("Alice A"));
    }

    @Test
    void cannotBeChangedOnceSet() throws Exception {
        setName(ALICE, "Alice A");
        mvc.perform(as(ALICE, put("/api/me/profile")).contentType(APPLICATION_JSON)
                        .content("{\"displayName\":\"Someone Else\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROFILE_EXISTS"));
        assertThat(jdbc.queryForObject("select display_name from game.profile", String.class)).isEqualTo("Alice A");
    }

    @Test
    void sameNameIsAllowedForDifferentAccounts() throws Exception {
        setName(ALICE, "Sam");
        setName("bob@example.com", "sam");
        assertThat(jdbc.queryForObject("select count(*) from game.profile", Integer.class)).isEqualTo(2);
    }

    @Test
    void rejectsInvalidNames() throws Exception {
        for (String name : new String[] {"A", "x".repeat(33), "Al​ice"}) {
            mvc.perform(as(ALICE, put("/api/me/profile")).contentType(APPLICATION_JSON)
                            .content("{\"displayName\":\"" + name + "\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_DISPLAY_NAME"));
        }
        assertThat(jdbc.queryForObject("select count(*) from game.profile", Integer.class)).isZero();
    }

    private void setName(String email, String name) throws Exception {
        mvc.perform(as(email, put("/api/me/profile")).contentType(APPLICATION_JSON)
                        .content("{\"displayName\":\"" + name + "\"}"))
                .andExpect(status().isCreated());
    }
}
