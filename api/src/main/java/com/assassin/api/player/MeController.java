package com.assassin.api.player;

import com.assassin.api.common.CurrentUser;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameRepository;
import com.assassin.api.game.GameSummary;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Optional;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeController {

    private final GameRepository games;
    private final PlayerRepository players;

    public MeController(GameRepository games, PlayerRepository players) {
        this.games = games;
        this.players = players;
    }

    /** Who the caller is, plus the live game and their player in it (both nullable). */
    @GetMapping("/api/me")
    @Transactional(readOnly = true)
    public MeResponse me(CurrentUser user) {
        Optional<Game> game = games.findLive();
        PlayerSummary player = game
                .flatMap(g -> players.findByGameIdAndAuthUserId(g.getId(), user.authUserId()))
                .map(PlayerSummary::from)
                .orElse(null);
        return new MeResponse(user.email(), user.admin(), game.map(GameSummary::from).orElse(null), player);
    }

    public record MeResponse(String email, @JsonProperty("isAdmin") boolean isAdmin, GameSummary game,
            PlayerSummary player) {
    }
}
