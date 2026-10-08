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

    Optional<Assignment> findByTargetIdAndStatus(UUID targetId, AssignmentStatus status);

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
