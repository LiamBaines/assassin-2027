package com.assassin.api.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import com.assassin.api.common.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class AdminGameIT extends IntegrationTest {

    @Autowired
    ObjectMapper json;

    @Autowired
    GameService gameService;

    private ResultActions create(String body) throws Exception {
        return mvc.perform(asAdmin(post("/api/admin/games").contentType(MediaType.APPLICATION_JSON).content(body)));
    }

    private UUID createGame(String name, String joinCode) throws Exception {
        String body = create("""
                {"name": "%s", "joinCode": "%s"}
                """.formatted(name, joinCode))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(body).get("id").asText());
    }

    private ResultActions update(UUID gameId, String body) throws Exception {
        return mvc.perform(asAdmin(patch("/api/admin/games/" + gameId)
                .contentType(MediaType.APPLICATION_JSON).content(body)));
    }

    private void finish(UUID gameId) throws Exception {
        update(gameId, """
                {"status": "FINISHED"}
                """).andExpect(status().isOk());
    }

    @Test
    void listIsEmptyWithoutGames() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/games")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void unknownGameIs404() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/games/" + UUID.randomUUID())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
        update(UUID.randomUUID(), """
                {"name": "x"}
                """).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }

    @Test
    void createNormalizesJoinCodeAndStartsInSetup() throws Exception {
        String body = create("""
                {"name": " Spring 2027 ", "joinCode": " test42ab "}
                """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(notNullValue()))
                .andExpect(jsonPath("$.name").value("Spring 2027"))
                .andExpect(jsonPath("$.joinCode").value("TEST42AB"))
                .andExpect(jsonPath("$.status").value("SETUP"))
                .andExpect(jsonPath("$.signupsOpen").value(true))
                .andExpect(jsonPath("$.createdAt").value(notNullValue()))
                .andExpect(jsonPath("$.startedAt").value(nullValue()))
                .andExpect(jsonPath("$.finishedAt").value(nullValue()))
                .andExpect(jsonPath("$.playerCount").value(0))
                .andReturn().getResponse().getContentAsString();
        String id = json.readTree(body).get("id").asText();

        mvc.perform(asAdmin(get("/api/admin/games/" + id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.joinCode").value("TEST42AB"))
                .andExpect(jsonPath("$.playerCount").value(0));
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
    void severalLiveGamesCanExist() throws Exception {
        createGame("One", "AAAAAA");
        createGame("Two", "BBBBBB");
        assertThat(jdbc.queryForObject("select count(*) from game.game where status <> 'FINISHED'", Integer.class))
                .isEqualTo(2);
    }

    @Test
    void createWithACodeInUseIsJoinCodeTaken() throws Exception {
        createGame("One", "AAAAAA");
        create("""
                {"name": "Two", "joinCode": "aaaaaa"}
                """)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("JOIN_CODE_TAKEN"));
    }

    @Test
    void theIndexRejectsADuplicateLiveCode() {
        // The race the service maps to JOIN_CODE_TAKEN: the index is what stops it.
        insertGame("AAAAAA", "ACTIVE", true);
        assertThatThrownBy(() -> insertGame("AAAAAA", "SETUP", true))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("game_join_code_live_uq");
    }

    @Test
    void concurrentCreatesWithOneCodeExactlyOneSucceeds() throws Exception {
        CountDownLatch go = new CountDownLatch(1);
        Callable<Object> task = () -> {
            go.await();
            try {
                return gameService.create("Race", "RACE01");
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
            assertThat(results).filteredOn(GameService.GameWithCount.class::isInstance).hasSize(1);
            assertThat(results).filteredOn(ApiException.class::isInstance)
                    .singleElement()
                    .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("JOIN_CODE_TAKEN"));
        } finally {
            pool.shutdownNow();
        }
        assertThat(jdbc.queryForObject("select count(*) from game.game", Integer.class)).isEqualTo(1);
    }

    @Test
    void aFinishedGamesCodeCanBeReused() throws Exception {
        UUID one = createGame("One", "AAAAAA");
        finish(one);
        UUID two = createGame("Two", "AAAAAA");
        assertThat(two).isNotEqualTo(one);
        // ... but not while the new game is live.
        create("""
                {"name": "Three", "joinCode": "AAAAAA"}
                """).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("JOIN_CODE_TAKEN"));
    }

    @Test
    void listIsNewestFirstAndIncludesFinishedGamesWithPlayerCounts() throws Exception {
        UUID oldest = createGame("Oldest", "AAAAAA");
        UUID middle = createGame("Middle", "BBBBBB");
        UUID newest = createGame("Newest", "CCCCCC");
        finish(oldest);
        insertPlayer(middle, "alice@example.com", "Alice", "ALIVE");
        insertPlayer(middle, "bob@example.com", "Bob", "REMOVED");
        insertPlayer(oldest, "alice@example.com", "Alice", "DEAD");

        mvc.perform(asAdmin(get("/api/admin/games")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(newest.toString()))
                .andExpect(jsonPath("$[0].playerCount").value(0))
                .andExpect(jsonPath("$[1].id").value(middle.toString()))
                .andExpect(jsonPath("$[1].playerCount").value(2))
                .andExpect(jsonPath("$[1].joinCode").value("BBBBBB"))
                .andExpect(jsonPath("$[2].id").value(oldest.toString()))
                .andExpect(jsonPath("$[2].status").value("FINISHED"))
                .andExpect(jsonPath("$[2].finishedAt").value(notNullValue()))
                .andExpect(jsonPath("$[2].playerCount").value(1));
    }

    @Test
    void patchEditsFields() throws Exception {
        UUID id = createGame("One", "AAAAAA");
        insertPlayer(id, "alice@example.com", "Alice", "ALIVE");
        update(id, """
                {"name": "Renamed", "joinCode": "bbbbbb", "signupsOpen": false}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.name").value("Renamed"))
                .andExpect(jsonPath("$.joinCode").value("BBBBBB"))
                .andExpect(jsonPath("$.signupsOpen").value(false))
                .andExpect(jsonPath("$.status").value("SETUP"))
                .andExpect(jsonPath("$.playerCount").value(1));
    }

    @Test
    void patchOnlyTouchesThatGame() throws Exception {
        UUID one = createGame("One", "AAAAAA");
        UUID two = createGame("Two", "BBBBBB");
        update(two, """
                {"name": "Renamed"}
                """).andExpect(status().isOk());
        mvc.perform(asAdmin(get("/api/admin/games/" + one))).andExpect(jsonPath("$.name").value("One"));
    }

    @Test
    void patchKeepingItsOwnCodeIsFine() throws Exception {
        UUID id = createGame("One", "AAAAAA");
        update(id, """
                {"joinCode": "aaaaaa"}
                """).andExpect(status().isOk()).andExpect(jsonPath("$.joinCode").value("AAAAAA"));
    }

    @Test
    void patchToACodeInUseIsJoinCodeTaken() throws Exception {
        createGame("One", "AAAAAA");
        UUID two = createGame("Two", "BBBBBB");
        update(two, """
                {"joinCode": "AAAAAA"}
                """)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("JOIN_CODE_TAKEN"));
        assertThat(jdbc.queryForObject("select join_code from game.game where id = ?", String.class, two))
                .isEqualTo("BBBBBB");
    }

    @Test
    void patchToAFinishedGamesCodeIsAllowed() throws Exception {
        UUID one = createGame("One", "AAAAAA");
        finish(one);
        UUID two = createGame("Two", "BBBBBB");
        update(two, """
                {"joinCode": "AAAAAA"}
                """).andExpect(status().isOk()).andExpect(jsonPath("$.joinCode").value("AAAAAA"));
    }

    @Test
    void patchStatusOnlyToFinished() throws Exception {
        UUID id = createGame("One", "AAAAAA");
        update(id, """
                {"status": "ACTIVE"}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS"));
    }

    @Test
    void finishingSetsFinishedAtAndKeepsTheGameVisible() throws Exception {
        UUID id = createGame("One", "AAAAAA");
        update(id, """
                {"status": "FINISHED"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FINISHED"))
                .andExpect(jsonPath("$.finishedAt").value(notNullValue()));

        mvc.perform(asAdmin(get("/api/admin/games/" + id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FINISHED"));
    }

    @Test
    void everyPatchOfAFinishedGameIsGameFinished() throws Exception {
        UUID id = createGame("One", "AAAAAA");
        finish(id);
        for (String body : new String[] {
                "{\"name\": \"x\"}",
                "{\"joinCode\": \"CCCCCC\"}",
                "{\"signupsOpen\": false}",
                "{\"status\": \"FINISHED\"}",
                "{\"status\": \"ACTIVE\"}",
                "{}"}) {
            update(id, body)
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("GAME_FINISHED"));
        }
        mvc.perform(asAdmin(get("/api/admin/games/" + id)))
                .andExpect(jsonPath("$.name").value("One"))
                .andExpect(jsonPath("$.joinCode").value("AAAAAA"))
                .andExpect(jsonPath("$.signupsOpen").value(true));
    }
}
