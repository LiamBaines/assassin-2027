package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import com.assassin.api.player.PlayerRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TargetController {

    private final PlayerRepository players;
    private final AssignmentRepository assignments;

    public TargetController(PlayerRepository players, AssignmentRepository assignments) {
        this.players = players;
        this.assignments = assignments;
    }

    /**
     * The caller's current target in one game. Only the display name is revealed. 404 NO_TARGET if the caller doesn't
     * play in that game or has no active assignment.
     */
    @GetMapping("/api/me/games/{gameId}/target")
    @Transactional(readOnly = true)
    public TargetResponse myTarget(CurrentUser user, @PathVariable UUID gameId) {
        return players.findByGameIdAndAuthUserId(gameId, user.authUserId())
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
