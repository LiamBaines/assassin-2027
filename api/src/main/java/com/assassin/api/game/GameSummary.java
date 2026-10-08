package com.assassin.api.game;

import java.util.UUID;

/** Player-facing view of a game. Never includes the join code. */
public record GameSummary(UUID id, String name, GameStatus status, boolean signupsOpen) {

    public static GameSummary from(Game game) {
        return new GameSummary(game.getId(), game.getName(), game.getStatus(), game.isSignupsOpen());
    }
}
