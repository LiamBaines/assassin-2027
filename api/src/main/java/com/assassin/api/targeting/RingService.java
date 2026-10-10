package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameService;
import com.assassin.api.game.GameStatus;
import com.assassin.api.player.Player;
import com.assassin.api.player.PlayerRef;
import com.assassin.api.player.PlayerRepository;
import com.assassin.api.player.PlayerStatus;
import com.assassin.api.targeting.RingGenerator.Link;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.random.RandomGenerator;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RingService {

    private static final String INSERT_ASSIGNMENT = """
            insert into game.assignment (game_id, allocation_id, assassin_id, target_id, source, status, created_at)
            values (?, ?, ?, ?, ?, 'ACTIVE', ?)
            """;

    private final GameService gameService;
    private final PlayerRepository players;
    private final GameRoundRepository rounds;
    private final AllocationRepository allocations;
    private final AssignmentRepository assignments;
    private final KillClaimRepository claims;
    private final JdbcTemplate jdbc;
    private final RandomGenerator random;

    public RingService(GameService gameService, PlayerRepository players, GameRoundRepository rounds,
            AllocationRepository allocations, AssignmentRepository assignments, KillClaimRepository claims, JdbcTemplate jdbc, RandomGenerator random) {
        this.gameService = gameService;
        this.players = players;
        this.rounds = rounds;
        this.allocations = allocations;
        this.assignments = assignments;
        this.claims = claims;
        this.jdbc = jdbc;
        this.random = random;
    }

    /**
     * Shuffles every ALIVE player of the game into one ring. The first ring is the INITIAL allocation; every later one
     * is a SHAKEUP that supersedes the active assignments (history is kept). A FINISHED game can't be shuffled.
     *
     * @param gameId the game
     * @param expectedCurrentRoundNo the allocation number the caller last saw, or null if it saw no allocations
     * @param createdBy the admin's email
     */
    @Transactional
    public RingView shuffle(UUID gameId, Integer expectedCurrentRoundNo, String createdBy) {
        // 1. Lock the game row; concurrent shuffles (and admin edits) of this game queue behind this.
        Game game = gameService.lockForChange(gameId);

        // 2. Optimistic check against what the admin saw.
        Integer currentAllocationNo = allocations.findCurrentAllocationNo(game.getId()).orElse(null);
        if (!Objects.equals(expectedCurrentRoundNo, currentAllocationNo)) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_ROUND",
                    "The ring changed since you loaded it (current allocation: " + currentAllocationNo + "). Reload and retry.");
        }

        // 3. Later rings belong to the open round; once a final kill has closed it only a new round can follow.
        boolean initial = currentAllocationNo == null;
        GameRound openRound = initial ? null : rounds.findFirstByGameIdAndEndedAtIsNull(game.getId()).orElseThrow(
                () -> new ApiException(HttpStatus.CONFLICT, "ROUND_ENDED", "The round has ended. Start a new round."));

        // 4. Load ALIVE players.
        List<UUID> alive = players.findByGameIdAndStatusOrderById(game.getId(), PlayerStatus.ALIVE).stream()
                .map(Player::getId)
                .toList();
        if (alive.size() < 2) {
            throw new ApiException(HttpStatus.CONFLICT, "NOT_ENOUGH_PLAYERS",
                    "At least 2 alive players are needed to make a ring.");
        }

        // 5. Supersede the active assignments in one UPDATE, executed before any new ACTIVE row is inserted.
        Instant now = Instant.now();
        assignments.supersedeActive(game.getId(), now);
        claims.voidOpenInGame(game.getId(), now);

        // 6. The first ring creates round 1; later ones belong to the open round. Insert the allocation, flushed so
        // the assignment FKs can reference it.
        GameRound round = initial ? rounds.saveAndFlush(new GameRound(game.getId(), 1, createdBy, now)) : openRound;
        Allocation allocation = allocations.saveAndFlush(new Allocation(game.getId(), round.getId(),
                initial ? 1 : currentAllocationNo + 1, initial ? AllocationReason.INITIAL : AllocationReason.SHAKEUP,
                alive.size(), createdBy, now));

        // 7. Batch-insert the ring.
        insertRing(allocation, alive, now);

        // 8. The first ring starts the game.
        if (game.getStatus() == GameStatus.SETUP) {
            game.start(now);
        }
        return view(game, allocation, round);
    }

    /**
     * Starts a new round: closes the open round (no winner), voids open claims, supersedes the active assignments,
     * sets every player ALIVE (ticked) or REMOVED (not ticked) and allocates a fresh INITIAL ring of the ticked players.
     *
     * @param expectedRoundNo the round number the caller last saw
     * @param playerIds the players taking part
     */
    @Transactional
    public RingView startRound(UUID gameId, Integer expectedRoundNo, Collection<UUID> playerIds, String createdBy) {
        Game game = gameService.lockForChange(gameId);

        GameRound previous = rounds.findFirstByGameIdOrderByRoundNoDesc(game.getId()).orElseThrow(() -> new ApiException(
                HttpStatus.CONFLICT, "NO_ROUND", "No round has started yet. Generate the first ring instead."));
        if (!Objects.equals(expectedRoundNo, previous.getRoundNo())) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_ROUND",
                    "The round changed since you loaded it (current round: " + previous.getRoundNo() + "). Reload and retry.");
        }

        Set<UUID> picked = new HashSet<>(playerIds);
        List<Player> all = players.findByGameIdOrderByJoinedAtAsc(game.getId());
        Set<UUID> known = all.stream().map(Player::getId).collect(Collectors.toSet());
        if (!known.containsAll(picked)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "PLAYER_NOT_FOUND", "A selected player isn't in this game.");
        }
        if (picked.size() < 2) {
            throw new ApiException(HttpStatus.CONFLICT, "NOT_ENOUGH_PLAYERS", "At least 2 players are needed to start a round.");
        }

        Instant now = Instant.now();
        if (previous.getEndedAt() == null) {
            previous.end(now);
        }
        // The closed round must reach the database before the new open one (one-open-round index).
        rounds.flush();
        assignments.supersedeActive(game.getId(), now);
        claims.voidOpenInGame(game.getId(), now);
        for (Player p : all) {
            p.setStatus(picked.contains(p.getId()) ? PlayerStatus.ALIVE : PlayerStatus.REMOVED);
        }

        GameRound round = rounds.saveAndFlush(new GameRound(game.getId(), previous.getRoundNo() + 1, createdBy, now));
        int allocationNo = allocations.findCurrentAllocationNo(game.getId()).orElse(0) + 1;
        Allocation allocation = allocations.saveAndFlush(new Allocation(game.getId(), round.getId(), allocationNo,
                AllocationReason.INITIAL, picked.size(), createdBy, now));
        insertRing(allocation, new ArrayList<>(picked), now);
        return view(game, allocation, round);
    }

    private void insertRing(Allocation allocation, List<UUID> playerIds, Instant now) {
        List<Link<UUID>> ring = RingGenerator.generate(playerIds, random);
        OffsetDateTime createdAt = OffsetDateTime.ofInstant(now, ZoneOffset.UTC);
        jdbc.batchUpdate(INSERT_ASSIGNMENT, ring, ring.size(), (ps, link) -> {
            ps.setObject(1, allocation.getGameId());
            ps.setObject(2, allocation.getId());
            ps.setObject(3, link.assassin());
            ps.setObject(4, link.target());
            ps.setString(5, AssignmentSource.RING.name());
            ps.setObject(6, createdAt);
        });
    }

    /**
     * Takes a player out of the ring: their assignments (A -> X and X -> T) are VOIDED and A inherits T as a SPLICE
     * assignment in the same allocation. In a two-player ring (A == T) nothing is inserted, so A is left without a target.
     * Does nothing if the player has no active assignments.
     *
     * <p>The caller must already hold the lock on the player's game row ({@link GameService#lockForChange(UUID)}), so
     * this serializes with shuffles of that game.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void spliceOut(UUID playerId) {
        splice(playerId, AssignmentStatus.VOIDED, AssignmentSource.SPLICE);
    }

    /**
     * Takes a player out of the ring as {@link #spliceOut} does, but ends their incoming assignment with
     * {@code incomingEnd} and tags the inheriting assignment with {@code source}. Their outgoing assignment is VOIDED.
     * Returns empty if the player lacks an incoming or an outgoing assignment (nothing is inserted). When the
     * assassin and target are the same player nothing is inserted either, and the splice reports them as equal.
     *
     * <p>The caller must already hold the lock on the player's game row.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Optional<Splice> splice(UUID playerId, AssignmentStatus incomingEnd, AssignmentSource source) {
        Optional<Assignment> incoming = assignments.findByTargetIdAndStatus(playerId, AssignmentStatus.ACTIVE);
        Optional<Assignment> outgoing = assignments.findByAssassinIdAndStatus(playerId, AssignmentStatus.ACTIVE);
        Instant now = Instant.now();
        claims.voidOpenForPlayer(playerId, now);
        incoming.ifPresent(a -> a.end(incomingEnd, now));
        outgoing.ifPresent(a -> a.end(AssignmentStatus.VOIDED, now));
        if (incoming.isEmpty() || outgoing.isEmpty()) {
            return Optional.empty();
        }
        Assignment in = incoming.get();
        UUID assassin = in.getAssassinId();
        UUID target = outgoing.get().getTargetId();
        if (!assassin.equals(target)) {
            // The ended rows must reach the database before the new ACTIVE row, or the one-active indexes reject it.
            assignments.flush();
            jdbc.update(INSERT_ASSIGNMENT, in.getGameId(), in.getAllocationId(), assassin, target, source.name(),
                    OffsetDateTime.ofInstant(now, ZoneOffset.UTC));
        }
        return Optional.of(new Splice(in.getId(), assassin, target));
    }

    /** The assignment that was ended on the way in, and the assassin who now hunts {@code target}. */
    public record Splice(long incomingAssignmentId, UUID assassinId, UUID targetId) {

        /** True when only the assassin was left, so no assignment was inserted. */
        public boolean ringCollapsed() {
            return assassinId.equals(targetId);
        }
    }

    /** The game's current allocation with its active assignments in cycle order, or 404 NO_RING before the first. */
    @Transactional(readOnly = true)
    public RingView currentRing(UUID gameId) {
        Game game = gameService.find(gameId);
        Allocation allocation = allocations.findFirstByGameIdOrderByAllocationNoDesc(game.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_RING", "No ring has been generated yet."));
        return view(game, allocation, rounds.findById(allocation.getGameRoundId()).orElseThrow());
    }

    private RingView view(Game game, Allocation allocation, GameRound round) {
        List<Assignment> active = assignments.findByGameIdAndStatusOrderById(game.getId(), AssignmentStatus.ACTIVE);
        Map<UUID, Player> byId = players.findByGameIdOrderByJoinedAtAsc(game.getId()).stream()
                .collect(Collectors.toMap(Player::getId, Function.identity()));
        Map<UUID, Assignment> byAssassin = active.stream()
                .collect(Collectors.toMap(Assignment::getAssassinId, Function.identity()));

        // Walk target -> that target's assignment. Starting from each unvisited row keeps this total if the
        // active assignments ever form more than one cycle.
        List<RingView.RingLink> links = new ArrayList<>(active.size());
        Set<Long> visited = new HashSet<>();
        for (Assignment start : active) {
            Assignment a = start;
            while (a != null && visited.add(a.getId())) {
                links.add(new RingView.RingLink(
                        PlayerRef.from(byId.get(a.getAssassinId())), PlayerRef.from(byId.get(a.getTargetId()))));
                a = byAssassin.get(a.getTargetId());
            }
        }
        return new RingView(allocation.getId(), allocation.getAllocationNo(), round.getRoundNo(), allocation.getReason(),
                links);
    }

    /** All allocations of the game, newest first, each with the number of the round it belongs to. */
    @Transactional(readOnly = true)
    public List<AllocationEntry> history(UUID gameId) {
        Game game = gameService.find(gameId);
        Map<UUID, Integer> roundNos = rounds.findByGameId(game.getId()).stream()
                .collect(Collectors.toMap(GameRound::getId, GameRound::getRoundNo));
        return allocations.findByGameIdOrderByAllocationNoDesc(game.getId()).stream()
                .map(a -> new AllocationEntry(a, roundNos.get(a.getGameRoundId())))
                .toList();
    }

    public record AllocationEntry(Allocation allocation, int gameRoundNo) {
    }

    /** An allocation (roundNo is its allocation number) and its active assignments, in cycle order. */
    public record RingView(UUID roundId, int roundNo, int gameRoundNo, AllocationReason reason, List<RingLink> ring) {

        public record RingLink(PlayerRef assassin, PlayerRef target) {
        }
    }
}
