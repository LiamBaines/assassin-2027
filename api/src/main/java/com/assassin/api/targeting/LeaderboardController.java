package com.assassin.api.targeting;

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
public class LeaderboardController {

    private final LeaderboardService leaderboards;
    private final PlayerRepository players;
    private final GameService games;

    public LeaderboardController(LeaderboardService leaderboards, PlayerRepository players, GameService games) {
        this.leaderboards = leaderboards;
        this.players = players;
        this.games = games;
    }

    /** The ranked leaderboard of any game; no {@code roundNo} means the game total. 404 GAME_NOT_FOUND, ROUND_NOT_FOUND. */
    @GetMapping("/api/admin/games/{gameId}/leaderboard")
    public LeaderboardService.Leaderboard admin(@PathVariable UUID gameId,
            @RequestParam(required = false) Integer roundNo) {
        games.find(gameId);
        return leaderboards.leaderboard(gameId, roundNo);
    }

    /** The same leaderboard for a player of the game. 404 NOT_IN_GAME for non-members and unknown games. */
    @GetMapping("/api/me/games/{gameId}/leaderboard")
    public LeaderboardService.Leaderboard player(CurrentUser user, @PathVariable UUID gameId,
            @RequestParam(required = false) Integer roundNo) {
        if (!players.existsByGameIdAndAuthUserId(gameId, user.authUserId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_IN_GAME", "You aren't a player in this game.");
        }
        return leaderboards.leaderboard(gameId, roundNo);
    }
}
