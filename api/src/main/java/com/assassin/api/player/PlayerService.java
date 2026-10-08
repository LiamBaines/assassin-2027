package com.assassin.api.player;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameRepository;
import com.assassin.api.game.GameService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayerService {

    private final GameRepository games;
    private final PlayerRepository players;

    public PlayerService(GameRepository games, PlayerRepository players) {
        this.games = games;
        this.players = players;
    }

    /** Registers the caller in the live game. {@code joinCode} must already be normalized. */
    @Transactional
    public Player signup(CurrentUser user, String displayName, String joinCode) {
        Game game = games.findLive().orElseThrow(GameService::noLiveGame);
        if (!game.isSignupsOpen()) {
            throw new ApiException(HttpStatus.CONFLICT, "SIGNUPS_CLOSED", "Signups are closed.");
        }
        if (!game.getJoinCode().equals(joinCode)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_JOIN_CODE", "That join code is not valid.");
        }
        if (user.email() == null || user.email().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMAIL_REQUIRED", "Your account has no email address.");
        }
        if (players.existsByGameIdAndAuthUserId(game.getId(), user.authUserId())) {
            throw alreadyRegistered();
        }
        if (players.existsByGameIdAndDisplayNameIgnoreCase(game.getId(), displayName)) {
            throw nameTaken();
        }
        try {
            return players.saveAndFlush(new Player(game.getId(), user.authUserId(), user.email(), displayName));
        } catch (DataIntegrityViolationException e) {
            // Lost a race with a concurrent signup.
            String message = String.valueOf(e.getMostSpecificCause().getMessage());
            throw message.contains("player_game_display_name_uq") ? nameTaken() : alreadyRegistered();
        }
    }

    private static ApiException alreadyRegistered() {
        return new ApiException(HttpStatus.CONFLICT, "ALREADY_REGISTERED", "You are already registered in this game.");
    }

    private static ApiException nameTaken() {
        return new ApiException(HttpStatus.CONFLICT, "NAME_TAKEN", "That display name is taken.");
    }
}
