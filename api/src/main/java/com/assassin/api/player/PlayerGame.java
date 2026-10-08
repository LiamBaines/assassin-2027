package com.assassin.api.player;

import com.assassin.api.game.Game;
import com.assassin.api.game.GameSummary;

/** A game the caller plays in, with their player in it. */
public record PlayerGame(GameSummary game, PlayerSummary player) {

    public static PlayerGame from(Game game, Player player) {
        return new PlayerGame(GameSummary.from(game), PlayerSummary.from(player));
    }
}
