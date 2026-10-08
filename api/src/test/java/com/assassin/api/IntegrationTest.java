package com.assassin.api;

import java.util.UUID;
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

    /** Inserts a game directly; returns its id. */
    protected UUID insertGame(String joinCode, String status, boolean signupsOpen) {
        return jdbc.queryForObject(
                "insert into game.game (name, join_code, status, signups_open) values ('Test game', ?, ?, ?) returning id",
                UUID.class, joinCode, status, signupsOpen);
    }

    /** Inserts a player directly, with the {@code sub} test tokens use for {@code email}; returns its id. */
    protected UUID insertPlayer(UUID gameId, String email, String displayName, String status) {
        return jdbc.queryForObject("""
                insert into game.player (game_id, auth_user_id, email, display_name, status)
                values (?, ?, ?, ?, ?) returning id
                """, UUID.class, gameId, JwtTestSupport.subFor(email), email, displayName, status);
    }

    protected static MockHttpServletRequestBuilder as(String email, MockHttpServletRequestBuilder request) {
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + JwtTestSupport.token(email));
    }

    protected static MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder request) {
        return as(JwtTestSupport.ADMIN_EMAIL, request);
    }
}
