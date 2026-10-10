package com.assassin.api.targeting;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "point_event")
public class PointEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private UUID gameId;

    @Column(name = "game_round_id")
    private UUID gameRoundId;

    @Column(name = "player_id", nullable = false)
    private UUID playerId;

    @Column(nullable = false)
    private int points;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PointType type;

    @Column(name = "kill_id")
    private Long killId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "created_by")
    private String createdBy;

    protected PointEvent() {
    }

    public PointEvent(UUID gameId, UUID gameRoundId, UUID playerId, int points, PointType type, Long killId,
            Instant createdAt, String createdBy) {
        this.gameId = gameId;
        this.gameRoundId = gameRoundId;
        this.playerId = playerId;
        this.points = points;
        this.type = type;
        this.killId = killId;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
    }

    public Long getId() {
        return id;
    }

    public UUID getGameId() {
        return gameId;
    }

    public UUID getGameRoundId() {
        return gameRoundId;
    }

    public UUID getPlayerId() {
        return playerId;
    }

    public int getPoints() {
        return points;
    }

    public PointType getType() {
        return type;
    }

    public Long getKillId() {
        return killId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }
}
