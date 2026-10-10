package com.assassin.api.targeting;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRoundRepository extends JpaRepository<GameRound, UUID> {

    Optional<GameRound> findFirstByGameIdAndEndedAtIsNull(UUID gameId);

    Optional<GameRound> findFirstByGameIdOrderByRoundNoDesc(UUID gameId);

    List<GameRound> findByGameId(UUID gameId);

    List<GameRound> findByGameIdIn(Collection<UUID> gameIds);
}
