package com.assassin.api.targeting;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface DuelRepository extends JpaRepository<Duel, Long> {

    Optional<Duel> findByIdAndGameId(Long id, String gameId);

    List<Duel> findByGameIdAndStatusInOrderByCreatedAtAsc(String gameId, Collection<DuelStatus> statuses);

    boolean existsByChallengerIdAndStatusIn(UUID challengerId, Collection<DuelStatus> statuses);

    /** Bulk-voids every open duel of the game. Runs immediately, after flushing pending changes. */
    @Modifying(flushAutomatically = true)
    @Query("""
            update Duel d
               set d.status = com.assassin.api.targeting.DuelStatus.VOIDED, d.resolvedAt = :at
             where d.gameId = :gameId
               and d.status in (com.assassin.api.targeting.DuelStatus.PENDING,
                                com.assassin.api.targeting.DuelStatus.ACCEPTED,
                                com.assassin.api.targeting.DuelStatus.REPORTED,
                                com.assassin.api.targeting.DuelStatus.CONTESTED)
            """)
    int voidOpenInGame(String gameId, Instant at);

    /** Bulk-voids every open duel where the player is the challenger or the challenged. */
    @Modifying(flushAutomatically = true)
    @Query("""
            update Duel d
               set d.status = com.assassin.api.targeting.DuelStatus.VOIDED, d.resolvedAt = :at
             where (d.challengerId = :playerId or d.challengedId = :playerId)
               and d.status in (com.assassin.api.targeting.DuelStatus.PENDING,
                                com.assassin.api.targeting.DuelStatus.ACCEPTED,
                                com.assassin.api.targeting.DuelStatus.REPORTED,
                                com.assassin.api.targeting.DuelStatus.CONTESTED)
            """)
    int voidOpenForPlayer(UUID playerId, Instant at);
}
