package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.player.PlayerRef;
import com.assassin.api.player.PlayerStatus;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Ranked points per player, aggregated from the point ledger. */
@Service
public class LeaderboardService {

    private static final String TOTALS = """
            select p.id, p.display_name, p.status,
                   coalesce(sum(e.points), 0) as points,
                   count(e.id) filter (where e.type = 'KILL') as kills,
                   count(e.id) filter (where e.type = 'DEATH') as deaths
              from game.player p
              left join game.point_event e
                     on e.player_id = p.id and e.game_id = p.game_id %s
             where p.game_id = ?
             group by p.id, p.display_name, p.status
            """;

    private final JdbcTemplate jdbc;

    public LeaderboardService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The leaderboard of one game; {@code roundNo} null means the game total. */
    @Transactional(readOnly = true)
    public Leaderboard leaderboard(UUID gameId, Integer roundNo) {
        List<Row> rows;
        if (roundNo == null) {
            rows = jdbc.query(TOTALS.formatted(""), LeaderboardService::row, gameId);
        } else {
            UUID roundId = jdbc.queryForList("select id from game.game_round where game_id = ? and round_no = ?",
                    UUID.class, gameId, roundNo).stream().findFirst()
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ROUND_NOT_FOUND",
                            "Round " + roundNo + " does not exist in this game."));
            rows = jdbc.query(TOTALS.formatted("and e.game_round_id = ?"), LeaderboardService::row, roundId, gameId);
        }
        List<Integer> rounds = jdbc.queryForList(
                "select round_no from game.game_round where game_id = ? order by round_no", Integer.class, gameId);
        return new Leaderboard(roundNo, rounds, rank(rows));
    }

    /** Orders by points desc, kills desc, name, and gives ties (same points and kills) a shared rank: 1, 2, 2, 4. */
    static List<Entry> rank(List<Row> rows) {
        List<Row> sorted = rows.stream()
                .sorted(Comparator.comparingInt(Row::points).reversed()
                        .thenComparing(Comparator.comparingInt(Row::kills).reversed())
                        .thenComparing(r -> r.player().displayName().toLowerCase())
                        .thenComparing(r -> r.player().displayName()))
                .toList();
        Entry[] entries = new Entry[sorted.size()];
        for (int i = 0; i < sorted.size(); i++) {
            Row r = sorted.get(i);
            int rank = i + 1;
            if (i > 0 && r.points() == sorted.get(i - 1).points() && r.kills() == sorted.get(i - 1).kills()) {
                rank = entries[i - 1].rank();
            }
            entries[i] = new Entry(rank, r.player(), r.points(), r.kills(), r.deaths(), r.status());
        }
        return List.of(entries);
    }

    private static Row row(java.sql.ResultSet rs, int i) throws java.sql.SQLException {
        return new Row(new PlayerRef(rs.getObject("id", UUID.class), rs.getString("display_name")),
                rs.getInt("points"), rs.getInt("kills"), rs.getInt("deaths"),
                PlayerStatus.valueOf(rs.getString("status")));
    }

    record Row(PlayerRef player, int points, int kills, int deaths, PlayerStatus status) {
    }

    public record Entry(int rank, PlayerRef player, int points, int kills, int deaths, PlayerStatus status) {
    }

    public record Leaderboard(Integer roundNo, List<Integer> rounds, List<Entry> entries) {
    }
}
