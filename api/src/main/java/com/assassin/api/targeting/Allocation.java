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
@Table(name = "allocation")
public class Allocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "game_id", nullable = false)
    private UUID gameId;

    @Column(name = "game_round_id", nullable = false)
    private UUID gameRoundId;

    @Column(name = "allocation_no", nullable = false)
    private int allocationNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AllocationReason reason;

    @Column(name = "player_count", nullable = false)
    private int playerCount;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Allocation() {
    }

    public Allocation(UUID gameId, UUID gameRoundId, int allocationNo, AllocationReason reason, int playerCount, String createdBy,
            Instant createdAt) {
        this.gameId = gameId;
        this.gameRoundId = gameRoundId;
        this.allocationNo = allocationNo;
        this.reason = reason;
        this.playerCount = playerCount;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getGameId() {
        return gameId;
    }

    public UUID getGameRoundId() {
        return gameRoundId;
    }

    public int getAllocationNo() {
        return allocationNo;
    }

    public AllocationReason getReason() {
        return reason;
    }

    public int getPlayerCount() {
        return playerCount;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
