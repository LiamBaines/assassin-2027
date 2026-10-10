package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;

import com.assassin.api.player.PlayerRef;
import com.assassin.api.player.PlayerStatus;
import com.assassin.api.targeting.LeaderboardService.Entry;
import com.assassin.api.targeting.LeaderboardService.Row;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LeaderboardRankingTest {

    private static Row row(String name, int points, int kills) {
        return new Row(new PlayerRef(UUID.randomUUID(), name), points, kills, 0, PlayerStatus.ALIVE);
    }

    private static List<String> names(List<Entry> entries) {
        return entries.stream().map(e -> e.player().displayName()).toList();
    }

    private static List<Integer> ranks(List<Entry> entries) {
        return entries.stream().map(Entry::rank).toList();
    }

    @Test
    void ordersByPointsThenKillsThenName() {
        List<Entry> out = LeaderboardService.rank(List.of(
                row("zed", 10, 1), row("amy", 5, 2), row("bob", 10, 2), row("cat", 5, 2)));
        assertThat(names(out)).containsExactly("bob", "zed", "amy", "cat");
    }

    @Test
    void tiesShareRankAndSkipNext() {
        List<Entry> out = LeaderboardService.rank(List.of(
                row("a", 20, 2), row("b", 10, 1), row("c", 10, 1), row("d", 0, 0)));
        assertThat(ranks(out)).containsExactly(1, 2, 2, 4);
        assertThat(names(out)).containsExactly("a", "b", "c", "d");
    }

    @Test
    void samePointsButDifferentKillsDoNotTie() {
        List<Entry> out = LeaderboardService.rank(List.of(row("a", 5, 1), row("b", 5, 2)));
        assertThat(ranks(out)).containsExactly(1, 2);
        assertThat(names(out)).containsExactly("b", "a");
    }

    @Test
    void negativeTotalsRankBelowZero() {
        List<Entry> out = LeaderboardService.rank(List.of(row("a", -5, 0), row("b", 0, 0)));
        assertThat(names(out)).containsExactly("b", "a");
    }

    @Test
    void emptyRoster() {
        assertThat(LeaderboardService.rank(List.of())).isEmpty();
    }
}
