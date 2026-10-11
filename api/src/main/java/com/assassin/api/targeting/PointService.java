package com.assassin.api.targeting;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class PointService {

    static final int DEATH_POINTS = -5;

    private final PointEventRepository events;

    public PointService(PointEventRepository events) {
        this.events = events;
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
