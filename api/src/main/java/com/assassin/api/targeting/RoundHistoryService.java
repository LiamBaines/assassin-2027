package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.player.PlayerRef;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only views over a game's rounds. */
@Service
public class RoundHistoryService {

    private static final String ROUNDS = """
            select r.id, r.round_no, r.started_at, r.ended_at, r.winner_id, w.display_name as winner_name,
                   (select count(distinct a.assassin_id)
                      from game.assignment a join game.allocation al on al.id = a.allocation_id
                     where al.game_round_id = r.id) as player_count
              from game.game_round r
              left join game.player w on w.id = r.winner_id
             where r.game_id = ? %s
             order by r.round_no desc
            """;

    private static final String KILLS_BY_VICTIM = """
            select al.game_round_id, k.killer_id, kp.display_name as killer_name
              from game.kill k
              join game.assignment a on a.id = k.assignment_id
              join game.allocation al on al.id = a.allocation_id
              join game.player kp on kp.id = k.killer_id
             where k.victim_id = ?
            """;

    private static final String ROUNDS_PLAYED = """
            select distinct al.game_round_id
              from game.assignment a join game.allocation al on al.id = a.allocation_id
             where (a.assassin_id = ? or a.target_id = ?) and a.status <> 'VOIDED' and a.game_id = ?
            """;

    private final JdbcTemplate jdbc;

    public RoundHistoryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Every round of the game, newest first. */
    @Transactional(readOnly = true)
    public List<AdminRound> adminRounds(UUID gameId) {
        return jdbc.query(ROUNDS.formatted(""), (rs, i) -> new AdminRound(rs.getInt("round_no"),
                rs.getObject("started_at", java.time.OffsetDateTime.class).toInstant(), instant(rs, "ended_at"),
                winner(rs), rs.getInt("player_count")), gameId);
    }

    /** The closed rounds of the game as seen by one of its players, newest first. */
    @Transactional(readOnly = true)
    public List<PlayerRound> playerRounds(UUID gameId, UUID playerId) {
        Map<UUID, KillInfo> killedIn = jdbc.query(KILLS_BY_VICTIM,
                (rs, i) -> Map.entry(rs.getObject("game_round_id", UUID.class),
                        new KillInfo(rs.getString("killer_name"))), playerId)
                .stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        List<UUID> played = jdbc.queryForList(ROUNDS_PLAYED, UUID.class, playerId, playerId, gameId);
        return jdbc.query(ROUNDS.formatted("and r.ended_at is not null"), (rs, i) -> {
            UUID roundId = rs.getObject("id", UUID.class);
            KillInfo kill = killedIn.get(roundId);
            Outcome outcome = kill != null ? Outcome.KILLED : played.contains(roundId) ? Outcome.SURVIVED : Outcome.OUT;
            return new PlayerRound(rs.getInt("round_no"),
                    rs.getObject("started_at", java.time.OffsetDateTime.class).toInstant(), instant(rs, "ended_at"),
                    winner(rs), outcome, kill == null ? null : kill.killerName());
        }, gameId);
    }

    private static Instant instant(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
        var at = rs.getObject(column, java.time.OffsetDateTime.class);
        return at == null ? null : at.toInstant();
    }

    private static PlayerRef winner(java.sql.ResultSet rs) throws java.sql.SQLException {
        UUID id = rs.getObject("winner_id", UUID.class);
        return id == null ? null : new PlayerRef(id, rs.getString("winner_name"));
    }

    public enum Outcome {
        KILLED, SURVIVED, OUT
    }

    private record KillInfo(String killerName) {
    }

    public record AdminRound(int roundNo, Instant startedAt, Instant endedAt, PlayerRef winner, int playerCount) {
    }

    public record PlayerRound(int roundNo, Instant startedAt, Instant endedAt, PlayerRef winner, Outcome myOutcome,
            String killedBy) {
    }
}
