package com.assassin.api.game;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "game")
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "join_code", nullable = false)
    private String joinCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GameStatus status;

    @Column(name = "signups_open", nullable = false)
    private boolean signupsOpen;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Version
    private long version;

    protected Game() {
    }

    public Game(String name, String joinCode) {
        this.name = name;
        this.joinCode = joinCode;
        this.status = GameStatus.SETUP;
        this.signupsOpen = true;
        this.createdAt = Instant.now();
    }

    public void rename(String name) {
        this.name = name;
    }

    public void changeJoinCode(String joinCode) {
        this.joinCode = joinCode;
    }

    public void setSignupsOpen(boolean signupsOpen) {
        this.signupsOpen = signupsOpen;
    }

    public void start(Instant at) {
        this.status = GameStatus.ACTIVE;
        this.startedAt = at;
    }

    public void finish(Instant at) {
        this.status = GameStatus.FINISHED;
        this.finishedAt = at;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getJoinCode() {
        return joinCode;
    }

    public GameStatus getStatus() {
        return status;
    }

    public boolean isSignupsOpen() {
        return signupsOpen;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public long getVersion() {
        return version;
    }
}
