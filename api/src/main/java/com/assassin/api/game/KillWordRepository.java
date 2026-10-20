package com.assassin.api.game;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface KillWordRepository extends JpaRepository<KillWord, Long> {

    List<KillWord> findByGameIdOrderById(String gameId);

    /** Words of the game whose lower-cased text is in {@code lowered} (which must already be lower-case). */
    @Query("select w from KillWord w where w.gameId = :gameId and lower(w.text) in :lowered")
    List<KillWord> findByGameIdAndLowerTextIn(@Param("gameId") String gameId, @Param("lowered") Collection<String> lowered);
}
