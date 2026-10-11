package com.assassin.api.targeting;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PointEventRepository extends JpaRepository<PointEvent, Long> {

    /** What the killer has been awarded for this kill so far: the KILL row plus any ADJUST rows. */
    @Query("select coalesce(sum(e.points), 0) from PointEvent e where e.killId = :killId and e.playerId = :playerId and e.type in (com.assassin.api.targeting.PointType.KILL, com.assassin.api.targeting.PointType.ADJUST)")
    int awardedForKill(Long killId, UUID playerId);
}
