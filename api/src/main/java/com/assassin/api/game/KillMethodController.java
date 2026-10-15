package com.assassin.api.game;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import com.assassin.api.player.PlayerRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class KillMethodController {

    private final KillMethodService service;
    private final GameService games;
    private final PlayerRepository players;

    public KillMethodController(KillMethodService service, GameService games, PlayerRepository players) {
        this.service = service;
        this.games = games;
        this.players = players;
    }

    /** Every method of the game, disabled ones included. */
    @GetMapping("/api/admin/games/{gameId}/kill-methods")
    public List<KillMethodService.KillMethodView> admin(@PathVariable String gameId) {
        games.find(gameId);
        return service.list(gameId, false);
    }

    /** The enabled methods a player can pick. 404 NOT_IN_GAME if the caller doesn't play in the game. */
    @GetMapping("/api/me/games/{gameId}/kill-methods")
    public List<KillMethodService.KillMethodView> mine(CurrentUser user, @PathVariable String gameId) {
        players.findByGameIdAndAuthUserId(gameId, user.authUserId()).orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_IN_GAME", "You are not in this game."));
        return service.list(gameId, true);
    }
}
