package com.assassin.api;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Base for ITs: one shared Spring context, Postgres 17 container and test JWT key; tables emptied per test. */
@SpringBootTest(properties = {
        "app.supabase-url=" + JwtTestSupport.SUPABASE_URL,
        "app.admin-emails=" + JwtTestSupport.ADMIN_EMAIL + ",second.admin@example.com"
})
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, JwtTestSupport.class})
public abstract class IntegrationTest {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcTemplate jdbc;

    @BeforeEach
    void truncateGameTables() {
        jdbc.execute("truncate game.assignment, game.assignment_round, game.player, game.game");
    }

    protected static MockHttpServletRequestBuilder as(String email, MockHttpServletRequestBuilder request) {
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + JwtTestSupport.token(email));
    }

    protected static MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder request) {
        return as(JwtTestSupport.ADMIN_EMAIL, request);
    }
}
