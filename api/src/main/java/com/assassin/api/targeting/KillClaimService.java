package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameService;
import com.assassin.api.game.GameStatus;
import com.assassin.api.player.Player;
import com.assassin.api.player.PlayerRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KillClaimService {

    private static final List<KillClaimStatus> OPEN = List.of(KillClaimStatus.PENDING, KillClaimStatus.CONTESTED);

    private final GameService gameService;
    private final PlayerRepository players;
    private final AssignmentRepository assignments;
    private final KillClaimRepository claims;
    private final KillService killService;

    public KillClaimService(GameService gameService, PlayerRepository players, AssignmentRepository assignments,
            KillClaimRepository claims, KillService killService) {
        this.gameService = gameService;
        this.players = players;
        this.assignments = assignments;
        this.claims = claims;
        this.killService = killService;
    }

    /** The caller claims a kill on their ACTIVE target. */
    @Transactional
    public ClaimStatus file(UUID gameId, UUID authUserId) {
        Player killer = requirePlayer(gameId, authUserId);
        Game game = gameService.lockForChange(gameId);
        requireActive(game);
        Assignment assignment = assignments.findByAssassinIdAndStatus(killer.getId(), AssignmentStatus.ACTIVE)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "NO_TARGET", "You have no target right now."));
        if (claims.existsByVictimIdAndStatusIn(assignment.getTargetId(), OPEN)) {
            throw new ApiException(HttpStatus.CONFLICT, "CLAIM_ALREADY_OPEN",
                    "There is already an open kill claim against your target.");
        }
        KillClaim claim = claims.save(new KillClaim(game.getId(), assignment.getId(), killer.getId(),
                assignment.getTargetId(), Instant.now()));
        return new ClaimStatus(claim.getId(), claim.getStatus());
    }

    /** Killer only, open claims only. */
    @Transactional
    public ClaimStatus withdraw(UUID gameId, long claimId, UUID authUserId) {
        Player caller = requirePlayer(gameId, authUserId);
        gameService.lockForChange(gameId);
        KillClaim claim = requireClaim(gameId, claimId);
        requireRole(claim.getKillerId().equals(caller.getId()));
        requireOpen(claim);
        claim.resolve(KillClaimStatus.WITHDRAWN, null, Instant.now());
        return new ClaimStatus(claim.getId(), claim.getStatus());
    }

    /** Victim only, PENDING only. Confirms the kill. */
    @Transactional
    public AcceptResult accept(UUID gameId, long claimId, UUID authUserId) {
        Player caller = requirePlayer(gameId, authUserId);
        Game game = gameService.lockForChange(gameId);
        KillClaim claim = requireClaim(gameId, claimId);
        requireRole(claim.getVictimId().equals(caller.getId()));
        requirePending(claim);
        KillService.KillResult result = confirm(game, claim, caller.getEmail());
        return new AcceptResult(KillClaimStatus.CONFIRMED, result.gameFinished());
    }

    /** Victim only, PENDING only. The claim stays open for the admin. */
    @Transactional
    public ClaimStatus contest(UUID gameId, long claimId, UUID authUserId) {
        Player caller = requirePlayer(gameId, authUserId);
        gameService.lockForChange(gameId);
        KillClaim claim = requireClaim(gameId, claimId);
        requireRole(claim.getVictimId().equals(caller.getId()));
        requirePending(claim);
        claim.setStatus(KillClaimStatus.CONTESTED);
        return new ClaimStatus(claim.getId(), claim.getStatus());
    }

    /**
     * What the caller sees on their game page. Outgoing is their latest claim while it is open, or after the admin
     * dismissed it as long as they still hunt the same target. Incoming is the PENDING claim against them.
     */
    @Transactional(readOnly = true)
    public MyClaims mine(UUID gameId, UUID authUserId) {
        Player me = requirePlayer(gameId, authUserId);
        ClaimStatus outgoing = claims.findFirstByKillerIdOrderByIdDesc(me.getId())
                .filter(c -> c.isOpen() || (c.getStatus() == KillClaimStatus.DISMISSED
                        && assignments.findById(c.getAssignmentId())
                                .map(a -> a.getStatus() == AssignmentStatus.ACTIVE).orElse(false)))
                .map(c -> new ClaimStatus(c.getId(), c.getStatus()))
                .orElse(null);
        Incoming incoming = claims.findFirstByVictimIdAndStatus(me.getId(), KillClaimStatus.PENDING)
                .map(c -> new Incoming(c.getId(), players.getReferenceById(c.getKillerId()).getDisplayName()))
                .orElse(null);
        return new MyClaims(outgoing, incoming);
    }

    /** Admin: open claims of the game, oldest first. */
    @Transactional(readOnly = true)
    public List<AdminClaim> listOpen(UUID gameId) {
        gameService.find(gameId);
        return claims.findByGameIdAndStatusInOrderByCreatedAtAsc(gameId, OPEN).stream()
                .map(c -> new AdminClaim(c.getId(), c.getStatus(),
                        players.getReferenceById(c.getKillerId()).getDisplayName(),
                        players.getReferenceById(c.getVictimId()).getDisplayName(), c.getCreatedAt()))
                .toList();
    }

    /** Admin: confirms an open claim, whether or not the victim responded. */
    @Transactional
    public KillService.KillResult adminConfirm(UUID gameId, long claimId, String adminEmail) {
        Game game = gameService.lockForChange(gameId);
        KillClaim claim = requireClaim(gameId, claimId);
        requireOpen(claim);
        return confirm(game, claim, adminEmail);
    }

    /** Admin: dismisses an open claim. */
    @Transactional
    public ClaimStatus adminDismiss(UUID gameId, long claimId, String adminEmail) {
        gameService.lockForChange(gameId);
        KillClaim claim = requireClaim(gameId, claimId);
        requireOpen(claim);
        claim.resolve(KillClaimStatus.DISMISSED, adminEmail, Instant.now());
        return new ClaimStatus(claim.getId(), claim.getStatus());
    }

    /**
     * Confirms an open claim: re-checks its assignment is still ACTIVE, then applies the kill. The caller must hold
     * the game lock. The open-claim void inside the splice also hits this claim, but the status set here is written
     * last when the session flushes.
     */
    KillService.KillResult confirm(Game game, KillClaim claim, String resolvedBy) {
        requireActive(game);
        boolean stale = assignments.findById(claim.getAssignmentId())
                .map(a -> a.getStatus() != AssignmentStatus.ACTIVE)
                .orElse(true);
        if (stale) {
            throw new ApiException(HttpStatus.CONFLICT, "CLAIM_STALE", "That claim is out of date.");
        }
        Player victim = players.getReferenceById(claim.getVictimId());
        KillService.KillResult result = killService.applyKill(game, victim, resolvedBy);
        claim.confirm(result.killId(), resolvedBy, Instant.now());
        return result;
    }

    private Player requirePlayer(UUID gameId, UUID authUserId) {
        return players.findByGameIdAndAuthUserId(gameId, authUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_IN_GAME", "You are not in this game."));
    }

    private KillClaim requireClaim(UUID gameId, long claimId) {
        return claims.findByIdAndGameId(claimId, gameId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CLAIM_NOT_FOUND", "No such kill claim."));
    }

    private static void requireRole(boolean allowed) {
        if (!allowed) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_CLAIM_PARTICIPANT",
                    "You can't do that on this kill claim.");
        }
    }

    private static void requireOpen(KillClaim claim) {
        if (!claim.isOpen()) {
            throw new ApiException(HttpStatus.CONFLICT, "CLAIM_NOT_OPEN", "That kill claim is already resolved.");
        }
    }

    private static void requirePending(KillClaim claim) {
        if (claim.getStatus() != KillClaimStatus.PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "CLAIM_NOT_OPEN", "That kill claim is not awaiting an answer.");
        }
    }

    private static void requireActive(Game game) {
        if (game.getStatus() != GameStatus.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "GAME_NOT_STARTED", "The game has not started yet.");
        }
    }

    public record ClaimStatus(long id, KillClaimStatus status) {
    }

    public record AcceptResult(KillClaimStatus status, boolean gameFinished) {
    }

    public record Incoming(long id, String killerName) {
    }

    public record AdminClaim(long id, KillClaimStatus status, String killerName, String victimName,
            Instant createdAt) {
    }

    public record MyClaims(ClaimStatus outgoing, Incoming incoming) {
    }
}
