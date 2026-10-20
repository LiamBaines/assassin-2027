package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class KillWordAllocationIT extends IntegrationTest {

    private String gameId;
    private UUID a;
    private UUID b;

    @BeforeEach
    void setUp() {
        gameId = insertGame("KWA123", "SETUP", true);
        jdbc.update("insert into game.kill_method (game_id, name, points) values (?, 'death sentence', 10)", gameId);
        a = insertPlayer(gameId, "a@example.com", "Alice", "ALIVE");
        b = insertPlayer(gameId, "b@example.com", "Bob", "ALIVE");
    }

    private String words(String wa, String wb) {
        return "{\"" + a + "\": " + wa + ", \"" + b + "\": " + wb + "}";
    }

    private ResultActions ring(Integer expected, String wordsJson) throws Exception {
        String extra = wordsJson == null ? "" : ", \"words\": " + wordsJson;
        return mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings")
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedCurrentRoundNo\": " + expected + extra + "}")));
    }

    private ResultActions round(int expected, String wordsJson) throws Exception {
        String extra = wordsJson == null ? "" : ", \"words\": " + wordsJson;
        return mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rounds")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedRoundNo\": " + expected + ", \"playerIds\": [\"" + a + "\",\"" + b + "\"]" + extra + "}")));
    }

    private int wordCount() {
        return jdbc.queryForObject("select count(*) from game.kill_word where game_id = ?", Integer.class, gameId);
    }

    @Test
    void firstRingAllocatesWordsAndShakeupKeepsThem() throws Exception {
        jdbc.update("insert into game.kill_word (game_id, text, origin) values (?, 'Giraffe', 'ADMIN')", gameId);

        ring(null, words("\"giraffe\"", "\"Pelican\"")).andExpect(status().isCreated());

        assertThat(jdbc.queryForObject("select state || ':' || round_no || ':' || origin from game.kill_word where player_id = ?",
                String.class, a)).isEqualTo("ALLOCATED:1:ADMIN");
        assertThat(jdbc.queryForObject("select state || ':' || origin from game.kill_word where player_id = ?",
                String.class, b)).isEqualTo("ALLOCATED:RANDOM");

        ring(1, null).andExpect(status().isCreated());
        assertThat(wordCount()).isEqualTo(2);
    }

    @Test
    void laterRoundAllocatesNewWords() throws Exception {
        ring(null, words("\"one\"", "\"two\"")).andExpect(status().isCreated());

        round(1, words("\"three\"", "\"four\"")).andExpect(status().isCreated());

        assertThat(jdbc.queryForObject("select count(*) from game.kill_word where round_no = 2", Integer.class)).isEqualTo(2);
        assertThat(wordCount()).isEqualTo(4);
    }

    @Test
    void rejectsMissingWordAndRollsBack() throws Exception {
        ring(null, words("\"one\"", "\" \"")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("KILL_WORD_MISSING")));
        ring(null, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("KILL_WORD_MISSING")));

        assertThat(wordCount()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from game.game_round", Integer.class)).isZero();
    }

    @Test
    void rejectsDuplicateWordsCaseInsensitively() throws Exception {
        ring(null, words("\"Echo\"", "\"echo\"")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("KILL_WORD_TAKEN")));

        assertThat(wordCount()).isZero();
    }

    @Test
    void rejectsBurnedWordFromEarlierRound() throws Exception {
        ring(null, words("\"one\"", "\"two\"")).andExpect(status().isCreated());

        round(1, words("\"ONE\"", "\"four\"")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("KILL_WORD_BURNED")));

        assertThat(wordCount()).isEqualTo(2);
        assertThat(jdbc.queryForObject("select max(round_no) from game.game_round", Integer.class)).isEqualTo(1);
    }

    @Test
    void rejectsWordForPlayerOutsideTheRound() throws Exception {
        ring(null, "{\"" + a + "\": \"one\", \"" + b + "\": \"two\", \"" + UUID.randomUUID() + "\": \"three\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code", is("KILL_WORD_PLAYER_INVALID")));
    }

    @Test
    void ignoresWordsWhenDeathSentenceIsDisabled() throws Exception {
        jdbc.update("update game.kill_method set enabled = false where game_id = ? and name = 'death sentence'", gameId);

        ring(null, null).andExpect(status().isCreated());
        round(1, words("\"one\"", "\"two\"")).andExpect(status().isCreated());

        assertThat(wordCount()).isZero();
    }

    @Test
    void disablingDeathSentenceInTheSameRequestSkipsAllocation() throws Exception {
        long id = jdbc.queryForObject("select id from game.kill_method where game_id = ? and name = 'death sentence'",
                Long.class, gameId);
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null, \"killMethods\": [{\"id\": " + id
                        + ", \"name\": \"death sentence\", \"points\": 10, \"enabled\": false}]}")))
                .andExpect(status().isCreated());

        assertThat(wordCount()).isZero();
    }
}
