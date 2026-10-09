package com.assassin.api.targeting;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KillClaimRepository extends JpaRepository<KillClaim, Long> {

    List<KillClaim> findByGameIdAndStatusInOrderByCreatedAtAsc(UUID gameId, List<KillClaimStatus> statuses);
}
