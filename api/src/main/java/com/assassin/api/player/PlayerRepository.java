package com.assassin.api.player;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerRepository extends JpaRepository<Player, UUID> {

    Optional<Player> findByGameIdAndAuthUserId(UUID gameId, UUID authUserId);

    Optional<Player> findByIdAndGameId(UUID id, UUID gameId);

    boolean existsByGameIdAndAuthUserId(UUID gameId, UUID authUserId);

    boolean existsByGameIdAndDisplayNameIgnoreCase(UUID gameId, String displayName);

    List<Player> findByGameIdOrderByJoinedAtAsc(UUID gameId);

    List<Player> findByGameIdAndStatusOrderById(UUID gameId, PlayerStatus status);
}
