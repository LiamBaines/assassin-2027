package com.assassin.api.player;

import com.assassin.api.common.ApiException;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameRepository;
import com.assassin.api.game.GameService;
import com.assassin.api.game.GameStatus;
import com.assassin.api.targeting.Assignment;
import com.assassin.api.targeting.AssignmentRepository;
import com.assassin.api.targeting.AssignmentStatus;
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
public class AdminPlayerService {

    private final GameRepository games;
    private final PlayerRepository players;
    private final AssignmentRepository assignments;

    public AdminPlayerService(GameRepository games, PlayerRepository players, AssignmentRepository assignments) {
        this.games = games;
        this.players = players;
        this.assignments = assignments;
    }

    /** Players of the live game in join order, each with their current target (if any). */
    @Transactional(readOnly = true)
    public List<AdminPlayer> list() {
        Game game = games.findLive().orElseThrow(GameService::noLiveGame);
        List<Player> all = players.findByGameIdOrderByJoinedAtAsc(game.getId());
        Map<UUID, Player> byId = all.stream().collect(Collectors.toMap(Player::getId, Function.identity()));
        Map<UUID, UUID> targetOf = assignments.findByGameIdAndStatusOrderById(game.getId(), AssignmentStatus.ACTIVE)
                .stream()
                .collect(Collectors.toMap(Assignment::getAssassinId, Assignment::getTargetId));
        return all.stream()
                .map(p -> AdminPlayer.from(p, targetOf.containsKey(p.getId())
                        ? PlayerRef.from(byId.get(targetOf.get(p.getId())))
                        : null))
                .toList();
    }

    /** Removes or restores a player. Players in the active ring of an ACTIVE game cannot be changed. */
    @Transactional
    public Player updateStatus(UUID playerId, PlayerStatus status) {
        if (status != PlayerStatus.REMOVED && status != PlayerStatus.ALIVE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STATUS", "A player can only be set to REMOVED or ALIVE.");
        }
        // Lock the game so this cannot interleave with a shuffle.
        Game game = games.findLiveForUpdate().orElseThrow(GameService::noLiveGame);
        Player player = players.findByIdAndGameId(playerId, game.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PLAYER_NOT_FOUND", "No such player in the live game."));
        if (game.getStatus() == GameStatus.ACTIVE && assignments.countActiveInvolving(player.getId()) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "IN_ACTIVE_RING",
                    "This player is in the active ring, so they cannot be changed while the game is active.");
        }
        player.setStatus(status);
        return player;
    }

    public record AdminPlayer(UUID id, String displayName, String email, PlayerStatus status, Instant joinedAt,
            PlayerRef currentTarget) {

        static AdminPlayer from(Player p, PlayerRef currentTarget) {
            return new AdminPlayer(p.getId(), p.getDisplayName(), p.getEmail(), p.getStatus(), p.getJoinedAt(),
                    currentTarget);
        }
    }
}
