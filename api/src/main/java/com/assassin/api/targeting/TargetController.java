package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import com.assassin.api.game.KillMethodService;
import com.assassin.api.game.KillWord;
import com.assassin.api.game.KillWordService;
import com.assassin.api.player.Player;
import com.assassin.api.player.PlayerRepository;
import java.time.Instant;
import java.util.List;
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
    private final RoundHistoryService history;
    private final GameRoundRepository rounds;
    private final KillMethodService killMethods;
    private final KillWordService killWords;

    public TargetController(PlayerRepository players, AssignmentRepository assignments, RoundHistoryService history,
                            GameRoundRepository rounds, KillMethodService killMethods, KillWordService killWords) {
        this.players = players;
        this.assignments = assignments;
        this.history = history;
        this.rounds = rounds;
        this.killMethods = killMethods;
        this.killWords = killWords;
    }

    /** The game's closed rounds with the caller's outcome in each. 404 NOT_IN_GAME if the caller doesn't play in it. */
    @GetMapping("/api/me/games/{gameId}/rounds")
    @Transactional(readOnly = true)
    public List<RoundHistoryService.PlayerRound> myRounds(CurrentUser user, @PathVariable String gameId) {
        Player me = players.findByGameIdAndAuthUserId(gameId, user.authUserId()).orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_IN_GAME", "You are not in this game."));
        return history.playerRounds(gameId, me.getId());
    }

    /**
     * The caller's current target in one game. Only the display name is revealed. 404 NO_TARGET if the caller doesn't
     * play in that game or has no active assignment.
     */
    @GetMapping("/api/me/games/{gameId}/target")
    @Transactional(readOnly = true)
    public TargetResponse myTarget(CurrentUser user, @PathVariable String gameId) {
        return players.findByGameIdAndAuthUserId(gameId, user.authUserId())
                .flatMap(p -> assignments.findByAssassinIdAndStatus(p.getId(), AssignmentStatus.ACTIVE))
                .flatMap(a -> players.findById(a.getTargetId())
                        .map(t -> new TargetResponse(new TargetResponse.Target(t.getDisplayName()), a.getCreatedAt(),
                                killWordOf(gameId, a.getAssassinId()))))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_TARGET", "You have no target right now."));
    }

    /** The assassin's word for the open round; null when Death Sentence is off or none was allocated. */
    private TargetResponse.KillWordView killWordOf(String gameId, UUID assassinId) {
        if (!killMethods.deathSentenceEnabled(gameId)) {
            return null;
        }
        return rounds.findFirstByGameIdAndEndedAtIsNull(gameId)
                .flatMap(r -> killWords.find(gameId, assassinId, r.getRoundNo()))
                .map(w -> w.getState() == KillWord.State.USED
                        ? new TargetResponse.KillWordView(true, null)
                        : new TargetResponse.KillWordView(false, w.getText()))
                .orElse(null);
    }

    /** @param killWord null when the player has no kill word this round */
    public record TargetResponse(Target target, Instant assignedAt, KillWordView killWord) {

        /** {@code text} is null once the word has been used. */
        public record KillWordView(boolean used, String text) {
        }

        public record Target(String displayName) {
        }
    }
}
