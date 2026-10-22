package com.assassin.api.game;

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
@Table(name = "kill_word")
public class KillWord {

    public enum State { UNUSED, ALLOCATED, USED }


    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private String gameId;

    @Column(nullable = false)
    private String text;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private State state;

    @Column(name = "player_id")
    private UUID playerId;

    @Column(name = "round_no")
    private Integer roundNo;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected KillWord() {
    }

    public KillWord(String gameId, String text, Instant createdAt) {
        this.gameId = gameId;
        this.text = text;
        this.state = State.UNUSED;
        this.createdAt = createdAt;
    }

    /** Burns the word for an assassin's round. */
    public void allocate(UUID playerId, int roundNo) {
        this.state = State.ALLOCATED;
        this.playerId = playerId;
        this.roundNo = roundNo;
    }

    /** Marks the word as spoken in a kill. */
    public void markUsed(Instant at) {
        this.state = State.USED;
        this.usedAt = at;
    }

    public Long getId() {
        return id;
    }

    public String getGameId() {
        return gameId;
    }

    public String getText() {
        return text;
    }

    public State getState() {
        return state;
    }

    public UUID getPlayerId() {
        return playerId;
    }

    public Integer getRoundNo() {
        return roundNo;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
