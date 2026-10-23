package com.assassin.api.targeting;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class PointService {

    static final int DEATH_POINTS = -5;

    private final PointEventRepository events;
    private final GameRoundRepository rounds;

    public PointService(PointEventRepository events, GameRoundRepository rounds) {
        this.events = events;
        this.rounds = rounds;
    }

    /**
     * Writes an admin bonus row. A kill-linked bonus takes the kill's round; otherwise the round open now, or none.
     * Runs in the caller's transaction, which has already validated the points, reason and kill.
     */
    public PointEvent recordBonus(String gameId, UUID playerId, int points, String reason, Kill kill, String awardedBy) {
        UUID roundId = kill != null ? kill.getGameRoundId()
                : rounds.findFirstByGameIdAndEndedAtIsNull(gameId).map(GameRound::getId).orElse(null);
        return events.saveAndFlush(new PointEvent(gameId, roundId, playerId, points, PointType.BONUS,
                kill != null ? kill.getId() : null, reason, Instant.now(), awardedBy));
    }

    /** Offsets the killer's points for a kill whose method changed. No row when the total is already right. */
    public void adjustKill(Kill kill, int newKillPoints, String adjustedBy) {
        int delta = newKillPoints - events.awardedForKill(kill.getId(), kill.getKillerId());
        if (delta != 0) {
            events.saveAndFlush(new PointEvent(kill.getGameId(), kill.getGameRoundId(), kill.getKillerId(), delta,
                    PointType.ADJUST, kill.getId(), Instant.now(), adjustedBy));
        }
    }

    /** Writes the killer's ({@code killPoints}, from the kill's method) and victim's ledger rows. Runs in the caller's transaction. */
    public void recordKill(Kill kill, int killPoints) {
        events.saveAll(List.of(
                new PointEvent(kill.getGameId(), kill.getGameRoundId(), kill.getKillerId(), killPoints,
                        PointType.KILL, kill.getId(), kill.getCreatedAt(), kill.getRegisteredBy()),
                new PointEvent(kill.getGameId(), kill.getGameRoundId(), kill.getVictimId(), DEATH_POINTS,
                        PointType.DEATH, kill.getId(), kill.getCreatedAt(), kill.getRegisteredBy())));
        events.flush();
    }
}
