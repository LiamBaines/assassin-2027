package com.assassin.api.player;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PlayerRepository extends JpaRepository<Player, UUID> {

    Optional<Player> findByGameIdAndAuthUserId(UUID gameId, UUID authUserId);

    Optional<Player> findByIdAndGameId(UUID id, UUID gameId);

    boolean existsByGameIdAndAuthUserId(UUID gameId, UUID authUserId);

    boolean existsByGameIdAndDisplayNameIgnoreCase(UUID gameId, String displayName);

    List<Player> findByGameIdOrderByJoinedAtAsc(UUID gameId);

    List<Player> findByGameIdAndStatusOrderById(UUID gameId, PlayerStatus status);

    /** Every player row of one account, across games, most recently joined first. */
    List<Player> findByAuthUserIdOrderByJoinedAtDesc(UUID authUserId);

    long countByGameId(UUID gameId);

    /** Player counts (all statuses) per game. Games without players are absent. */
    @Query("select p.gameId as gameId, count(p) as count from Player p group by p.gameId")
    List<GamePlayerCount> countPerGame();

    interface GamePlayerCount {

        UUID getGameId();

        long getCount();
    }
}
