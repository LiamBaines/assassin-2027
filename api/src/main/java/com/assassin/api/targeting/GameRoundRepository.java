package com.assassin.api.targeting;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRoundRepository extends JpaRepository<GameRound, UUID> {

    Optional<GameRound> findFirstByGameIdAndEndedAtIsNull(String gameId);

    Optional<GameRound> findFirstByGameIdOrderByRoundNoDesc(String gameId);

    List<GameRound> findByGameId(String gameId);

    List<GameRound> findByGameIdIn(Collection<String> gameIds);
}
