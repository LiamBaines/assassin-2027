package com.assassin.api.player;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameRepository;
import com.assassin.api.game.GameService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayerService {

    private final GameRepository games;
    private final PlayerRepository players;
    private final JoinCodeAttemptLimiter joinCodeLimiter;

    public PlayerService(GameRepository games, PlayerRepository players, JoinCodeAttemptLimiter joinCodeLimiter) {
        this.games = games;
        this.players = players;
        this.joinCodeLimiter = joinCodeLimiter;
    }

    /** Registers the caller in the live game. {@code joinCode} must already be normalized. */
    @Transactional
    public Player signup(CurrentUser user, String displayName, String joinCode) {
        Game game = games.findLive().orElseThrow(GameService::noLiveGame);
        if (!game.isSignupsOpen()) {
            throw new ApiException(HttpStatus.CONFLICT, "SIGNUPS_CLOSED", "Signups are closed.");
        }
        joinCodeLimiter.checkAllowed(user.authUserId());
        if (!MessageDigest.isEqual(bytes(game.getJoinCode()), bytes(joinCode))) {
            joinCodeLimiter.recordFailure(user.authUserId());
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_JOIN_CODE", "That join code is not valid.");
        }
        if (user.email() == null || user.email().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMAIL_REQUIRED", "Your account has no email address.");
        }
        validateDisplayName(displayName);
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
            if (message.contains("player_game_display_name_uq")) {
                throw nameTaken();
            }
            if (message.contains("player_game_auth_user_uq")) {
                throw alreadyRegistered();
            }
            throw e;
        }
    }

    /**
     * Counts code points, as Postgres does, so an emoji is one character. Rejects invisible
     * characters, so "Alice" plus a zero-width space can't sit next to "Alice".
     */
    private static void validateDisplayName(String displayName) {
        int length = displayName.codePointCount(0, displayName.length());
        boolean invisible = displayName.codePoints().anyMatch(c ->
                Character.getType(c) == Character.CONTROL || Character.getType(c) == Character.FORMAT);
        if (length < 2 || length > 32 || invisible) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DISPLAY_NAME",
                    "Display names must be 2-32 visible characters.");
        }
    }

    private static byte[] bytes(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    private static ApiException alreadyRegistered() {
        return new ApiException(HttpStatus.CONFLICT, "ALREADY_REGISTERED", "You are already registered in this game.");
    }

    private static ApiException nameTaken() {
        return new ApiException(HttpStatus.CONFLICT, "NAME_TAKEN", "That display name is taken.");
    }
}
