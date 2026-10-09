package com.assassin.api.targeting;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface KillClaimRepository extends JpaRepository<KillClaim, Long> {

    List<KillClaim> findByGameIdAndStatusInOrderByCreatedAtAsc(UUID gameId, List<KillClaimStatus> statuses);

    Optional<KillClaim> findByIdAndGameId(Long id, UUID gameId);

    boolean existsByVictimIdAndStatusIn(UUID victimId, Collection<KillClaimStatus> statuses);

    Optional<KillClaim> findFirstByKillerIdOrderByIdDesc(UUID killerId);

    Optional<KillClaim> findFirstByVictimIdAndStatus(UUID victimId, KillClaimStatus status);

    /** Bulk-voids every open claim of the game. Runs immediately, after flushing pending changes. */
    @Modifying(flushAutomatically = true)
    @Query("""
            update KillClaim c
               set c.status = com.assassin.api.targeting.KillClaimStatus.VOIDED, c.resolvedAt = :at
             where c.gameId = :gameId
               and c.status in (com.assassin.api.targeting.KillClaimStatus.PENDING,
                                com.assassin.api.targeting.KillClaimStatus.CONTESTED)
            """)
    int voidOpenInGame(UUID gameId, Instant at);

    /** Bulk-voids every open claim where the player is the killer or the victim. */
    @Modifying(flushAutomatically = true)
    @Query("""
            update KillClaim c
               set c.status = com.assassin.api.targeting.KillClaimStatus.VOIDED, c.resolvedAt = :at
             where (c.killerId = :playerId or c.victimId = :playerId)
               and c.status in (com.assassin.api.targeting.KillClaimStatus.PENDING,
                                com.assassin.api.targeting.KillClaimStatus.CONTESTED)
            """)
    int voidOpenForPlayer(UUID playerId, Instant at);
}
