package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import com.assassin.api.JwtTestSupport;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class KillIT extends IntegrationTest {

    private UUID gameId;
    private UUID alice;
    private UUID bob;
    private UUID carol;

    @BeforeEach
    void seed() {
        gameId = insertGame("ABC123", "SETUP", true);
        alice = insertPlayer(gameId, "alice@example.com", "Alice", "ALIVE");
        bob = insertPlayer(gameId, "bob@example.com", "Bob", "ALIVE");
        carol = insertPlayer(gameId, "carol@example.com", "Carol", "ALIVE");
    }

    private void shuffle() throws Exception {
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null}"))).andExpect(status().isCreated());
    }

    private ResultActions kill(UUID game, UUID victim) throws Exception {
        return mvc.perform(asAdmin(post("/api/admin/games/" + game + "/kills")
                .contentType(MediaType.APPLICATION_JSON).content("{\"victimId\": \"" + victim + "\"}")));
    }

    private ResultActions kill(UUID victim) throws Exception {
        return kill(gameId, victim);
    }

    private String string(String sql, Object... args) {
        return jdbc.queryForObject(sql, String.class, args);
    }

    private int count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private UUID assassinOf(UUID target) {
        return jdbc.queryForObject("select assassin_id from game.assignment where target_id = ? and status = 'ACTIVE'",
                UUID.class, target);
    }

    @Test
    void killInThreePlayerRingPassesTargetToKiller() throws Exception {
        shuffle();
        UUID killer = assassinOf(bob);
        UUID inherited = jdbc.queryForObject(
                "select target_id from game.assignment where assassin_id = ? and status = 'ACTIVE'", UUID.class, bob);

        kill(bob).andExpect(status().isCreated())
                .andExpect(jsonPath("$.killer.id").value(killer.toString()))
                .andExpect(jsonPath("$.victim.id").value(bob.toString()))
                .andExpect(jsonPath("$.newTarget.id").value(inherited.toString()))
                .andExpect(jsonPath("$.roundEnded").value(false));

        assertThat(string("select status from game.player where id = ?", bob)).isEqualTo("DEAD");
        assertThat(string("select status from game.game where id = ?", gameId)).isEqualTo("ACTIVE");
        Map<UUID, UUID> ring = assertActiveRingCovers(List.of(killer, inherited));
        assertThat(ring.get(killer)).isEqualTo(inherited);
        assertThat(string("select source from game.assignment where assassin_id = ? and status = 'ACTIVE'", killer))
                .isEqualTo("KILL_INHERIT");
        assertThat(count("select count(*) from game.assignment where status = 'COMPLETED' and target_id = ?", bob))
                .isEqualTo(1);
        assertThat(count("select count(*) from game.assignment where status = 'VOIDED' and assassin_id = ?", bob))
                .isEqualTo(1);
        assertThat(count("select count(*) from game.kill where victim_id = ? and killer_id = ? and registered_by = ?",
                bob, killer, JwtTestSupport.ADMIN_EMAIL)).isEqualTo(1);
    }

    @Test
    void killInTwoPlayerRingEndsRound() throws Exception {
        shuffle();
        kill(bob).andExpect(status().isCreated());
        UUID winner = jdbc.queryForObject("select killer_id from game.kill", UUID.class);
        UUID victim = winner.equals(alice) ? carol : alice;

        kill(victim).andExpect(status().isCreated())
                .andExpect(jsonPath("$.killer.id").value(winner.toString()))
                .andExpect(jsonPath("$.newTarget").value(nullValue()))
                .andExpect(jsonPath("$.roundEnded").value(true));

        assertThat(string("select status from game.game where id = ?", gameId)).isEqualTo("ACTIVE");
        assertThat(count("select count(*) from game.game_round where ended_at is not null and winner_id = '"
                + winner + "'")).isEqualTo(1);
        assertThat(count("select count(*) from game.assignment where status = 'ACTIVE'")).isZero();
        assertThat(string("select status from game.player where id = ?", winner)).isEqualTo("ALIVE");
    }

    @Test
    void revivedPlayerCanDieAgainInALaterRound() throws Exception {
        shuffle();
        kill(bob).andExpect(status().isCreated());
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rounds")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedRoundNo\": 1, \"playerIds\": [\"" + alice + "\", \"" + bob + "\", \"" + carol + "\"]}")))
                .andExpect(status().isCreated());

        kill(bob).andExpect(status().isCreated());

        assertThat(count("select count(*) from game.kill where victim_id = '" + bob + "'")).isEqualTo(2);
        assertThat(count("select count(distinct game_round_id) from game.kill")).isEqualTo(2);
    }

    @Test
    void shakeupAfterRoundEndedIsRejected() throws Exception {
        shuffle();
        kill(bob).andExpect(status().isCreated());
        UUID winner = jdbc.queryForObject("select killer_id from game.kill", UUID.class);
        kill(winner.equals(alice) ? carol : alice).andExpect(status().isCreated());

        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings")
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedCurrentRoundNo\": 1}")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ROUND_ENDED"));
    }

    @Test
    void deadVictimIsRejected() throws Exception {
        shuffle();
        kill(bob).andExpect(status().isCreated());
        kill(bob).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PLAYER_NOT_ALIVE"));
        assertThat(count("select count(*) from game.kill")).isEqualTo(1);
    }

    @Test
    void playerWithoutTargetIsNotInRing() throws Exception {
        shuffle();
        UUID dave = insertPlayer(gameId, "dave@example.com", "Dave", "ALIVE");
        kill(dave).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_IN_RING"));
        assertThat(string("select status from game.player where id = ?", dave)).isEqualTo("ALIVE");
    }

    @Test
    void gameThatHasNotStartedIsRejected() throws Exception {
        kill(bob).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GAME_NOT_STARTED"));
    }

    @Test
    void finishedGameIsRejected() throws Exception {
        shuffle();
        jdbc.update("update game.game set status = 'FINISHED', finished_at = now() where id = ?", gameId);
        kill(bob).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GAME_FINISHED"));
    }

    @Test
    void nonAdminIsForbidden() throws Exception {
        shuffle();
        mvc.perform(as("alice@example.com", post("/api/admin/games/" + gameId + "/kills")
                .contentType(MediaType.APPLICATION_JSON).content("{\"victimId\": \"" + bob + "\"}")))
                .andExpect(status().isForbidden());
        assertThat(count("select count(*) from game.kill")).isZero();
    }

    @Test
    void victimFromAnotherGameIsNotFound() throws Exception {
        shuffle();
        UUID other = insertGame("XYZ789", "SETUP", true);
        UUID stranger = insertPlayer(other, "eve@example.com", "Eve", "ALIVE");
        kill(stranger).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("PLAYER_NOT_FOUND"));
    }

    @Test
    void missingVictimIdIsInvalid() throws Exception {
        shuffle();
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/kills").contentType(MediaType.APPLICATION_JSON)
                .content("{}"))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
