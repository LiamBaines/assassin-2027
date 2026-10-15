package com.assassin.api.targeting;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AllocationRepository extends JpaRepository<Allocation, UUID> {

    @Query("select max(r.allocationNo) from Allocation r where r.gameId = :gameId")
    Optional<Integer> findCurrentAllocationNo(String gameId);

    Optional<Allocation> findFirstByGameIdOrderByAllocationNoDesc(String gameId);

    List<Allocation> findByGameIdOrderByAllocationNoDesc(String gameId);
}
