package com.assassin.api.event;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import com.assassin.api.game.GameService;
import com.assassin.api.player.PlayerRepository;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GameEventController {

    private final GameEventService events;
    private final PlayerRepository players;
    private final GameService games;

    public GameEventController(GameEventService events, PlayerRepository players, GameService games) {
        this.events = events;
        this.players = players;
        this.games = games;
    }

    /** The event log of any game, newest first. 404 GAME_NOT_FOUND. */
    @GetMapping("/api/admin/games/{gameId}/events")
    public GameEventService.EventPage admin(@PathVariable UUID gameId, @RequestParam(required = false) Long before,
            @RequestParam(required = false) Integer limit) {
        games.find(gameId);
        return events.list(gameId, before, limit);
    }

    /** The same log for a player of the game. 404 NOT_IN_GAME for non-members and unknown games. */
    @GetMapping("/api/me/games/{gameId}/events")
    public GameEventService.EventPage player(CurrentUser user, @PathVariable UUID gameId,
            @RequestParam(required = false) Long before, @RequestParam(required = false) Integer limit) {
        if (!players.existsByGameIdAndAuthUserId(gameId, user.authUserId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_IN_GAME", "You aren't a player in this game.");
        }
        return events.list(gameId, before, limit);
    }
}
