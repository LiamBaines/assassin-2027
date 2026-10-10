package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
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
        return addPlayers(gameId, "", n, status);
    }

    private List<UUID> addPlayers(UUID game, String prefix, int n, String status) {
        List<UUID> ids = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            String name = prefix + status.toLowerCase() + i;
            ids.add(insertPlayer(game, name + "@example.com", name, status));
        }
        return ids;
    }

    private ResultActions shuffle(Integer expected) throws Exception {
        return shuffle(gameId, expected);
    }

    private ResultActions shuffle(UUID game, Integer expected) throws Exception {
        String body = "{\"expectedCurrentRoundNo\": " + expected + "}";
        return mvc.perform(asAdmin(post("/api/admin/games/" + game + "/rings")
                .contentType(MediaType.APPLICATION_JSON).content(body)));
    }

    private int countRounds(UUID game) {
        return jdbc.queryForObject("select count(*) from game.allocation where game_id = ?", Integer.class, game);
    }

    private int countAssignments(String status) {
        return jdbc.queryForObject("select count(*) from game.assignment where status = ?", Integer.class, status);
    }

    @Test
    void fewerThanTwoAlivePlayersIsRejected() throws Exception {
        shuffle(null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_ENOUGH_PLAYERS"));
        addPlayers(1, "ALIVE");
        addPlayers(2, "DEAD");
        shuffle(null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_ENOUGH_PLAYERS"));
        assertThat(countAssignments("ACTIVE")).isZero();
        assertThat(jdbc.queryForObject("select count(*) from game.allocation", Integer.class)).isZero();
    }

    @Test
    void firstShuffleCreatesInitialRoundAndStartsGame() throws Exception {
        List<UUID> players = addPlayers(5, "ALIVE");

        shuffle(null)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roundNo").value(1))
                .andExpect(jsonPath("$.roundId").isNotEmpty())
                .andExpect(jsonPath("$.gameRoundNo").value(1))
                .andExpect(jsonPath("$.reason").value("INITIAL"))
                .andExpect(jsonPath("$.ring.length()").value(5));

        assertThat(jdbc.queryForObject(
                "select count(*) from game.game_round where game_id = ? and round_no = 1 and ended_at is null",
                Integer.class, gameId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
                select count(*) from game.allocation a join game.game_round r on r.id = a.game_round_id
                 where r.game_id = ? and r.round_no = 1
                """, Integer.class, gameId)).isEqualTo(1);

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
                .andExpect(jsonPath("$.gameRoundNo").value(1))
                .andExpect(jsonPath("$.reason").value("SHAKEUP"));

        assertThat(jdbc.queryForObject("select count(*) from game.game_round", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(distinct game_round_id) from game.allocation", Integer.class))
                .isEqualTo(1);
        assertThat(countAssignments("ACTIVE")).isEqualTo(6);
        assertThat(countAssignments("SUPERSEDED")).isEqualTo(6);
        assertThat(jdbc.queryForObject(
                "select count(*) from game.assignment where status = 'SUPERSEDED' and ended_at is null", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("""
                select count(*) from game.assignment a join game.allocation r on r.id = a.allocation_id
                 where a.status = 'ACTIVE' and r.allocation_no <> 2
                """, Integer.class)).isZero();
        assertActiveRingCovers(players);
        assertThat(jdbc.queryForObject("select started_at from game.game", Object.class)).isEqualTo(startedAt);

        mvc.perform(asAdmin(get("/api/admin/games/" + gameId + "/rings")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].roundNo").value(2))
                .andExpect(jsonPath("$[0].gameRoundNo").value(1))
                .andExpect(jsonPath("$[0].reason").value("SHAKEUP"))
                .andExpect(jsonPath("$[0].roundId").isNotEmpty())
                .andExpect(jsonPath("$[0].playerCount").value(6))
                .andExpect(jsonPath("$[0].createdBy").value(JwtTestSupport.ADMIN_EMAIL))
                .andExpect(jsonPath("$[1].roundNo").value(1))
                .andExpect(jsonPath("$[1].reason").value("INITIAL"));
    }

    @Test
    void deadAndRemovedPlayersAreExcluded() throws Exception {
        List<UUID> alive = addPlayers(3, "ALIVE");
        addPlayers(2, "DEAD");
        addPlayers(2, "REMOVED");

        shuffle(null).andExpect(status().isCreated()).andExpect(jsonPath("$.ring.length()").value(3));

        assertActiveRingCovers(alive);
    }

    @Test
    void staleRoundIsRejected() throws Exception {
        addPlayers(3, "ALIVE");
        shuffle(1).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_ROUND"));
        shuffle(null).andExpect(status().isCreated());
        shuffle(null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_ROUND"));
        shuffle(2).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_ROUND"));
        assertThat(jdbc.queryForObject("select count(*) from game.allocation", Integer.class)).isEqualTo(1);
    }

    @Test
    void finishedGameIsRejectedButStillReadable() throws Exception {
        addPlayers(3, "ALIVE");
        shuffle(null).andExpect(status().isCreated());
        jdbc.update("update game.game set status = 'FINISHED', finished_at = now()");

        shuffle(1).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GAME_FINISHED"));
        shuffle(null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GAME_FINISHED"));
        assertThat(countRounds(gameId)).isEqualTo(1);

        mvc.perform(asAdmin(get("/api/admin/games/" + gameId + "/rings/current")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ring.length()").value(3));
        mvc.perform(asAdmin(get("/api/admin/games/" + gameId + "/rings")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void unknownGameIsNotFound() throws Exception {
        UUID unknown = UUID.randomUUID();
        shuffle(unknown, null).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
        mvc.perform(asAdmin(get("/api/admin/games/" + unknown + "/rings/current")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
        mvc.perform(asAdmin(get("/api/admin/games/" + unknown + "/rings")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }

    @Test
    void twoLiveGamesAreShuffledIndependently() throws Exception {
        UUID other = insertGame("XYZ789", "SETUP", true);
        List<UUID> mine = addPlayers(4, "ALIVE");
        List<UUID> theirs = addPlayers(other, "other", 3, "ALIVE");

        shuffle(null).andExpect(status().isCreated())
                .andExpect(jsonPath("$.roundNo").value(1))
                .andExpect(jsonPath("$.ring.length()").value(4));
        // The other game has its own round numbers, so it starts at null -> INITIAL too.
        shuffle(other, null).andExpect(status().isCreated())
                .andExpect(jsonPath("$.roundNo").value(1))
                .andExpect(jsonPath("$.reason").value("INITIAL"))
                .andExpect(jsonPath("$.ring.length()").value(3));
        assertActiveRingCovers(gameId, mine);
        assertActiveRingCovers(other, theirs);

        // A shakeup of one game leaves the other's assignments alone.
        Map<UUID, UUID> theirRing = assertActiveRingCovers(other, theirs);
        shuffle(1).andExpect(status().isCreated()).andExpect(jsonPath("$.roundNo").value(2));
        assertActiveRingCovers(gameId, mine);
        assertThat(assertActiveRingCovers(other, theirs)).isEqualTo(theirRing);
        assertThat(jdbc.queryForObject(
                "select count(*) from game.assignment where game_id = ? and status <> 'ACTIVE'", Integer.class, other))
                .isZero();
        assertThat(countRounds(gameId)).isEqualTo(2);
        assertThat(countRounds(other)).isEqualTo(1);

        // Each game's ring and history only show its own players and rounds.
        mvc.perform(asAdmin(get("/api/admin/games/" + other + "/rings/current")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roundNo").value(1))
                .andExpect(jsonPath("$.ring.length()").value(3));
        mvc.perform(asAdmin(get("/api/admin/games/" + other + "/rings")))
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(asAdmin(get("/api/admin/games/" + gameId + "/rings")))
                .andExpect(jsonPath("$.length()").value(2));

        // Finishing one game doesn't stop the other.
        jdbc.update("update game.game set status = 'FINISHED', finished_at = now() where id = ?", gameId);
        shuffle(other, 1).andExpect(status().isCreated()).andExpect(jsonPath("$.roundNo").value(2));
        assertActiveRingCovers(other, theirs);
    }

    @Test
    void concurrentShufflesOfDifferentGamesBothSucceed() throws Exception {
        UUID other = insertGame("XYZ789", "SETUP", true);
        List<UUID> mine = addPlayers(20, "ALIVE");
        List<UUID> theirs = addPlayers(other, "other", 20, "ALIVE");
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<RingService.RingView> a = pool.submit(() -> {
                go.await();
                return ringService.shuffle(gameId, null, JwtTestSupport.ADMIN_EMAIL);
            });
            Future<RingService.RingView> b = pool.submit(() -> {
                go.await();
                return ringService.shuffle(other, null, JwtTestSupport.ADMIN_EMAIL);
            });
            go.countDown();
            assertThat(a.get().roundNo()).isEqualTo(1);
            assertThat(b.get().roundNo()).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
        assertActiveRingCovers(gameId, mine);
        assertActiveRingCovers(other, theirs);
    }

    @Test
    void concurrentShufflesExactlyOneSucceeds() throws Exception {
        int n = 30;
        List<UUID> players = addPlayers(n, "ALIVE");
        CountDownLatch go = new CountDownLatch(1);
        Callable<Object> task = () -> {
            go.await();
            try {
                return ringService.shuffle(gameId, null, JwtTestSupport.ADMIN_EMAIL);
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

            assertThat(results).filteredOn(RingService.RingView.class::isInstance).hasSize(1);
            assertThat(results).filteredOn(ApiException.class::isInstance)
                    .singleElement()
                    .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("STALE_ROUND"));
        } finally {
            pool.shutdownNow();
        }
        assertThat(jdbc.queryForObject("select count(*) from game.allocation", Integer.class)).isEqualTo(1);
        assertThat(countAssignments("ACTIVE")).isEqualTo(n);
        assertActiveRingCovers(players);
    }

    @Test
    void currentRingIsReturnedInCycleOrder() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/games/" + gameId + "/rings/current")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_RING"));

        List<UUID> players = addPlayers(7, "ALIVE");
        shuffle(null).andExpect(status().isCreated());
        Map<UUID, UUID> next = assertActiveRingCovers(players);

        String body = mvc.perform(asAdmin(get("/api/admin/games/" + gameId + "/rings/current")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roundNo").value(1))
                .andExpect(jsonPath("$.reason").value("INITIAL"))
                .andExpect(jsonPath("$.roundId").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        JsonNode links = json.readTree(body).get("ring");
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
