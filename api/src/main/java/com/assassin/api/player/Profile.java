package com.assassin.api.player;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** An account's display name, chosen once at first login and copied into each game the account joins. */
@Entity
@Table(name = "profile")
public class Profile {

    @Id
    @Column(name = "auth_user_id")
    private UUID authUserId;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Profile() {
    }

    public Profile(UUID authUserId, String displayName) {
        this.authUserId = authUserId;
        this.displayName = displayName;
        this.createdAt = Instant.now();
    }

    public UUID getAuthUserId() {
        return authUserId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
