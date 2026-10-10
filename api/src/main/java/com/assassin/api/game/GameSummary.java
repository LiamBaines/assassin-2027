package com.assassin.api.game;

import java.util.UUID;

/** Player-facing view of a game. Never includes the join code. {@code currentRoundNo} is null before round 1. */
public record GameSummary(UUID id, String name, GameStatus status, boolean signupsOpen, Integer currentRoundNo) {

    public static GameSummary from(Game game, Integer currentRoundNo) {
        return new GameSummary(game.getId(), game.getName(), game.getStatus(), game.isSignupsOpen(), currentRoundNo);
    }
}
