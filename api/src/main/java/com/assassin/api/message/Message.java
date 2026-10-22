package com.assassin.api.message;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "message")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private String gameId;

    @Column(name = "assignment_id", nullable = false)
    private long assignmentId;

    @Column(name = "sender_id", nullable = false)
    private UUID senderId;

    @Column(nullable = false)
    private String body;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Message() {
    }

    public Message(String gameId, long assignmentId, UUID senderId, String body, Instant createdAt) {
        this.gameId = gameId;
        this.assignmentId = assignmentId;
        this.senderId = senderId;
        this.body = body;
        this.createdAt = createdAt;
    }

    public void markDeleted(Instant at) {
        this.deletedAt = at;
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

    public UUID getSenderId() {
        return senderId;
    }

    public String getBody() {
        return body;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
