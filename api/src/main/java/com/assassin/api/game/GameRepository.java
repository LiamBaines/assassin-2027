package com.assassin.api.game;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface GameRepository extends JpaRepository<Game, UUID> {

    /** Same as {@link #findById(Object)} but takes a row lock ({@code SELECT ... FOR UPDATE}). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from Game g where g.id = :id")
    Optional<Game> findByIdForUpdate(UUID id);

    /** The game that is not FINISHED with this (normalized) join code, if any. At most one exists. */
    @Query("""
            select g from Game g
             where g.joinCode = :joinCode and g.status <> com.assassin.api.game.GameStatus.FINISHED
            """)
    Optional<Game> findLiveByJoinCode(String joinCode);

    /** Every game, newest first. */
    List<Game> findAllByOrderByCreatedAtDesc();
}
