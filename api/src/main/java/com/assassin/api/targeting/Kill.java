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
@Table(name = "kill")
public class Kill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private UUID gameId;

    @Column(name = "assignment_id", nullable = false)
    private long assignmentId;

    @Column(name = "game_round_id", nullable = false)
    private UUID gameRoundId;

    @Column(name = "killer_id", nullable = false)
    private UUID killerId;

    @Column(name = "victim_id", nullable = false)
    private UUID victimId;

    @Column(name = "registered_by", nullable = false)
    private String registeredBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Kill() {
    }

    public Kill(UUID gameId, UUID gameRoundId, long assignmentId, UUID killerId, UUID victimId, String registeredBy, Instant createdAt) {
        this.gameId = gameId;
        this.gameRoundId = gameRoundId;
        this.assignmentId = assignmentId;
        this.killerId = killerId;
        this.victimId = victimId;
        this.registeredBy = registeredBy;
        this.createdAt = createdAt;
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

    public long getAssignmentId() {
        return assignmentId;
    }

    public UUID getKillerId() {
        return killerId;
    }

    public UUID getVictimId() {
        return victimId;
    }

    public String getRegisteredBy() {
        return registeredBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
