package com.assassin.api.targeting;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AssignmentRoundRepository extends JpaRepository<AssignmentRound, UUID> {

    @Query("select max(r.roundNo) from AssignmentRound r where r.gameId = :gameId")
    Optional<Integer> findCurrentRoundNo(UUID gameId);

    Optional<AssignmentRound> findFirstByGameIdOrderByRoundNoDesc(UUID gameId);

    List<AssignmentRound> findByGameIdOrderByRoundNoDesc(UUID gameId);
}
