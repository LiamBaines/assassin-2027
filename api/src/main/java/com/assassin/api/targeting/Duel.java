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
@Table(name = "duel")
public class Duel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private String gameId;

    @Column(name = "assignment_id", nullable = false)
    private long assignmentId;

    @Column(name = "challenger_id", nullable = false)
    private UUID challengerId;

    @Column(name = "challenged_id", nullable = false)
    private UUID challengedId;

    @Column(name = "kill_method_id", nullable = false)
    private long killMethodId;

    @Column(nullable = false)
    private String activity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DuelStatus status;

    @Column(name = "reported_winner_id")
    private UUID reportedWinnerId;

    @Column(name = "reported_by_id")
    private UUID reportedById;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolved_by")
    private String resolvedBy;

    @Column(name = "kill_id")
    private Long killId;

    protected Duel() {
    }

    public Duel(String gameId, long assignmentId, UUID challengerId, UUID challengedId, long killMethodId,
            String activity, Instant createdAt) {
        this.gameId = gameId;
        this.assignmentId = assignmentId;
        this.challengerId = challengerId;
        this.challengedId = challengedId;
        this.killMethodId = killMethodId;
        this.activity = activity;
        this.status = DuelStatus.PENDING;
        this.createdAt = createdAt;
    }

    public static boolean isOpen(DuelStatus status) {
        return status == DuelStatus.PENDING || status == DuelStatus.ACCEPTED || status == DuelStatus.REPORTED
                || status == DuelStatus.CONTESTED;
    }

    public boolean isOpen() {
        return isOpen(status);
    }

    void accept(Instant at) {
        this.status = DuelStatus.ACCEPTED;
        this.acceptedAt = at;
    }

    void report(UUID winnerId, UUID reportedById) {
        this.status = DuelStatus.REPORTED;
        this.reportedWinnerId = winnerId;
        this.reportedById = reportedById;
    }

    void contest() {
        this.status = DuelStatus.CONTESTED;
    }

    /** Marks the duel COMPLETED; the kill is linked once it exists. */
    void complete(String resolvedBy, Instant at) {
        this.status = DuelStatus.COMPLETED;
        this.resolvedBy = resolvedBy;
        this.resolvedAt = at;
    }

    void linkKill(long killId) {
        this.killId = killId;
    }

    /** Closes the duel as DECLINED, REVOKED or VOIDED. */
    void close(DuelStatus status, String resolvedBy, Instant at) {
        this.status = status;
        this.resolvedBy = resolvedBy;
        this.resolvedAt = at;
    }

    public Long getId() {
        return id;
    }

    public String getGameId() {
        return gameId;
    }

    public long getAssignmentId() {
        return assignmentId;
    }

    public UUID getChallengerId() {
        return challengerId;
    }

    public UUID getChallengedId() {
        return challengedId;
    }

    public long getKillMethodId() {
        return killMethodId;
    }

    public String getActivity() {
        return activity;
    }

    public DuelStatus getStatus() {
        return status;
    }

    public UUID getReportedWinnerId() {
        return reportedWinnerId;
    }

    public UUID getReportedById() {
        return reportedById;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
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
