package com.assassin.api.player;

import com.assassin.api.common.CurrentUser;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameRepository;
import com.assassin.api.targeting.GameRound;
import com.assassin.api.targeting.GameRoundRepository;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeController {

    private final GameRepository games;
    private final PlayerRepository players;
    private final GameRoundRepository rounds;

    public MeController(GameRepository games, PlayerRepository players, GameRoundRepository rounds) {
        this.games = games;
        this.players = players;
        this.rounds = rounds;
    }

    /** Who the caller is, plus every game they play in (FINISHED ones too), most recently joined first. */
    @GetMapping("/api/me")
    @Transactional(readOnly = true)
    public MeResponse me(CurrentUser user) {
        List<Player> mine = players.findByAuthUserIdOrderByJoinedAtDesc(user.authUserId());
        Map<UUID, Game> byId = games.findAllById(mine.stream().map(Player::getGameId).toList()).stream()
                .collect(Collectors.toMap(Game::getId, Function.identity()));
        Map<UUID, Integer> currentRound = rounds.findByGameIdIn(byId.keySet()).stream()
                .collect(Collectors.toMap(GameRound::getGameId, GameRound::getRoundNo, Math::max));
        List<PlayerGame> mineWithGames = mine.stream()
                .map(p -> PlayerGame.from(byId.get(p.getGameId()), p, currentRound.get(p.getGameId())))
                .toList();
        return new MeResponse(user.email(), user.admin(), mineWithGames);
    }

    public record MeResponse(String email, @JsonProperty("isAdmin") boolean isAdmin, List<PlayerGame> games) {
    }
}
