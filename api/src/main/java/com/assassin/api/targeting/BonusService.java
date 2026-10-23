package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.event.GameEventService;
import com.assassin.api.game.GameService;
import com.assassin.api.message.Message;
import com.assassin.api.message.MessageRepository;
import com.assassin.api.player.Player;
import com.assassin.api.player.PlayerRef;
import com.assassin.api.player.PlayerRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Admin bonus points: a BONUS ledger row, a public game-log event and a message in the player's Admin thread. */
@Service
public class BonusService {

    static final int MAX_POINTS = 100;
    static final int MAX_REASON = 140;
    static final int LIST_LIMIT = 200;

    private final GameService games;
    private final PlayerRepository players;
    private final KillRepository kills;
    private final GameRoundRepository rounds;
    private final PointService pointService;
    private final PointEventRepository pointEvents;
    private final MessageRepository messages;
    private final GameEventService events;

    public BonusService(GameService games, PlayerRepository players, KillRepository kills, GameRoundRepository rounds, PointService pointService,
            PointEventRepository pointEvents, MessageRepository messages, GameEventService events) {
        this.games = games;
        this.players = players;
        this.kills = kills;
        this.rounds = rounds;
        this.pointService = pointService;
        this.pointEvents = pointEvents;
        this.messages = messages;
        this.events = events;
    }

    public record KillRef(long id, PlayerRef killer, PlayerRef victim) {
    }

    public record BonusView(long id, PlayerRef player, int points, String reason, Integer roundNo, KillRef kill,
            Instant createdAt) {
    }

    @Transactional
    public BonusView award(String gameId, UUID playerId, int points, String rawReason, Long killId, String awardedBy) {
        // Lock the game so a bonus cannot interleave with a round change and pick up the wrong round.
        games.lockForChange(gameId);
        if (points == 0 || Math.abs(points) > MAX_POINTS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BONUS_POINTS",
                    "Bonus points must be a non-zero whole number from -" + MAX_POINTS + " to " + MAX_POINTS + ".");
        }
        String reason = rawReason == null ? "" : rawReason.trim();
        if (reason.isEmpty() || reason.length() > MAX_REASON) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "REASON_REQUIRED",
                    "Give a reason of 1 to " + MAX_REASON + " characters.");
        }
        Player player = players.findByIdAndGameId(playerId, gameId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PLAYER_NOT_FOUND", "No such player in this game."));
        Kill kill = null;
        if (killId != null) {
            kill = kills.findById(killId).filter(k -> k.getGameId().equals(gameId))
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "KILL_NOT_FOUND", "No such kill in this game."));
            if (!kill.getKillerId().equals(playerId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "KILL_PLAYER_MISMATCH",
                        "A bonus linked to a kill goes to that kill's killer.");
            }
        }
        PointEvent bonus = pointService.recordBonus(gameId, playerId, points, reason, kill, awardedBy);

        Map<String, Object> payload = new HashMap<>();
        payload.put("player", PlayerRef.from(player));
        payload.put("points", points);
        payload.put("reason", reason);
        if (kill != null) {
            payload.put("kill", killRef(kill));
        }
        events.record(gameId, "BONUS_AWARDED", payload);

        String text = points > 0
                ? "You were awarded +" + points + " bonus points: " + reason + "."
                : "You lost " + -points + " bonus points: " + reason + ".";
        messages.saveAndFlush(Message.fromAdmin(gameId, playerId, text, bonus.getCreatedAt()));
        return view(bonus, PlayerRef.from(player), kill == null ? null : killRef(kill), roundNo(bonus));
    }

    /** The game's bonuses, newest first, capped at the latest 200. */
    @Transactional(readOnly = true)
    public List<BonusView> list(String gameId) {
        games.find(gameId);
        return pointEvents.findByGameIdAndTypeOrderByIdDesc(gameId, PointType.BONUS,
                PageRequest.of(0, LIST_LIMIT)).stream()
                .map(e -> view(e, PlayerRef.from(players.getReferenceById(e.getPlayerId())),
                        e.getKillId() == null ? null : killRef(kills.getReferenceById(e.getKillId())), roundNo(e)))
                .toList();
    }

    private KillRef killRef(Kill k) {
        return new KillRef(k.getId(), PlayerRef.from(players.getReferenceById(k.getKillerId())),
                PlayerRef.from(players.getReferenceById(k.getVictimId())));
    }

    private Integer roundNo(PointEvent e) {
        return e.getGameRoundId() == null ? null : rounds.getReferenceById(e.getGameRoundId()).getRoundNo();
    }

    private BonusView view(PointEvent e, PlayerRef player, KillRef kill, Integer roundNo) {
        return new BonusView(e.getId(), player, e.getPoints(), e.getReason(), roundNo, kill, e.getCreatedAt());
    }
}
