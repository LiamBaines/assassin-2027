package com.assassin.api.game;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface GameRepository extends JpaRepository<Game, UUID> {

    /** The single game that is not FINISHED, if any. */
    @Query("select g from Game g where g.status <> com.assassin.api.game.GameStatus.FINISHED")
    Optional<Game> findLive();

    /** Same as {@link #findLive()} but takes a row lock ({@code SELECT ... FOR UPDATE}). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from Game g where g.status <> com.assassin.api.game.GameStatus.FINISHED")
    Optional<Game> findLiveForUpdate();
}
