package com.assassin.api.targeting;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class PointService {

    static final int DEATH_POINTS = -5;

    private final PointEventRepository events;

    public PointService(PointEventRepository events) {
        this.events = events;
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
