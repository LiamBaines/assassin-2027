package com.assassin.api.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import com.assassin.api.JwtTestSupport;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

class SecurityIT extends IntegrationTest {

    private static final String USER = "player@example.com";

    private static MockHttpServletRequestBuilder withToken(String token, MockHttpServletRequestBuilder request) {
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private int statusOf(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request).andReturn().getResponse().getStatus();
    }

    @Test
    void healthIsPublic() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void missingTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/games")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/join/ABC123")).andExpect(status().isUnauthorized());
    }

    @Test
    void validUserTokenIsAccepted() throws Exception {
        assertThat(statusOf(withToken(JwtTestSupport.token(USER), get("/api/me")))).isNotIn(401, 403);
    }

    @Test
    void badIssuerIsUnauthorized() throws Exception {
        String token = JwtTestSupport.sign(JwtTestSupport.claims(USER).issuer("https://evil.test/auth/v1").build());
        mvc.perform(withToken(token, get("/api/me"))).andExpect(status().isUnauthorized());
    }

    @Test
    void badAudienceIsUnauthorized() throws Exception {
        String token = JwtTestSupport.sign(JwtTestSupport.claims(USER).audience("anon").build());
        mvc.perform(withToken(token, get("/api/me"))).andExpect(status().isUnauthorized());
    }

    @Test
    void expiredTokenIsUnauthorized() throws Exception {
        Instant past = Instant.now().minusSeconds(7200);
        String token = JwtTestSupport.sign(JwtTestSupport.claims(USER)
                .issueTime(Date.from(past))
                .expirationTime(Date.from(past.plusSeconds(3600)))
                .build());
        mvc.perform(withToken(token, get("/api/me"))).andExpect(status().isUnauthorized());
    }

    @Test
    void tokenSignedWithUnknownKeyIsUnauthorized() throws Exception {
        String token = JwtTestSupport.sign(JwtTestSupport.claims(USER).build(), JwtTestSupport.generateKey());
        mvc.perform(withToken(token, get("/api/me"))).andExpect(status().isUnauthorized());
    }

    @Test
    void nonAdminIsForbiddenOnAdminRoutes() throws Exception {
        UUID gameId = insertGame("ABC123", "SETUP", true);
        UUID playerId = insertPlayer(gameId, USER, "Player", "ALIVE");
        String game = "/api/admin/games/" + gameId;
        String json = MediaType.APPLICATION_JSON_VALUE;
        for (MockHttpServletRequestBuilder request : List.of(
                get("/api/admin/games"),
                post("/api/admin/games").contentType(json).content("{\"name\": \"x\", \"joinCode\": \"XYZ789\"}"),
                get(game),
                patch(game).contentType(json).content("{\"name\": \"x\"}"),
                get(game + "/players"),
                patch(game + "/players/" + playerId).contentType(json).content("{\"status\": \"REMOVED\"}"),
                post(game + "/rings").contentType(json).content("{\"expectedCurrentRoundNo\": null}"),
                get(game + "/rings/current"),
                get(game + "/rings"))) {
            mvc.perform(as(USER, request)).andExpect(status().isForbidden());
        }
        assertThat(jdbc.queryForObject("select count(*) from game.game", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select name from game.game", String.class)).isEqualTo("Test game");
        assertThat(jdbc.queryForObject("select status from game.player", String.class)).isEqualTo("ALIVE");
    }

    @Test
    void unauthorizedIsProblemDetailWithCode() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        String expired = JwtTestSupport.sign(JwtTestSupport.claims(USER)
                .expirationTime(Date.from(Instant.now().minusSeconds(60)))
                .build());
        mvc.perform(withToken(expired, get("/api/me")))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE,
                        org.hamcrest.Matchers.containsString("invalid_token")))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void forbiddenIsProblemDetailWithCode() throws Exception {
        mvc.perform(as(USER, get("/api/admin/games")))
                .andExpect(status().isForbidden())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE,
                        org.hamcrest.Matchers.containsString("insufficient_scope")))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void allowlistedEmailInMixedCaseIsAdmin() throws Exception {
        UUID gameId = insertGame("ABC123", "SETUP", true);
        mvc.perform(as("Admin@Example.COM", get("/api/admin/games"))).andExpect(status().isOk());
        mvc.perform(as("SECOND.admin@example.com", get("/api/admin/games/" + gameId + "/players")))
                .andExpect(status().isOk());
        mvc.perform(as("Admin@Example.COM", get("/api/admin/games/" + gameId + "/rings"))).andExpect(status().isOk());
    }
}
