package com.assassin.api.targeting;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {

    List<Assignment> findByGameIdAndStatusOrderById(UUID gameId, AssignmentStatus status);

    Optional<Assignment> findByAssassinIdAndStatus(UUID assassinId, AssignmentStatus status);

    @Query("""
            select count(a) from Assignment a
            where a.status = com.assassin.api.targeting.AssignmentStatus.ACTIVE
              and (a.assassinId = :playerId or a.targetId = :playerId)
            """)
    long countActiveInvolving(UUID playerId);

    /** Bulk-marks every ACTIVE assignment of the game SUPERSEDED. Runs immediately, after flushing pending changes. */
    @Modifying(flushAutomatically = true)
    @Query("""
            update Assignment a
               set a.status = com.assassin.api.targeting.AssignmentStatus.SUPERSEDED, a.endedAt = :endedAt
             where a.gameId = :gameId
               and a.status = com.assassin.api.targeting.AssignmentStatus.ACTIVE
            """)
    int supersedeActive(UUID gameId, Instant endedAt);
}
