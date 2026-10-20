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

class KillWordBurnIT extends IntegrationTest {

    private String gameId;
    private long deathSentence;
    private UUID a;
    private UUID b;
    private UUID c;

    @BeforeEach
    void setUp() throws Exception {
        gameId = insertGame("KWB123", "SETUP", true);
        jdbc.update("insert into game.kill_method (game_id, name, points) values (?, 'Death Sentence', 10)", gameId);
        deathSentence = methodId(gameId, "Death Sentence");
        a = insertPlayer(gameId, "a@example.com", "Alice", "ALIVE");
        b = insertPlayer(gameId, "b@example.com", "Bob", "ALIVE");
        c = insertPlayer(gameId, "c@example.com", "Cleo", "ALIVE");
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null, \"words\": {\"" + a + "\": \"alpha\", \"" + b
                        + "\": \"bravo\", \"" + c + "\": \"charlie\"}}"))).andExpect(status().isCreated());
    }

    private UUID assassinOf(UUID target) {
        return jdbc.queryForObject("select assassin_id from game.assignment where target_id = ? and status = 'ACTIVE'",
                UUID.class, target);
    }

    private String stateOf(UUID player) {
        return jdbc.queryForObject("select state from game.kill_word where player_id = ?", String.class, player);
    }

    private ResultActions register(UUID victim, long method) throws Exception {
        return mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/kills").contentType(MediaType.APPLICATION_JSON)
                .content("{\"victimId\": \"" + victim + "\", \"killMethodId\": " + method + "}")));
    }

    private ResultActions file(UUID killer, long method) throws Exception {
        String email = jdbc.queryForObject("select email from game.player where id = ?", String.class, killer);
        return mvc.perform(as(email, post("/api/me/games/" + gameId + "/kill-claims")
                .contentType(MediaType.APPLICATION_JSON).content("{\"killMethodId\": " + method + "}")));
    }

    @Test
    void deathSentenceKillBurnsTheKillersWord() throws Exception {
        UUID killer = assassinOf(b);

        register(b, deathSentence).andExpect(status().isCreated());

        assertThat(stateOf(killer)).isEqualTo("USED");
        UUID other = killer.equals(a) ? c : a;
        assertThat(stateOf(other)).isEqualTo("ALLOCATED");
    }

    @Test
    void otherMethodsLeaveTheWordAlone() throws Exception {
        UUID killer = assassinOf(b);

        register(b, methodId(gameId, "Clamp")).andExpect(status().isCreated());

        assertThat(stateOf(killer)).isEqualTo("ALLOCATED");
    }

    @Test
    void registerWithoutLiveWordIsRejected() throws Exception {
        UUID killer = assassinOf(b);
        jdbc.update("update game.kill_word set state = 'USED', used_at = now() where player_id = ?", killer);

        register(b, deathSentence).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("KILL_WORD_NOT_AVAILABLE")));

        assertThat(jdbc.queryForObject("select count(*) from game.kill", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select status from game.player where id = ?", String.class, b))
                .isEqualTo("ALIVE");
    }

    @Test
    void claimWithoutLiveWordIsRejectedAtFiling() throws Exception {
        UUID killer = assassinOf(b);
        jdbc.update("update game.kill_word set state = 'USED', used_at = now() where player_id = ?", killer);

        file(killer, deathSentence).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("KILL_WORD_NOT_AVAILABLE")));
    }

    @Test
    void acceptedDeathSentenceClaimBurnsTheWord() throws Exception {
        UUID killer = assassinOf(b);
        file(killer, deathSentence).andExpect(status().isCreated());
        long claim = jdbc.queryForObject("select max(id) from game.kill_claim", Long.class);

        mvc.perform(as("b@example.com", post("/api/me/games/" + gameId + "/kill-claims/" + claim + "/accept")))
                .andExpect(status().isOk());

        assertThat(stateOf(killer)).isEqualTo("USED");
    }
}
