package com.assassin.api.player;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PlayerRepository extends JpaRepository<Player, UUID> {

    Optional<Player> findByGameIdAndAuthUserId(String gameId, UUID authUserId);

    Optional<Player> findByIdAndGameId(UUID id, String gameId);

    boolean existsByGameIdAndAuthUserId(String gameId, UUID authUserId);

    boolean existsByGameIdAndDisplayNameIgnoreCase(String gameId, String displayName);

    List<Player> findByGameIdOrderByJoinedAtAsc(String gameId);

    List<Player> findByGameIdAndStatusOrderById(String gameId, PlayerStatus status);

    /** Every player row of one account, across games, most recently joined first. */
    List<Player> findByAuthUserIdOrderByJoinedAtDesc(UUID authUserId);

    long countByGameId(String gameId);

    /** Player counts (all statuses) per game. Games without players are absent. */
    @Query("select p.gameId as gameId, count(p) as count from Player p group by p.gameId")
    List<GamePlayerCount> countPerGame();

    /**
     * Every player of one game with whether they are the assassin of an ACTIVE assignment, by display name (so the
     * order reveals neither ring order nor join order).
     */
    @Query("""
            select p.displayName as displayName, p.status as status,
                   (case when exists (
                            select 1 from Assignment a
                             where a.assassinId = p.id and a.status = com.assassin.api.targeting.AssignmentStatus.ACTIVE)
                         then true else false end) as hasActiveAssignment
              from Player p
             where p.gameId = :gameId
             order by lower(p.displayName), p.displayName
            """)
    List<RosterRow> findRoster(String gameId);

    interface RosterRow {

        String getDisplayName();

        PlayerStatus getStatus();

        boolean getHasActiveAssignment();
    }

    interface GamePlayerCount {

        String getGameId();

        long getCount();
    }
}
