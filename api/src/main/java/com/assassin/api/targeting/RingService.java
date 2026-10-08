package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.game.Game;
import com.assassin.api.game.GameRepository;
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
            insert into game.assignment (game_id, round_id, assassin_id, target_id, source, status, created_at)
            values (?, ?, ?, ?, ?, 'ACTIVE', ?)
            """;

    private final GameRepository games;
    private final PlayerRepository players;
    private final AssignmentRoundRepository rounds;
    private final AssignmentRepository assignments;
    private final JdbcTemplate jdbc;
    private final RandomGenerator random;

    public RingService(GameRepository games, PlayerRepository players, AssignmentRoundRepository rounds,
            AssignmentRepository assignments, JdbcTemplate jdbc, RandomGenerator random) {
        this.games = games;
        this.players = players;
        this.rounds = rounds;
        this.assignments = assignments;
        this.jdbc = jdbc;
        this.random = random;
    }

    /**
     * Shuffles every ALIVE player of the live game into one ring. The first ring is the INITIAL round; every later one
     * is a SHAKEUP that supersedes the active assignments (history is kept).
     *
     * @param expectedCurrentRoundNo the round number the caller last saw, or null if it saw no rounds
     * @param createdBy the admin's email
     */
    @Transactional
    public RingView shuffle(Integer expectedCurrentRoundNo, String createdBy) {
        // 1. Lock the live game row; concurrent shuffles (and admin edits) queue behind this.
        Game game = games.findLiveForUpdate().orElseThrow(this::noShufflableGame);

        // 2. Optimistic check against what the admin saw.
        Integer currentRoundNo = rounds.findCurrentRoundNo(game.getId()).orElse(null);
        if (!Objects.equals(expectedCurrentRoundNo, currentRoundNo)) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_ROUND",
                    "The ring changed since you loaded it (current round: " + currentRoundNo + "). Reload and retry.");
        }

        // 3. Load ALIVE players.
        List<UUID> alive = players.findByGameIdAndStatusOrderById(game.getId(), PlayerStatus.ALIVE).stream()
                .map(Player::getId)
                .toList();
        if (alive.size() < 2) {
            throw new ApiException(HttpStatus.CONFLICT, "NOT_ENOUGH_PLAYERS",
                    "At least 2 alive players are needed to make a ring.");
        }

        // 4. Supersede the active assignments in one UPDATE, executed before any new ACTIVE row is inserted.
        Instant now = Instant.now();
        assignments.supersedeActive(game.getId(), now);

        // 5. Insert the round, flushed so the assignment FKs can reference it.
        boolean initial = currentRoundNo == null;
        AssignmentRound round = rounds.saveAndFlush(new AssignmentRound(game.getId(),
                initial ? 1 : currentRoundNo + 1, initial ? RoundReason.INITIAL : RoundReason.SHAKEUP,
                alive.size(), createdBy, now));

        // 6. Batch-insert the ring.
        List<Link<UUID>> ring = RingGenerator.generate(alive, random);
        OffsetDateTime createdAt = OffsetDateTime.ofInstant(now, ZoneOffset.UTC);
        jdbc.batchUpdate(INSERT_ASSIGNMENT, ring, ring.size(), (ps, link) -> {
            ps.setObject(1, game.getId());
            ps.setObject(2, round.getId());
            ps.setObject(3, link.assassin());
            ps.setObject(4, link.target());
            ps.setString(5, AssignmentSource.RING.name());
            ps.setObject(6, createdAt);
        });

        // 7. The first ring starts the game.
        if (game.getStatus() == GameStatus.SETUP) {
            game.start(now);
        }
        return view(game, round);
    }

    /**
     * Takes a player out of the ring: their assignments (A -> X and X -> T) are VOIDED and A inherits T as a SPLICE
     * assignment in the same round. In a two-player ring (A == T) nothing is inserted, so A is left without a target.
     * Does nothing if the player has no active assignments.
     *
     * <p>The caller must already hold the live game row lock ({@link GameRepository#findLiveForUpdate()}), so this
     * serializes with shuffles.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void spliceOut(UUID playerId) {
        Optional<Assignment> incoming = assignments.findByTargetIdAndStatus(playerId, AssignmentStatus.ACTIVE);
        Optional<Assignment> outgoing = assignments.findByAssassinIdAndStatus(playerId, AssignmentStatus.ACTIVE);
        Instant now = Instant.now();
        incoming.ifPresent(a -> a.end(AssignmentStatus.VOIDED, now));
        outgoing.ifPresent(a -> a.end(AssignmentStatus.VOIDED, now));
        if (incoming.isEmpty() || outgoing.isEmpty()) {
            return;
        }
        Assignment in = incoming.get();
        UUID assassin = in.getAssassinId();
        UUID target = outgoing.get().getTargetId();
        if (assassin.equals(target)) {
            return;
        }
        // The voided rows must reach the database before the new ACTIVE row, or the one-active indexes reject it.
        assignments.flush();
        jdbc.update(INSERT_ASSIGNMENT, in.getGameId(), in.getRoundId(), assassin, target,
                AssignmentSource.SPLICE.name(), OffsetDateTime.ofInstant(now, ZoneOffset.UTC));
    }

    /** The live game's current round with its active assignments in cycle order, or 404 NO_RING before the first. */
    @Transactional(readOnly = true)
    public RingView currentRing() {
        Game game = games.findLive().orElseThrow(GameService::noLiveGame);
        AssignmentRound round = rounds.findFirstByGameIdOrderByRoundNoDesc(game.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_RING", "No ring has been generated yet."));
        return view(game, round);
    }

    private RingView view(Game game, AssignmentRound round) {
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
        return new RingView(round.getId(), round.getRoundNo(), round.getReason(), links);
    }

    /** All rounds of the live game, newest first. */
    @Transactional(readOnly = true)
    public List<AssignmentRound> history() {
        Game game = games.findLive().orElseThrow(GameService::noLiveGame);
        return rounds.findByGameIdOrderByRoundNoDesc(game.getId());
    }

    private ApiException noShufflableGame() {
        return games.count() > 0
                ? new ApiException(HttpStatus.CONFLICT, "GAME_FINISHED", "The game is finished.")
                : GameService.noLiveGame();
    }

    /** A round and its active assignments, in cycle order. */
    public record RingView(UUID roundId, int roundNo, RoundReason reason, List<RingLink> ring) {

        public record RingLink(PlayerRef assassin, PlayerRef target) {
        }
    }
}
