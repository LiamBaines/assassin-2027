package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.event.GameEventService;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameService;
import com.assassin.api.game.GameStatus;
import com.assassin.api.game.KillMethod;
import com.assassin.api.game.KillMethodService;
import com.assassin.api.game.KillWordService;
import com.assassin.api.player.Player;
import com.assassin.api.player.PlayerRef;
import com.assassin.api.player.PlayerRepository;
import com.assassin.api.player.PlayerStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KillService {

    private final GameService gameService;
    private final PlayerRepository players;
    private final RingService ringService;
    private final KillRepository kills;
    private final GameRoundRepository rounds;
    private final PointService pointService;
    private final KillMethodService killMethods;
    private final GameEventService events;
    private final KillWordService killWords;

    public KillService(GameService gameService, PlayerRepository players, RingService ringService,
            KillRepository kills, GameRoundRepository rounds, PointService pointService,
            KillMethodService killMethods, GameEventService events, KillWordService killWords) {
        this.gameService = gameService;
        this.players = players;
        this.ringService = ringService;
        this.kills = kills;
        this.rounds = rounds;
        this.pointService = pointService;
        this.killMethods = killMethods;
        this.events = events;
        this.killWords = killWords;
    }

    /**
     * Registers the victim's death. Their assassin's assignment is COMPLETED and the assassin inherits the victim's
     * target (KILL_INHERIT). If only two players were left, the
     * assassin is the last one standing: the open round ends with them as its winner. The game stays ACTIVE.
     */
    @Transactional
    public KillResult register(String gameId, UUID victimId, Long killMethodId, String registeredBy) {
        // Lock the game so this cannot interleave with a shuffle or another kill.
        Game game = gameService.lockForChange(gameId);
        if (game.getStatus() != GameStatus.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "GAME_NOT_STARTED", "The game has not started yet.");
        }
        Player victim = players.findByIdAndGameId(victimId, game.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PLAYER_NOT_FOUND", "No such player in this game."));
        return applyKill(game, victim, killMethods.requireEnabled(game.getId(), killMethodId), registeredBy);
    }

    /** Admin correction of the method a kill was made with; the killer's points are adjusted to the new method's. */
    @Transactional
    public KillMethodChange changeMethod(String gameId, long killId, Long killMethodId, String adjustedBy) {
        Game game = gameService.lockForChange(gameId);
        Kill kill = kills.findById(killId).filter(k -> k.getGameId().equals(game.getId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "KILL_NOT_FOUND", "No such kill in this game."));
        KillMethod method = killMethods.requireEnabled(game.getId(), killMethodId);
        kill.setKillMethodId(method.getId());
        pointService.adjustKill(kill, method.getPoints(), adjustedBy);
        return new KillMethodChange(kill.getId(), KillMethodRef.from(method));
    }

    public record KillMethodRef(long id, String name) {

        public static KillMethodRef from(KillMethod m) {
            return new KillMethodRef(m.getId(), m.getName());
        }
    }

    public record KillMethodChange(long killId, KillMethodRef killMethod) {
    }

    /**
     * Core kill logic. The caller must hold the game lock ({@link GameService#lockForChange}), have checked the
     * game is ACTIVE, and have loaded the victim and the method from this game.
     */
    public KillResult applyKill(Game game, Player victim, KillMethod method, String registeredBy) {
        return applyKill(game, victim, method, registeredBy, null);
    }

    /**
     * As {@link #applyKill(Game, Player, KillMethod, String)}, but when {@code killerId} is given that player is
     * credited with the kill instead of the victim's assassin (a duel the challenger lost). The ring is spliced the
     * same way, so the victim's assassin takes over the victim's target and the killer's own target is unchanged;
     * the result's {@code newTarget} is then null.
     */
    public KillResult applyKill(Game game, Player victim, KillMethod method, String registeredBy, UUID killerId) {
        if (victim.getStatus() != PlayerStatus.ALIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "PLAYER_NOT_ALIVE", "That player is not alive.");
        }
        RingService.Splice splice = ringService
                .splice(victim.getId(), AssignmentStatus.COMPLETED, AssignmentSource.KILL_INHERIT)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "NOT_IN_RING",
                        "That player is not in the ring, so nobody can have killed them."));

        // The splice found the victim in the ring, so a round is open.
        GameRound openRound = rounds.findFirstByGameIdAndEndedAtIsNull(game.getId()).orElseThrow();
        Instant now = Instant.now();
        UUID creditedId = killerId != null ? killerId : splice.assassinId();
        if (method.getName().equalsIgnoreCase(KillMethodService.DEATH_SENTENCE)) {
            killWords.requireLive(game.getId(), splice.assassinId(), openRound.getRoundNo()).markUsed(now);
        }
        victim.setStatus(PlayerStatus.DEAD);
        Kill kill = kills.save(new Kill(game.getId(), openRound.getId(), splice.incomingAssignmentId(), creditedId,
                victim.getId(), method.getId(), registeredBy, now));
        pointService.recordKill(kill, method.getPoints());

        Player killer = players.getReferenceById(creditedId);
        boolean roundEnded = splice.ringCollapsed();
        if (roundEnded) {
            openRound.end(now, killer.getId());
        }
        events.record(game.getId(), "KILL", Map.of("killer", PlayerRef.from(killer),
                "victim", PlayerRef.from(victim), "method", KillMethodRef.from(method)));
        Player newTarget = roundEnded || killerId != null ? null : players.getReferenceById(splice.targetId());
        return new KillResult(kill.getId(), PlayerRef.from(killer), PlayerRef.from(victim),
                newTarget == null ? null : PlayerRef.from(newTarget), roundEnded, KillMethodRef.from(method));
    }

    /** Admin: the game's kills, newest first. */
    @Transactional(readOnly = true)
    public List<KillView> list(String gameId) {
        gameService.find(gameId);
        Map<Long, KillMethod> methods = killMethods.all(gameId).stream()
                .collect(Collectors.toMap(KillMethod::getId, Function.identity()));
        return kills.findByGameIdOrderByIdDesc(gameId).stream()
                .map(k -> new KillView(k.getId(), PlayerRef.from(players.getReferenceById(k.getKillerId())),
                        PlayerRef.from(players.getReferenceById(k.getVictimId())),
                        KillMethodRef.from(methods.get(k.getKillMethodId())), k.getCreatedAt()))
                .toList();
    }

    public record KillResult(long killId, PlayerRef killer, PlayerRef victim, PlayerRef newTarget,
            boolean roundEnded, KillMethodRef killMethod) {
    }

    public record KillView(long killId, PlayerRef killer, PlayerRef victim, KillMethodRef killMethod,
            Instant createdAt) {
    }
}
