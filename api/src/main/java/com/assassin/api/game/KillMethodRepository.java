package com.assassin.api.game;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KillMethodRepository extends JpaRepository<KillMethod, Long> {

    List<KillMethod> findByGameIdOrderById(String gameId);
}
