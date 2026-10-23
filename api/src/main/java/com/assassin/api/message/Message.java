package com.assassin.api.message;

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
@Table(name = "message")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private String gameId;

    @Column(name = "assignment_id")
    private Long assignmentId;

    @Column(name = "sender_id")
    private UUID senderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MessageKind kind = MessageKind.PLAYER;

    @Column(name = "recipient_id")
    private UUID recipientId;

    @Column(name = "duel_id")
    private Long duelId;

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

    public Message(String gameId, Long assignmentId, UUID senderId, String body, Instant createdAt) {
        this.gameId = gameId;
        this.assignmentId = assignmentId;
        this.senderId = senderId;
        this.body = body;
        this.createdAt = createdAt;
    }

    /** A system message to one player, shown in their read-only Admin thread. */
    public static Message fromAdmin(String gameId, UUID recipientId, String body, Instant createdAt) {
        Message m = new Message(gameId, null, null, body, createdAt);
        m.kind = MessageKind.ADMIN;
        m.recipientId = recipientId;
        return m;
    }

    /** The challenge card of a duel, sent by the challenger into the assignment's thread; the body is the activity. */
    public static Message fromDuel(String gameId, long assignmentId, UUID challengerId, long duelId, String activity,
            Instant createdAt) {
        Message m = new Message(gameId, assignmentId, challengerId, activity, createdAt);
        m.kind = MessageKind.DUEL;
        m.duelId = duelId;
        return m;
    }

    /** A notice to the assassin of an assignment, shown in its thread with no sender. */
    public static Message system(String gameId, long assignmentId, String body, Instant createdAt) {
        Message m = new Message(gameId, assignmentId, null, body, createdAt);
        m.kind = MessageKind.SYSTEM;
        return m;
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

    public Long getAssignmentId() {
        return assignmentId;
    }

    public MessageKind getKind() {
        return kind;
    }

    public UUID getRecipientId() {
        return recipientId;
    }

    public Long getDuelId() {
        return duelId;
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
