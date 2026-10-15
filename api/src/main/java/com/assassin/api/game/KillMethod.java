package com.assassin.api.game;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "kill_method")
public class KillMethod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private String gameId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private int points;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected KillMethod() {
    }

    public KillMethod(String gameId, String name, int points, Instant createdAt) {
        this(gameId, name, points, true, createdAt);
    }

    public KillMethod(String gameId, String name, int points, boolean enabled, Instant createdAt) {
        this.gameId = gameId;
        this.name = name;
        this.points = points;
        this.enabled = enabled;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getGameId() {
        return gameId;
    }

    public String getName() {
        return name;
    }

    public int getPoints() {
        return points;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void update(String name, int points, boolean enabled) {
        this.name = name;
        this.points = points;
        this.enabled = enabled;
    }
}
