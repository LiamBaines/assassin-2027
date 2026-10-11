package com.assassin.api.targeting;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KillRepository extends JpaRepository<Kill, Long> {

    List<Kill> findByGameIdOrderByIdDesc(UUID gameId);
}
