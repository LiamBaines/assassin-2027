package com.assassin.api.player;

import java.time.Instant;
import java.util.UUID;

public record PlayerSummary(UUID id, String displayName, PlayerStatus status, Instant joinedAt) {

    public static PlayerSummary from(Player player) {
        return new PlayerSummary(player.getId(), player.getDisplayName(), player.getStatus(), player.getJoinedAt());
    }
}
