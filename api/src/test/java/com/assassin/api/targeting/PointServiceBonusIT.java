package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class PointServiceBonusIT extends IntegrationTest {

    @Autowired
    private PointService pointService;
    @Autowired
    private KillRepository kills;

    private String gameId;
    private UUID alice;
    private UUID bob;
    private UUID carol;

    @BeforeEach
    void seed() {
        gameId = insertGame("BNS123", "SETUP", true);
        alice = insertPlayer(gameId, "alice@example.com", "Alice", "ALIVE");
        bob = insertPlayer(gameId, "bob@example.com", "Bob", "ALIVE");
        carol = insertPlayer(gameId, "carol@example.com", "Carol", "ALIVE");
    }

    private void shuffle() throws Exception {
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null}"))).andExpect(status().isCreated());
    }

    private UUID roundId() {
        return jdbc.queryForObject("select id from game.game_round where game_id = ?", UUID.class, gameId);
    }

    private UUID assassinOf(UUID target) {
        return jdbc.queryForObject("select assassin_id from game.assignment where target_id = ? and status = 'ACTIVE'",
                UUID.class, target);
    }

    private void killMethod(String path, String method, String body) throws Exception {
        mvc.perform(asAdmin(method.equals("PATCH") ? patch(path) : post(path)).contentType(MediaType.APPLICATION_JSON)
                .content(body)).andExpect(status().is2xxSuccessful());
    }

    private Kill registerKill() throws Exception {
        killMethod("/api/admin/games/" + gameId + "/kills", "POST",
                "{\"victimId\": \"" + bob + "\", \"killMethodId\": " + methodId(gameId, "Clamp") + "}");
        return kills.findAll().get(0);
    }

    @Test
    void adHocBonusIsTaggedWithTheActiveRound() throws Exception {
        shuffle();
        PointEvent e = pointService.recordBonus(gameId, alice, 5, "Best costume", null, "admin@e2e.test");

        assertThat(e.getType()).isEqualTo(PointType.BONUS);
        assertThat(e.getGameRoundId()).isEqualTo(roundId());
        assertThat(e.getKillId()).isNull();
        assertThat(e.getReason()).isEqualTo("Best costume");
    }

    @Test
    void bonusBeforeRoundOneHasNoRound() {
        PointEvent e = pointService.recordBonus(gameId, alice, -3, "Late to briefing", null, "admin@e2e.test");

        assertThat(e.getGameRoundId()).isNull();
        assertThat(jdbc.queryForObject("select sum(points) from game.point_event where player_id = ?", Integer.class,
                alice)).isEqualTo(-3);
    }

    @Test
    void killLinkedBonusTakesTheKillsRound() throws Exception {
        shuffle();
        Kill kill = registerKill();
        UUID killer = kill.getKillerId();
        // A later round must not change which round the bonus belongs to.
        jdbc.update("update game.game_round set ended_at = now() where id = ?", kill.getGameRoundId());

        PointEvent e = pointService.recordBonus(gameId, killer, 4, "Clean kill", kill, "admin@e2e.test");

        assertThat(e.getGameRoundId()).isEqualTo(kill.getGameRoundId());
        assertThat(e.getKillId()).isEqualTo(kill.getId());
    }

    @Test
    void laterKillMethodCorrectionLeavesTheBonusIntact() throws Exception {
        shuffle();
        Kill kill = registerKill();
        pointService.recordBonus(gameId, kill.getKillerId(), 7, "Style", kill, "admin@e2e.test");
        int before = jdbc.queryForObject("select sum(points) from game.point_event where player_id = ?", Integer.class,
                kill.getKillerId());

        killMethod("/api/admin/games/" + gameId + "/kills/" + kill.getId(), "PATCH",
                "{\"killMethodId\": " + methodId(gameId, "Duel") + "}");

        int duelPoints = jdbc.queryForObject("select points from game.kill_method where id = ?", Integer.class,
                methodId(gameId, "Duel"));
        int clampPoints = jdbc.queryForObject("select points from game.kill_method where id = ?", Integer.class,
                methodId(gameId, "Clamp"));
        assertThat(jdbc.queryForObject("select sum(points) from game.point_event where player_id = ?", Integer.class,
                kill.getKillerId())).isEqualTo(before + duelPoints - clampPoints);
        assertThat(jdbc.queryForObject("select sum(points) from game.point_event where player_id = ? and type = 'BONUS'",
                Integer.class, kill.getKillerId())).isEqualTo(7);
    }
}
