package com.assassin.api.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import com.assassin.api.JwtTestSupport;
import java.time.Instant;
import java.util.Date;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
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
        mvc.perform(get("/api/admin/game")).andExpect(status().isUnauthorized());
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
        mvc.perform(as(USER, get("/api/admin/game"))).andExpect(status().isForbidden());
        mvc.perform(as(USER, get("/api/admin/players"))).andExpect(status().isForbidden());
        mvc.perform(as(USER, get("/api/admin/rings"))).andExpect(status().isForbidden());
    }

    @Test
    void allowlistedEmailInMixedCaseIsAdmin() throws Exception {
        insertGame("ABC123", "SETUP", true);
        mvc.perform(as("Admin@Example.COM", get("/api/admin/game"))).andExpect(status().isOk());
        mvc.perform(as("SECOND.admin@example.com", get("/api/admin/game"))).andExpect(status().isOk());
    }
}
