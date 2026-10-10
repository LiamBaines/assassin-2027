package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.assassin.api.IntegrationTest;
import com.assassin.api.common.ApiException;
import com.assassin.api.targeting.LeaderboardService.Entry;
import com.assassin.api.targeting.LeaderboardService.Leaderboard;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class LeaderboardIT extends IntegrationTest {

    @Autowired
    private LeaderboardService service;

    private UUID gameId;
    private UUID round1;
    private UUID round2;
    private UUID alice;
    private UUID bob;
    private UUID carol;

    @BeforeEach
    void setUp() {
        gameId = insertGame("LDB123", "ACTIVE", false);
        alice = insertPlayer(gameId, "alice@example.com", "alice", "ALIVE");
        bob = insertPlayer(gameId, "bob@example.com", "bob", "DEAD");
        carol = insertPlayer(gameId, "carol@example.com", "carol", "REMOVED");
        round1 = insertRound(1);
        round2 = insertRound(2);
    }

    private UUID insertRound(int no) {
        return jdbc.queryForObject("""
                insert into game.game_round (game_id, round_no, created_by, ended_at)
                values (?, ?, 'test', case when ? = 1 then now() end) returning id
                """, UUID.class, gameId, no, no);
    }

    private void event(UUID round, UUID player, int points, String type) {
        jdbc.update("insert into game.point_event (game_id, game_round_id, player_id, points, type) values (?, ?, ?, ?, ?)",
                gameId, round, player, points, type);
    }

    private Entry entry(Leaderboard board, UUID player) {
        return board.entries().stream().filter(e -> e.player().id().equals(player)).findFirst().orElseThrow();
    }

    @Test
    void totalsAcrossTwoRoundsAndPerRoundView() {
        event(round1, alice, 10, "KILL");
        event(round1, bob, -5, "DEATH");
        event(round2, alice, 10, "KILL");
        event(round2, bob, 10, "KILL");
        event(round2, alice, -5, "DEATH");

        Leaderboard total = service.leaderboard(gameId, null);
        assertThat(total.roundNo()).isNull();
        assertThat(total.rounds()).containsExactly(1, 2);
        assertThat(entry(total, alice).points()).isEqualTo(15);
        assertThat(entry(total, alice).kills()).isEqualTo(2);
        assertThat(entry(total, alice).deaths()).isEqualTo(1);
        assertThat(entry(total, bob).points()).isEqualTo(5);
        assertThat(total.entries().get(0).player().id()).isEqualTo(alice);

        Leaderboard r1 = service.leaderboard(gameId, 1);
        assertThat(r1.roundNo()).isEqualTo(1);
        assertThat(entry(r1, alice).points()).isEqualTo(10);
        assertThat(entry(r1, bob).points()).isEqualTo(-5);
        assertThat(entry(r1, bob).deaths()).isEqualTo(1);
        assertThat(entry(r1, bob).kills()).isZero();

        Leaderboard r2 = service.leaderboard(gameId, 2);
        assertThat(entry(r2, alice).points()).isEqualTo(5);
        assertThat(entry(r2, bob).points()).isEqualTo(10);
    }

    @Test
    void negativeTotalsAndZeroPointPlayersAreListedIncludingRemoved() {
        event(round1, bob, -5, "DEATH");

        Leaderboard board = service.leaderboard(gameId, null);

        assertThat(board.entries()).hasSize(3);
        assertThat(entry(board, bob).points()).isEqualTo(-5);
        assertThat(entry(board, bob).rank()).isEqualTo(3);
        assertThat(entry(board, alice).points()).isZero();
        assertThat(entry(board, alice).rank()).isEqualTo(1);
        assertThat(entry(board, carol).rank()).isEqualTo(1);
        assertThat(entry(board, carol).status().name()).isEqualTo("REMOVED");
    }

    @Test
    void eventsWithoutARoundCountInTheTotalOnly() {
        event(null, alice, 7, "KILL");

        assertThat(entry(service.leaderboard(gameId, null), alice).points()).isEqualTo(7);
        assertThat(entry(service.leaderboard(gameId, 1), alice).points()).isZero();
    }

    @Test
    void unknownRoundIsNotFound() {
        assertThatThrownBy(() -> service.leaderboard(gameId, 9))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("ROUND_NOT_FOUND"));
    }
}
