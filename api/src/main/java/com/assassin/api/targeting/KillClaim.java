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
@Table(name = "kill_claim")
public class KillClaim {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private UUID gameId;

    @Column(name = "assignment_id", nullable = false)
    private long assignmentId;

    @Column(name = "killer_id", nullable = false)
    private UUID killerId;

    @Column(name = "victim_id", nullable = false)
    private UUID victimId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private KillClaimStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolved_by")
    private String resolvedBy;

    @Column(name = "kill_id")
    private Long killId;

    protected KillClaim() {
    }

    public KillClaim(UUID gameId, long assignmentId, UUID killerId, UUID victimId, Instant createdAt) {
        this.gameId = gameId;
        this.assignmentId = assignmentId;
        this.killerId = killerId;
        this.victimId = victimId;
        this.status = KillClaimStatus.PENDING;
        this.createdAt = createdAt;
    }

    public boolean isOpen() {
        return status == KillClaimStatus.PENDING || status == KillClaimStatus.CONTESTED;
    }

    /** Moves the claim to a status without resolving it, for example PENDING to CONTESTED. */
    void setStatus(KillClaimStatus status) {
        this.status = status;
    }

    /** Closes the claim as CONFIRMED, DISMISSED, WITHDRAWN or VOIDED. */
    void resolve(KillClaimStatus status, String resolvedBy, Instant at) {
        this.status = status;
        this.resolvedBy = resolvedBy;
        this.resolvedAt = at;
    }

    void confirm(Long killId, String resolvedBy, Instant at) {
        resolve(KillClaimStatus.CONFIRMED, resolvedBy, at);
        this.killId = killId;
    }

    public Long getId() {
        return id;
    }

    public UUID getGameId() {
        return gameId;
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

    public KillClaimStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public String getResolvedBy() {
        return resolvedBy;
    }

    public Long getKillId() {
        return killId;
    }
}
