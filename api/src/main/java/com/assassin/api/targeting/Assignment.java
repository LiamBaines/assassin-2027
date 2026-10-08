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

/** Assignments are inserted with JDBC by {@link RingService}; JPA reads them and ends them. */
@Entity
@Table(name = "assignment")
public class Assignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private UUID gameId;

    @Column(name = "round_id", nullable = false)
    private UUID roundId;

    @Column(name = "assassin_id", nullable = false)
    private UUID assassinId;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssignmentSource source;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssignmentStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    protected Assignment() {
    }

    /** Ends this assignment, for example VOIDED when a player leaves the ring. */
    void end(AssignmentStatus status, Instant at) {
        this.status = status;
        this.endedAt = at;
    }

    public Long getId() {
        return id;
    }

    public UUID getGameId() {
        return gameId;
    }

    public UUID getRoundId() {
        return roundId;
    }

    public UUID getAssassinId() {
        return assassinId;
    }

    public UUID getTargetId() {
        return targetId;
    }

    public AssignmentSource getSource() {
        return source;
    }

    public AssignmentStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }
}
