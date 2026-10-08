package com.assassin.api.player;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameRepository;
import com.assassin.api.game.GameStatus;
import java.util.Optional;
import java.util.UUID;
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

    /** The game a join code leads to, for the join page. Unknown codes count towards the attempt limit. */
    @Transactional(readOnly = true)
    public JoinPreview preview(CurrentUser user, String joinCode) {
        Game game = findByJoinCode(user, joinCode, HttpStatus.NOT_FOUND, false);
        boolean alreadyJoined = players.existsByGameIdAndAuthUserId(game.getId(), user.authUserId());
        return new JoinPreview(game.getId(), game.getName(), game.getStatus(), game.isSignupsOpen(), alreadyJoined);
    }

    public record JoinPreview(UUID gameId, String name, GameStatus status, boolean signupsOpen, boolean alreadyJoined) {
    }

    /** Registers the caller in the game with this join code. */
    @Transactional
    public PlayerGame signup(CurrentUser user, String displayName, String joinCode) {
        // Locked, so a concurrent PATCH that finishes the game or closes signups either commits first (and is seen
        // here) or waits until this signup has committed.
        Game game = findByJoinCode(user, joinCode, HttpStatus.BAD_REQUEST, true);
        if (game.getStatus() == GameStatus.FINISHED) {
            throw badJoinCode(HttpStatus.BAD_REQUEST);
        }
        if (!game.isSignupsOpen()) {
            throw new ApiException(HttpStatus.CONFLICT, "SIGNUPS_CLOSED", "Signups are closed.");
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
            return PlayerGame.from(game,
                    players.saveAndFlush(new Player(game.getId(), user.authUserId(), user.email(), displayName)));
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

    /**
     * The game that is not FINISHED with this join code, row-locked if {@code forUpdate}. Reserves an attempt first
     * (429 if the account has none left), keeps it as a failure for an unknown code, answered with
     * {@code BAD_JOIN_CODE} and {@code unknownStatus}, and releases it for a valid one.
     */
    private Game findByJoinCode(CurrentUser user, String joinCode, HttpStatus unknownStatus, boolean forUpdate) {
        JoinCodeAttemptLimiter.Reservation attempt = joinCodeLimiter.reserve(user.authUserId());
        String normalized = Game.normalizeJoinCode(joinCode);
        Optional<Game> game;
        try {
            game = forUpdate ? games.findLiveByJoinCodeForUpdate(normalized) : games.findLiveByJoinCode(normalized);
        } catch (RuntimeException e) {
            attempt.release(); // Not a wrong guess.
            throw e;
        }
        if (game.isEmpty()) {
            throw badJoinCode(unknownStatus);
        }
        attempt.release();
        return game.get();
    }

    private static ApiException badJoinCode(HttpStatus status) {
        return new ApiException(status, "BAD_JOIN_CODE", "That join code is not valid.");
    }

    private static ApiException alreadyRegistered() {
        return new ApiException(HttpStatus.CONFLICT, "ALREADY_REGISTERED", "You are already registered in this game.");
    }

    private static ApiException nameTaken() {
        return new ApiException(HttpStatus.CONFLICT, "NAME_TAKEN", "That display name is taken.");
    }
}
