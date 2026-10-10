package com.assassin.api.targeting;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "game_round")
public class GameRound {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "game_id", nullable = false)
    private UUID gameId;

    @Column(name = "round_no", nullable = false)
    private int roundNo;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "winner_id")
    private UUID winnerId;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    protected GameRound() {
    }

    public GameRound(UUID gameId, int roundNo, String createdBy, Instant startedAt) {
        this.gameId = gameId;
        this.roundNo = roundNo;
        this.createdBy = createdBy;
        this.startedAt = startedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getGameId() {
        return gameId;
    }

    public int getRoundNo() {
        return roundNo;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public UUID getWinnerId() {
        return winnerId;
    }

    public String getCreatedBy() {
        return createdBy;
    }
}
