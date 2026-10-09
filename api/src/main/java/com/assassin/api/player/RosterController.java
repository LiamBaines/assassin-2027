package com.assassin.api.player;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import com.assassin.api.game.GameRepository;
import com.assassin.api.game.GameStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RosterController {

    private final PlayerRepository players;
    private final GameRepository games;

    public RosterController(PlayerRepository players, GameRepository games) {
        this.players = players;
        this.games = games;
    }

    /**
     * Every player's display name and status in one game, for any player of that game. Nothing that hints at who
     * hunts whom. 404 NOT_IN_GAME for non-members and unknown games, 404 GAME_NOT_STARTED while the game is in SETUP.
     */
    @GetMapping("/api/me/games/{gameId}/players")
    @Transactional(readOnly = true)
    public RosterResponse roster(CurrentUser user, @PathVariable UUID gameId) {
        if (!players.existsByGameIdAndAuthUserId(gameId, user.authUserId())) {
            throw notInGame();
        }
        GameStatus status = games.findById(gameId).orElseThrow(RosterController::notInGame).getStatus();
        if (status == GameStatus.SETUP) {
            throw new ApiException(HttpStatus.NOT_FOUND, "GAME_NOT_STARTED", "The game hasn't started yet.");
        }
        return new RosterResponse(players.findRoster(gameId).stream()
                .map(r -> new RosterEntry(r.getDisplayName(), RosterStatus.of(r.getStatus(), r.getHasActiveAssignment())))
                .toList());
    }

    private static ApiException notInGame() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_IN_GAME", "You aren't a player in this game.");
    }

    /** {@link PlayerStatus} plus WAITING: alive but not yet in the ring. Computed, never stored. */
    public enum RosterStatus {
        ALIVE,
        DEAD,
        REMOVED,
        WAITING;

        static RosterStatus of(PlayerStatus status, boolean hasActiveAssignment) {
            return switch (status) {
                case ALIVE -> hasActiveAssignment ? ALIVE : WAITING;
                case DEAD -> DEAD;
                case REMOVED -> REMOVED;
            };
        }
    }

    public record RosterResponse(List<RosterEntry> players) {
    }

    public record RosterEntry(String displayName, RosterStatus status) {
    }
}
