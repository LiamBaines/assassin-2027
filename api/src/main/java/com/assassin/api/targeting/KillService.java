package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameService;
import com.assassin.api.game.GameStatus;
import com.assassin.api.player.Player;
import com.assassin.api.player.PlayerRef;
import com.assassin.api.player.PlayerRepository;
import com.assassin.api.player.PlayerStatus;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KillService {

    private final GameService gameService;
    private final PlayerRepository players;
    private final RingService ringService;
    private final KillRepository kills;

    public KillService(GameService gameService, PlayerRepository players, RingService ringService,
            KillRepository kills) {
        this.gameService = gameService;
        this.players = players;
        this.ringService = ringService;
        this.kills = kills;
    }

    /**
     * Registers the victim's death. Their assassin's assignment is COMPLETED and the assassin inherits the victim's
     * target (KILL_INHERIT). If only two players were left, the
     * assassin is the last one standing: the game is finished and they win.
     */
    @Transactional
    public KillResult register(UUID gameId, UUID victimId, String registeredBy) {
        // Lock the game so this cannot interleave with a shuffle or another kill.
        Game game = gameService.lockForChange(gameId);
        if (game.getStatus() != GameStatus.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "GAME_NOT_STARTED", "The game has not started yet.");
        }
        Player victim = players.findByIdAndGameId(victimId, game.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PLAYER_NOT_FOUND", "No such player in this game."));
        return applyKill(game, victim, registeredBy);
    }

    /**
     * Core kill logic. The caller must hold the game lock ({@link GameService#lockForChange}), have checked the
     * game is ACTIVE, and have loaded the victim from this game.
     */
    public KillResult applyKill(Game game, Player victim, String registeredBy) {
        if (victim.getStatus() != PlayerStatus.ALIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "PLAYER_NOT_ALIVE", "That player is not alive.");
        }
        RingService.Splice splice = ringService
                .splice(victim.getId(), AssignmentStatus.COMPLETED, AssignmentSource.KILL_INHERIT)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "NOT_IN_RING",
                        "That player is not in the ring, so nobody can have killed them."));

        Instant now = Instant.now();
        victim.setStatus(PlayerStatus.DEAD);
        Kill kill = kills.save(new Kill(game.getId(), splice.incomingAssignmentId(), splice.assassinId(),
                victim.getId(), registeredBy, now));

        Player killer = players.getReferenceById(splice.assassinId());
        boolean gameFinished = splice.ringCollapsed();
        if (gameFinished) {
            game.finish(now);
        }
        Player newTarget = gameFinished ? null : players.getReferenceById(splice.targetId());
        return new KillResult(kill.getId(), PlayerRef.from(killer), PlayerRef.from(victim),
                newTarget == null ? null : PlayerRef.from(newTarget), gameFinished);
    }

    public record KillResult(long killId, PlayerRef killer, PlayerRef victim, PlayerRef newTarget,
            boolean gameFinished) {
    }
}
