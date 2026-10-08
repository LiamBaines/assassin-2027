package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import com.assassin.api.game.GameRepository;
import com.assassin.api.player.PlayerRepository;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TargetController {

    private final GameRepository games;
    private final PlayerRepository players;
    private final AssignmentRepository assignments;

    public TargetController(GameRepository games, PlayerRepository players, AssignmentRepository assignments) {
        this.games = games;
        this.players = players;
        this.assignments = assignments;
    }

    /** The caller's current target in the live game. Only the display name is revealed. */
    @GetMapping("/api/me/target")
    @Transactional(readOnly = true)
    public TargetResponse myTarget(CurrentUser user) {
        return games.findLive()
                .flatMap(g -> players.findByGameIdAndAuthUserId(g.getId(), user.authUserId()))
                .flatMap(p -> assignments.findByAssassinIdAndStatus(p.getId(), AssignmentStatus.ACTIVE))
                .flatMap(a -> players.findById(a.getTargetId())
                        .map(t -> new TargetResponse(new TargetResponse.Target(t.getDisplayName()), a.getCreatedAt())))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_TARGET", "You have no target right now."));
    }

    public record TargetResponse(Target target, Instant assignedAt) {

        public record Target(String displayName) {
        }
    }
}
