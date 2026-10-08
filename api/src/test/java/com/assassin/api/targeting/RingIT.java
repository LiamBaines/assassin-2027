package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import com.assassin.api.JwtTestSupport;
import com.assassin.api.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class RingIT extends IntegrationTest {

    @Autowired
    RingService ringService;

    @Autowired
    ObjectMapper json;

    private UUID gameId;

    @BeforeEach
    void createGame() {
        gameId = insertGame("ABC123", "SETUP", true);
    }

    private List<UUID> addPlayers(int n, String status) {
        List<UUID> ids = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            String name = status.toLowerCase() + i;
            ids.add(insertPlayer(gameId, name + "@example.com", name, status));
        }
        return ids;
    }

    private ResultActions shuffle(Integer expected) throws Exception {
        String body = "{\"expectedCurrentRoundNo\": " + expected + "}";
        return mvc.perform(asAdmin(post("/api/admin/rings").contentType(MediaType.APPLICATION_JSON).content(body)));
    }

    private int countAssignments(String status) {
        return jdbc.queryForObject("select count(*) from game.assignment where status = ?", Integer.class, status);
    }

    /** assassin -> target for ACTIVE rows, checked to form one cycle over exactly {@code players}. */
    private Map<UUID, UUID> assertActiveRingCovers(List<UUID> players) {
        Map<UUID, UUID> next = new HashMap<>();
        jdbc.query("select assassin_id, target_id from game.assignment where status = 'ACTIVE'",
                rs -> {
                    next.put(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class));
                });
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

    @Test
    void fewerThanTwoAlivePlayersIsRejected() throws Exception {
        shuffle(null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_ENOUGH_PLAYERS"));
        addPlayers(1, "ALIVE");
        addPlayers(2, "DEAD");
        shuffle(null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_ENOUGH_PLAYERS"));
        assertThat(countAssignments("ACTIVE")).isZero();
        assertThat(jdbc.queryForObject("select count(*) from game.assignment_round", Integer.class)).isZero();
    }

    @Test
    void firstShuffleCreatesInitialRoundAndStartsGame() throws Exception {
        List<UUID> players = addPlayers(5, "ALIVE");

        shuffle(null)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roundNo").value(1))
                .andExpect(jsonPath("$.reason").value("INITIAL"))
                .andExpect(jsonPath("$.playerCount").value(5))
                .andExpect(jsonPath("$.createdBy").value(JwtTestSupport.ADMIN_EMAIL));

        Map<String, Object> game = jdbc.queryForMap("select status, started_at from game.game where id = ?", gameId);
        assertThat(game.get("status")).isEqualTo("ACTIVE");
        assertThat(game.get("started_at")).isNotNull();
        assertThat(countAssignments("ACTIVE")).isEqualTo(5);
        assertActiveRingCovers(players);
        assertThat(jdbc.queryForObject("select count(*) from game.assignment where source <> 'RING'", Integer.class))
                .isZero();
    }

    @Test
    void shakeupSupersedesOldRowsAndKeepsHistory() throws Exception {
        List<UUID> players = addPlayers(6, "ALIVE");
        shuffle(null).andExpect(status().isCreated());
        Object startedAt = jdbc.queryForObject("select started_at from game.game", Object.class);

        shuffle(1)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roundNo").value(2))
                .andExpect(jsonPath("$.reason").value("SHAKEUP"));

        assertThat(countAssignments("ACTIVE")).isEqualTo(6);
        assertThat(countAssignments("SUPERSEDED")).isEqualTo(6);
        assertThat(jdbc.queryForObject(
                "select count(*) from game.assignment where status = 'SUPERSEDED' and ended_at is null", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("""
                select count(*) from game.assignment a join game.assignment_round r on r.id = a.round_id
                 where a.status = 'ACTIVE' and r.round_no <> 2
                """, Integer.class)).isZero();
        assertActiveRingCovers(players);
        assertThat(jdbc.queryForObject("select started_at from game.game", Object.class)).isEqualTo(startedAt);

        mvc.perform(asAdmin(get("/api/admin/rings")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].roundNo").value(2))
                .andExpect(jsonPath("$[0].reason").value("SHAKEUP"))
                .andExpect(jsonPath("$[1].roundNo").value(1))
                .andExpect(jsonPath("$[1].reason").value("INITIAL"));
    }

    @Test
    void deadAndRemovedPlayersAreExcluded() throws Exception {
        List<UUID> alive = addPlayers(3, "ALIVE");
        addPlayers(2, "DEAD");
        addPlayers(2, "REMOVED");

        shuffle(null).andExpect(status().isCreated()).andExpect(jsonPath("$.playerCount").value(3));

        assertActiveRingCovers(alive);
    }

    @Test
    void staleRoundIsRejected() throws Exception {
        addPlayers(3, "ALIVE");
        shuffle(1).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_ROUND"));
        shuffle(null).andExpect(status().isCreated());
        shuffle(null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_ROUND"));
        shuffle(2).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_ROUND"));
        assertThat(jdbc.queryForObject("select count(*) from game.assignment_round", Integer.class)).isEqualTo(1);
    }

    @Test
    void finishedGameIsRejected() throws Exception {
        addPlayers(3, "ALIVE");
        jdbc.update("update game.game set status = 'FINISHED', finished_at = now()");
        shuffle(null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GAME_FINISHED"));
    }

    @Test
    void noGameAtAllIsNotFound() throws Exception {
        jdbc.execute("truncate game.game cascade");
        shuffle(null).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NO_LIVE_GAME"));
    }

    @Test
    void concurrentShufflesExactlyOneSucceeds() throws Exception {
        int n = 30;
        List<UUID> players = addPlayers(n, "ALIVE");
        CountDownLatch go = new CountDownLatch(1);
        Callable<Object> task = () -> {
            go.await();
            try {
                return ringService.shuffle(null, JwtTestSupport.ADMIN_EMAIL);
            } catch (ApiException e) {
                return e;
            }
        };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Object> a = pool.submit(task);
            Future<Object> b = pool.submit(task);
            go.countDown();
            List<Object> results = List.of(a.get(), b.get());

            assertThat(results).filteredOn(AssignmentRound.class::isInstance).hasSize(1);
            assertThat(results).filteredOn(ApiException.class::isInstance)
                    .singleElement()
                    .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("STALE_ROUND"));
        } finally {
            pool.shutdownNow();
        }
        assertThat(jdbc.queryForObject("select count(*) from game.assignment_round", Integer.class)).isEqualTo(1);
        assertThat(countAssignments("ACTIVE")).isEqualTo(n);
        assertActiveRingCovers(players);
    }

    @Test
    void currentRingIsReturnedInCycleOrder() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/rings/current")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roundNo").value(nullValue()))
                .andExpect(jsonPath("$.links.length()").value(0));

        List<UUID> players = addPlayers(7, "ALIVE");
        shuffle(null).andExpect(status().isCreated());
        Map<UUID, UUID> next = assertActiveRingCovers(players);

        String body = mvc.perform(asAdmin(get("/api/admin/rings/current")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roundNo").value(1))
                .andReturn().getResponse().getContentAsString();
        JsonNode links = json.readTree(body).get("links");
        assertThat(links).hasSize(7);
        for (int i = 0; i < links.size(); i++) {
            JsonNode link = links.get(i);
            UUID assassin = UUID.fromString(link.at("/assassin/id").asText());
            UUID target = UUID.fromString(link.at("/target/id").asText());
            assertThat(next.get(assassin)).isEqualTo(target);
            assertThat(link.at("/target/displayName").asText()).isNotBlank();
            assertThat(links.get((i + 1) % links.size()).at("/assassin/id").asText()).isEqualTo(target.toString());
        }
    }
}
