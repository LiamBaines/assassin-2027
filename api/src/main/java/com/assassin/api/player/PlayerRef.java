package com.assassin.api.player;

import java.util.UUID;

public record PlayerRef(UUID id, String displayName) {

    public static PlayerRef from(Player player) {
        return new PlayerRef(player.getId(), player.getDisplayName());
    }
}
