package com.assassin.api.game;

import com.assassin.api.common.ApiException;
import com.assassin.api.player.PlayerRepository;
import com.assassin.api.player.PlayerRepository.GamePlayerCount;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GameService {

    /** The partial unique index that keeps join codes unique among games that are not FINISHED. */
    static final String JOIN_CODE_INDEX = "game_join_code_live_uq";

    /** The primary key, which is the slug; a lost race on it means two games picked the same slug. */
    static final String GAME_PKEY = "game_pkey";

    private final GameRepository games;
    private final PlayerRepository players;
    private final KillMethodRepository killMethods;

    public GameService(GameRepository games, PlayerRepository players, KillMethodRepository killMethods) {
        this.games = games;
        this.players = players;
        this.killMethods = killMethods;
    }

    public static ApiException gameNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "GAME_NOT_FOUND", "There is no such game.");
    }

    public static ApiException gameFinished() {
        return new ApiException(HttpStatus.CONFLICT, "GAME_FINISHED", "The game is finished, so it can't be changed.");
    }

    /** A game with its player count (all statuses), as admins see it. */
    public record GameWithCount(Game game, long playerCount) {
    }

    /** Every game, including FINISHED ones, newest first. */
    @Transactional(readOnly = true)
    public List<GameWithCount> list() {
        Map<String, Long> counts = players.countPerGame().stream()
                .collect(Collectors.toMap(GamePlayerCount::getGameId, GamePlayerCount::getCount));
        return games.findAllByOrderByCreatedAtDesc().stream()
                .map(g -> new GameWithCount(g, counts.getOrDefault(g.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public GameWithCount get(String gameId) {
        Game game = find(gameId);
        return new GameWithCount(game, players.countByGameId(game.getId()));
    }

    /** The game, or 404 GAME_NOT_FOUND. */
    @Transactional(readOnly = true)
    public Game find(String gameId) {
        return games.findById(gameId).orElseThrow(GameService::gameNotFound);
    }

    /**
     * Locks the game row ({@code SELECT ... FOR UPDATE}) for a change, so changes to one game queue behind each other.
     * 404 GAME_NOT_FOUND if it doesn't exist, 409 GAME_FINISHED if it is finished.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Game lockForChange(String gameId) {
        Game game = games.findByIdForUpdate(gameId).orElseThrow(GameService::gameNotFound);
        if (game.getStatus() == GameStatus.FINISHED) {
            throw gameFinished();
        }
        return game;
    }

    @Transactional
    public GameWithCount create(String name, String joinCode) {
        if (games.findLiveByJoinCode(joinCode).isPresent()) {
            throw joinCodeTaken();
        }
        try {
            Game game = games.saveAndFlush(new Game(freeSlug(name), name, joinCode));
            Instant now = Instant.now();
            killMethods.saveAll(KillMethodDefaults.STANDARD.stream()
                    .map(m -> new KillMethod(game.getId(), m.name(), m.points(), now))
                    .toList());
            return new GameWithCount(game, 0);
        } catch (DataIntegrityViolationException e) {
            throw translateJoinCodeRace(e);
        }
    }

    /** The name's slug, or the first {@code slug-2}, {@code slug-3}, ... that no game uses yet. */
    private String freeSlug(String name) {
        String base = GameSlugs.base(name);
        String slug = base;
        for (int n = 2; games.existsById(slug); n++) {
            slug = GameSlugs.withSuffix(base, n);
        }
        return slug;
    }

    /** Applies the non-null fields. {@code status} may only be FINISHED. A FINISHED game can't be changed. */
    @Transactional
    public GameWithCount update(String gameId, Boolean signupsOpen, GameStatus status) {
        Game game = lockForChange(gameId);
        if (status != null && status != GameStatus.FINISHED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STATUS", "A game's status can only be set to FINISHED.");
        }
        if (signupsOpen != null) {
            game.setSignupsOpen(signupsOpen);
        }
        if (status == GameStatus.FINISHED) {
            game.finish(Instant.now());
        }
        game = games.saveAndFlush(game);
        return new GameWithCount(game, players.countByGameId(game.getId()));
    }

    /** A lost race on the join-code index becomes JOIN_CODE_TAKEN; anything else is rethrown. */
    private static RuntimeException translateJoinCodeRace(DataIntegrityViolationException e) {
        if (String.valueOf(e.getMostSpecificCause().getMessage()).contains(JOIN_CODE_INDEX)) {
            return joinCodeTaken();
        }
        if (String.valueOf(e.getMostSpecificCause().getMessage()).contains(GAME_PKEY)) {
            return new ApiException(HttpStatus.CONFLICT, "SLUG_TAKEN", "Another game was created with that name at the same moment. Try again.");
        }
        return e;
    }

    private static ApiException joinCodeTaken() {
        return new ApiException(HttpStatus.CONFLICT, "JOIN_CODE_TAKEN", "Another game that isn't finished uses that join code.");
    }
}
