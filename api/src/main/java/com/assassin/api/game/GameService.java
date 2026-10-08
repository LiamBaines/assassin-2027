package com.assassin.api.game;

import com.assassin.api.common.ApiException;
import java.time.Instant;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GameService {

    private final GameRepository games;

    public GameService(GameRepository games) {
        this.games = games;
    }

    public static ApiException noLiveGame() {
        return new ApiException(HttpStatus.NOT_FOUND, "NO_LIVE_GAME", "There is no live game.");
    }

    @Transactional(readOnly = true)
    public Game getLive() {
        return games.findLive().orElseThrow(GameService::noLiveGame);
    }

    @Transactional
    public Game create(String name, String joinCode) {
        if (games.findLive().isPresent()) {
            throw liveGameExists();
        }
        try {
            return games.saveAndFlush(new Game(name, joinCode));
        } catch (DataIntegrityViolationException e) {
            throw liveGameExists(); // lost a race on the one-live-game index
        }
    }

    /** Applies the non-null fields. {@code status} may only be FINISHED. */
    @Transactional
    public Game update(String name, String joinCode, Boolean signupsOpen, GameStatus status) {
        if (status != null && status != GameStatus.FINISHED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STATUS", "A game's status can only be set to FINISHED.");
        }
        Game game = games.findLiveForUpdate().orElseThrow(GameService::noLiveGame);
        if (name != null) {
            game.rename(name);
        }
        if (joinCode != null) {
            game.changeJoinCode(joinCode);
        }
        if (signupsOpen != null) {
            game.setSignupsOpen(signupsOpen);
        }
        if (status == GameStatus.FINISHED) {
            game.finish(Instant.now());
        }
        return games.saveAndFlush(game);
    }

    private static ApiException liveGameExists() {
        return new ApiException(HttpStatus.CONFLICT, "LIVE_GAME_EXISTS", "Finish the current game before creating a new one.");
    }
}
