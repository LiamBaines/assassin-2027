package com.assassin.api.game;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class KillWordIT extends IntegrationTest {

    private ResultActions add(String gameId, String wordsJson) throws Exception {
        return mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/kill-words")
                .contentType(MediaType.APPLICATION_JSON).content("{\"words\": " + wordsJson + "}")));
    }

    private ResultActions list(String gameId) throws Exception {
        return mvc.perform(asAdmin(get("/api/admin/games/" + gameId + "/kill-words")));
    }

    @Test
    void addsSeveralWordsNormalisedAndListsThemUnused() throws Exception {
        String game = insertGame("WORD01", "SETUP", true);

        add(game, "[\"  banana  split \", \"\", \"Giraffe\"]")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].text", is("banana split")))
                .andExpect(jsonPath("$[0].state", is("UNUSED")));

        list(game).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[1].text", is("giraffe")));
    }

    @Test
    void rejectsDuplicatesCaseInsensitivelyAndAddsNothing() throws Exception {
        String game = insertGame("WORD02", "SETUP", true);
        add(game, "[\"Giraffe\"]").andExpect(status().isCreated());

        add(game, "[\"fresh\", \"GIRAFFE\"]").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("KILL_WORD_TAKEN")));
        add(game, "[\"a\", \"A\"]").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("KILL_WORD_TAKEN")));

        list(game).andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void rejectsEmptyAndTooLongInput() throws Exception {
        String game = insertGame("WORD03", "SETUP", true);

        add(game, "[\" \", \"\"]").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("KILL_WORD_REQUIRED")));
        add(game, "null").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("KILL_WORD_REQUIRED")));
        add(game, "[\"" + "x".repeat(61) + "\"]").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("KILL_WORD_TOO_LONG")));
    }

    @Test
    void wordsAreScopedToTheirGame() throws Exception {
        String one = insertGame("WORD04", "SETUP", true);
        String two = insertGame("WORD05", "SETUP", true);

        add(one, "[\"shared\"]").andExpect(status().isCreated());
        add(two, "[\"shared\"]").andExpect(status().isCreated());
        list(two).andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void deletesUnallocatedWordsOnly() throws Exception {
        String game = insertGame("WORD06", "SETUP", true);
        add(game, "[\"free\", \"taken\"]").andExpect(status().isCreated());
        long free = id(game, "free");
        long taken = id(game, "taken");
        UUID player = insertPlayer(game, "a@example.com", "Ada", "ALIVE");
        jdbc.update("insert into game.game_round (game_id, round_no, started_at, created_by) values (?, 1, now(), 'admin')",
                game);
        jdbc.update("update game.kill_word set state = 'ALLOCATED', player_id = ?, round_no = 1 where id = ?",
                player, taken);

        mvc.perform(asAdmin(delete("/api/admin/games/" + game + "/kill-words/" + taken)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code", is("KILL_WORD_ALLOCATED")));
        mvc.perform(asAdmin(delete("/api/admin/games/" + game + "/kill-words/" + free)))
                .andExpect(status().isNoContent());
        mvc.perform(asAdmin(delete("/api/admin/games/" + game + "/kill-words/" + free)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code", is("KILL_WORD_NOT_FOUND")));

        list(game).andExpect(jsonPath("$", hasSize(1))).andExpect(jsonPath("$[0].state", is("ALLOCATED")))
                .andExpect(jsonPath("$[0].playerId", is(player.toString())));
    }

    @Test
    void unknownGameAndNonAdminAreRefused() throws Exception {
        list("no-such-game").andExpect(status().isNotFound()).andExpect(jsonPath("$.code", is("GAME_NOT_FOUND")));
        mvc.perform(get("/api/admin/games/x/kill-words")).andExpect(status().isUnauthorized());
    }

    private long id(String gameId, String text) {
        return jdbc.queryForObject("select id from game.kill_word where game_id = ? and text = ?", Long.class,
                gameId, text);
    }
}
