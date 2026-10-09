package com.assassin.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
        jdbc.execute("truncate game.kill_claim, game.kill, game.assignment, game.assignment_round, game.player, game.game");
    }

    /** Inserts a game directly; returns its id. */
    protected UUID insertGame(String joinCode, String status, boolean signupsOpen) {
        return insertGame("Test game", joinCode, status, signupsOpen);
    }

    protected UUID insertGame(String name, String joinCode, String status, boolean signupsOpen) {
        return jdbc.queryForObject(
                "insert into game.game (name, join_code, status, signups_open) values (?, ?, ?, ?) returning id",
                UUID.class, name, joinCode, status, signupsOpen);
    }

    /** Inserts a player directly, with the {@code sub} test tokens use for {@code email}; returns its id. */
    protected UUID insertPlayer(UUID gameId, String email, String displayName, String status) {
        return jdbc.queryForObject("""
                insert into game.player (game_id, auth_user_id, email, display_name, status)
                values (?, ?, ?, ?, ?) returning id
                """, UUID.class, gameId, JwtTestSupport.subFor(email), email, displayName, status);
    }

    /** assassin -> target for all ACTIVE rows, checked to form one cycle over exactly {@code players}. */
    protected Map<UUID, UUID> assertActiveRingCovers(List<UUID> players) {
        Map<UUID, UUID> next = new HashMap<>();
        jdbc.query("select assassin_id, target_id from game.assignment where status = 'ACTIVE'",
                rs -> {
                    next.put(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class));
                });
        return assertOneCycle(next, players);
    }

    /** Same as {@link #assertActiveRingCovers(List)}, for the ACTIVE rows of one game only. */
    protected Map<UUID, UUID> assertActiveRingCovers(UUID gameId, List<UUID> players) {
        Map<UUID, UUID> next = new HashMap<>();
        jdbc.query("select assassin_id, target_id from game.assignment where status = 'ACTIVE' and game_id = ?",
                rs -> {
                    next.put(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class));
                }, gameId);
        return assertOneCycle(next, players);
    }

    private static Map<UUID, UUID> assertOneCycle(Map<UUID, UUID> next, List<UUID> players) {
        assertThat(next.keySet()).containsExactlyInAnyOrderElementsOf(players);
        assertThat(next.values()).containsExactlyInAnyOrderElementsOf(players);
        UUID start = players.getFirst();
        UUID current = start;
        int steps = 0;
        do {
            current = next.get(current);
            steps++;
        } while (!current.equals(start) && steps <= players.size());
        assertThat(steps).as("cycle length").isEqualTo(players.size());
        return next;
    }

    protected static MockHttpServletRequestBuilder as(String email, MockHttpServletRequestBuilder request) {
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + JwtTestSupport.token(email));
    }

    protected static MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder request) {
        return as(JwtTestSupport.ADMIN_EMAIL, request);
    }
}
