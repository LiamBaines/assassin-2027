package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.event.GameEventService;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameService;
import com.assassin.api.game.GameStatus;
import com.assassin.api.game.KillMethod;
import com.assassin.api.game.KillMethodService;
import com.assassin.api.message.Message;
import com.assassin.api.message.MessageRepository;
import com.assassin.api.player.Player;
import com.assassin.api.player.PlayerRef;
import com.assassin.api.player.PlayerRepository;
import com.assassin.api.player.PlayerStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A duel between an assassin and their target: challenge, accept, decline, revoke. */
@Service
public class DuelService {

    static final int MAX_ACTIVITY_LENGTH = 80;

    private static final List<DuelStatus> OPEN = List.of(DuelStatus.PENDING, DuelStatus.ACCEPTED,
            DuelStatus.REPORTED, DuelStatus.CONTESTED);

    private final GameService gameService;
    private final PlayerRepository players;
    private final AssignmentRepository assignments;
    private final DuelRepository duels;
    private final MessageRepository messages;
    private final KillMethodService killMethods;
    private final KillService killService;
    private final GameEventService events;

    public DuelService(GameService gameService, PlayerRepository players, AssignmentRepository assignments,
            DuelRepository duels, MessageRepository messages, KillMethodService killMethods,
            KillService killService, GameEventService events) {
        this.killService = killService;
        this.events = events;
        this.gameService = gameService;
        this.players = players;
        this.assignments = assignments;
        this.duels = duels;
        this.messages = messages;
        this.killMethods = killMethods;
    }

    public record DuelStatusView(long id, DuelStatus status) {
    }

    /** The caller challenges their ACTIVE target and the challenge lands in the thread as a DUEL message. */
    @Transactional
    public DuelStatusView challenge(String gameId, UUID authUserId, String rawActivity) {
        Player me = requirePlayer(gameId, authUserId);
        Game game = gameService.lockForChange(gameId);
        requireActive(game);
        KillMethod method = killMethods.enabledDuel(game.getId()).orElseThrow(() -> new ApiException(
                HttpStatus.CONFLICT, "DUEL_NOT_AVAILABLE", "Duels are not enabled in this game."));
        String activity = rawActivity == null ? "" : rawActivity.trim();
        if (activity.isEmpty() || activity.length() > MAX_ACTIVITY_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ACTIVITY",
                    "The activity must be 1 to " + MAX_ACTIVITY_LENGTH + " characters.");
        }
        Assignment assignment = assignments.findByAssassinIdAndStatus(me.getId(), AssignmentStatus.ACTIVE)
                .filter(a -> me.getStatus() == PlayerStatus.ALIVE)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "NO_TARGET", "You have no target right now."));
        if (duels.existsByChallengerIdAndStatusIn(me.getId(), OPEN)) {
            throw new ApiException(HttpStatus.CONFLICT, "DUEL_ALREADY_OPEN", "You already have an open duel.");
        }
        Instant now = Instant.now();
        Duel duel = duels.save(new Duel(game.getId(), assignment.getId(), me.getId(), assignment.getTargetId(),
                method.getId(), activity, now));
        messages.save(Message.fromDuel(game.getId(), assignment.getId(), me.getId(), duel.getId(), activity, now));
        return view(duel);
    }

    /** Challenged player only, PENDING only. */
    @Transactional
    public DuelStatusView accept(String gameId, long duelId, UUID authUserId) {
        Player me = requirePlayer(gameId, authUserId);
        gameService.lockForChange(gameId);
        Duel duel = requireDuel(gameId, duelId);
        requireRole(duel.getChallengedId().equals(me.getId()));
        requirePending(duel);
        duel.accept(Instant.now());
        return view(duel);
    }

    /** Challenged player only, PENDING only. */
    @Transactional
    public DuelStatusView decline(String gameId, long duelId, UUID authUserId) {
        Player me = requirePlayer(gameId, authUserId);
        gameService.lockForChange(gameId);
        Duel duel = requireDuel(gameId, duelId);
        requireRole(duel.getChallengedId().equals(me.getId()));
        requirePending(duel);
        duel.close(DuelStatus.DECLINED, null, Instant.now());
        return view(duel);
    }

    /** Challenger only, PENDING only. */
    @Transactional
    public DuelStatusView revoke(String gameId, long duelId, UUID authUserId) {
        Player me = requirePlayer(gameId, authUserId);
        gameService.lockForChange(gameId);
        Duel duel = requireDuel(gameId, duelId);
        requireRole(duel.getChallengerId().equals(me.getId()));
        requirePending(duel);
        duel.close(DuelStatus.REVOKED, null, Instant.now());
        return view(duel);
    }

    /** A participant's report of who won. ACCEPTED only; the other participant then confirms or contests. */
    @Transactional
    public DuelStatusView report(String gameId, long duelId, UUID authUserId, Winner winner) {
        Player me = requirePlayer(gameId, authUserId);
        gameService.lockForChange(gameId);
        Duel duel = requireDuel(gameId, duelId);
        requireRole(isParticipant(duel, me));
        requireStatus(duel, DuelStatus.ACCEPTED, "That duel is not awaiting a result.");
        UUID other = otherParticipant(duel, me);
        duel.report(winner == Winner.ME ? me.getId() : other, me.getId());
        return view(duel);
    }

    /** The participant who did not report agrees with the report; the duel is resolved. */
    @Transactional
    public DuelResult confirm(String gameId, long duelId, UUID authUserId) {
        Player me = requirePlayer(gameId, authUserId);
        Game game = gameService.lockForChange(gameId);
        Duel duel = requireDuel(gameId, duelId);
        requireRole(isParticipant(duel, me) && !me.getId().equals(duel.getReportedById()));
        requireStatus(duel, DuelStatus.REPORTED, "That duel has no result to confirm.");
        return resolve(game, duel, duel.getReportedWinnerId(), me.getEmail());
    }

    /** The participant who did not report disputes the report; the duel stays open for the admin. */
    @Transactional
    public DuelStatusView contest(String gameId, long duelId, UUID authUserId) {
        Player me = requirePlayer(gameId, authUserId);
        gameService.lockForChange(gameId);
        Duel duel = requireDuel(gameId, duelId);
        requireRole(isParticipant(duel, me) && !me.getId().equals(duel.getReportedById()));
        requireStatus(duel, DuelStatus.REPORTED, "That duel has no result to contest.");
        duel.contest();
        return view(duel);
    }

    /** Admin: open duels of the game, oldest first. */
    @Transactional(readOnly = true)
    public List<AdminDuel> listOpen(String gameId) {
        gameService.find(gameId);
        return duels.findByGameIdAndStatusInOrderByCreatedAtAsc(gameId, OPEN).stream()
                .map(d -> new AdminDuel(d.getId(), d.getStatus(), d.getActivity(),
                        PlayerRef.from(players.getReferenceById(d.getChallengerId())),
                        PlayerRef.from(players.getReferenceById(d.getChallengedId())),
                        d.getReportedWinnerId() == null ? null : PlayerRef.from(players.getReferenceById(d.getReportedWinnerId())),
                        d.getCreatedAt()))
                .toList();
    }

    /** Admin: picks the winner of any open duel. */
    @Transactional
    public DuelResult adminResolve(String gameId, long duelId, UUID winnerId, String adminEmail) {
        Game game = gameService.lockForChange(gameId);
        Duel duel = requireDuel(gameId, duelId);
        if (!duel.isOpen()) {
            throw new ApiException(HttpStatus.CONFLICT, "DUEL_NOT_OPEN", "That duel is already resolved.");
        }
        if (!duel.getChallengerId().equals(winnerId) && !duel.getChallengedId().equals(winnerId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WINNER", "The winner must be one of the duellists.");
        }
        return resolve(game, duel, winnerId, adminEmail);
    }

    /**
     * Records the result as a kill for the winner. The challenger winning is an ordinary kill of the challenged. The
     * challenged winning kills the challenger, credited to the winner; the challenger's assassin takes over the
     * winner as a target and is told in their new thread. The caller holds the game lock.
     */
    private DuelResult resolve(Game game, Duel duel, UUID winnerId, String resolvedBy) {
        requireActive(game);
        boolean stale = assignments.findById(duel.getAssignmentId())
                .map(a -> a.getStatus() != AssignmentStatus.ACTIVE).orElse(true);
        if (stale) {
            throw new ApiException(HttpStatus.CONFLICT, "DUEL_STALE", "That duel is out of date.");
        }
        KillMethod method = killMethods.require(game.getId(), duel.getKillMethodId());
        boolean challengerWon = winnerId.equals(duel.getChallengerId());
        // Completed before the kill so the splice's handling of open duels leaves this one alone.
        Instant now = Instant.now();
        duel.complete(resolvedBy, now);
        KillService.KillResult kill;
        if (challengerWon) {
            kill = killService.applyKill(game, players.getReferenceById(duel.getChallengedId()), method, resolvedBy);
        } else {
            kill = killService.applyKill(game, players.getReferenceById(duel.getChallengerId()), method, resolvedBy,
                    duel.getChallengedId());
            if (!kill.roundEnded()) {
                notifyNewTarget(game.getId(), kill.killer().id(), now);
            }
        }
        duel.linkKill(kill.killId());
        events.record(game.getId(), "DUEL_RESOLVED", Map.of("winner", kill.killer(), "loser", kill.victim(),
                "activity", duel.getActivity()));
        return new DuelResult(duel.getId(), DuelStatus.COMPLETED, kill.killId(), kill.roundEnded());
    }

    /** Tells the challenger's assassin, whose assignment now points at the winner, that their target changed. */
    private void notifyNewTarget(String gameId, UUID winnerId, Instant now) {
        assignments.findByTargetIdAndStatus(winnerId, AssignmentStatus.ACTIVE)
                .ifPresent(a -> messages.save(Message.system(gameId, a.getId(), "Your target has changed.", now)));
    }

    private static boolean isParticipant(Duel duel, Player p) {
        return duel.getChallengerId().equals(p.getId()) || duel.getChallengedId().equals(p.getId());
    }

    private static UUID otherParticipant(Duel duel, Player p) {
        return duel.getChallengerId().equals(p.getId()) ? duel.getChallengedId() : duel.getChallengerId();
    }

    private static void requireStatus(Duel duel, DuelStatus status, String message) {
        if (duel.getStatus() != status) {
            throw new ApiException(HttpStatus.CONFLICT, "DUEL_NOT_OPEN", message);
        }
    }

    /** Who the reporter says won. */
    public enum Winner {
        ME, OTHER
    }

    public record AdminDuel(long id, DuelStatus status, String activity, PlayerRef challenger, PlayerRef challenged,
            PlayerRef reportedWinner, Instant createdAt) {
    }

    public record DuelResult(long id, DuelStatus status, long killId, boolean roundEnded) {
    }

    private static DuelStatusView view(Duel duel) {
        return new DuelStatusView(duel.getId(), duel.getStatus());
    }

    private Player requirePlayer(String gameId, UUID authUserId) {
        return players.findByGameIdAndAuthUserId(gameId, authUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_IN_GAME", "You are not in this game."));
    }

    private Duel requireDuel(String gameId, long duelId) {
        return duels.findByIdAndGameId(duelId, gameId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "DUEL_NOT_FOUND", "No such duel."));
    }

    private static void requireRole(boolean allowed) {
        if (!allowed) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_DUEL_PARTICIPANT", "You can't do that on this duel.");
        }
    }

    private static void requirePending(Duel duel) {
        if (duel.getStatus() != DuelStatus.PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "DUEL_NOT_OPEN", "That duel is not awaiting an answer.");
        }
    }

    private static void requireActive(Game game) {
        if (game.getStatus() != GameStatus.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "GAME_NOT_STARTED", "The game has not started yet.");
        }
    }
}
