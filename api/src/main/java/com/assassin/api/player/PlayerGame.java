package com.assassin.api.player;

import com.assassin.api.game.Game;
import com.assassin.api.game.GameSummary;

/** A game the caller plays in, with their player in it. */
public record PlayerGame(GameSummary game, PlayerSummary player) {

    public static PlayerGame from(Game game, Player player, Integer currentRoundNo) {
        return new PlayerGame(GameSummary.from(game, currentRoundNo), PlayerSummary.from(player));
    }
}
