package com.assassin.api.game;

import com.assassin.api.common.ApiException;
import com.assassin.api.player.PlayerRepository;
import com.assassin.api.player.PlayerRepository.GamePlayerCount;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    private final GameRepository games;
    private final PlayerRepository players;

    public GameService(GameRepository games, PlayerRepository players) {
        this.games = games;
        this.players = players;
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
        Map<UUID, Long> counts = players.countPerGame().stream()
                .collect(Collectors.toMap(GamePlayerCount::getGameId, GamePlayerCount::getCount));
        return games.findAllByOrderByCreatedAtDesc().stream()
                .map(g -> new GameWithCount(g, counts.getOrDefault(g.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public GameWithCount get(UUID gameId) {
        Game game = find(gameId);
        return new GameWithCount(game, players.countByGameId(game.getId()));
    }

    /** The game, or 404 GAME_NOT_FOUND. */
    @Transactional(readOnly = true)
    public Game find(UUID gameId) {
        return games.findById(gameId).orElseThrow(GameService::gameNotFound);
    }

    /**
     * Locks the game row ({@code SELECT ... FOR UPDATE}) for a change, so changes to one game queue behind each other.
     * 404 GAME_NOT_FOUND if it doesn't exist, 409 GAME_FINISHED if it is finished.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Game lockForChange(UUID gameId) {
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
            return new GameWithCount(games.saveAndFlush(new Game(name, joinCode)), 0);
        } catch (DataIntegrityViolationException e) {
            throw translateJoinCodeRace(e);
        }
    }

    /** Applies the non-null fields. {@code status} may only be FINISHED. A FINISHED game can't be changed. */
    @Transactional
    public GameWithCount update(UUID gameId, String name, String joinCode, Boolean signupsOpen, GameStatus status) {
        Game game = lockForChange(gameId);
        if (status != null && status != GameStatus.FINISHED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STATUS", "A game's status can only be set to FINISHED.");
        }
        if (joinCode != null && !joinCode.equals(game.getJoinCode())
                && games.findLiveByJoinCode(joinCode).isPresent()) {
            throw joinCodeTaken();
        }
        if (name != null) {
            game.rename(name);
        }
        if (joinCode != null) {
            game.changeJoinCode(joinCode);
        }
        if (signupsOpen != null) {
            game.setSignupsOpen(signupsOpen);
        }
        if (status == GameStatus.FINISHED) {
            game.finish(Instant.now());
        }
        try {
            game = games.saveAndFlush(game);
        } catch (DataIntegrityViolationException e) {
            throw translateJoinCodeRace(e);
        }
        return new GameWithCount(game, players.countByGameId(game.getId()));
    }

    /** A lost race on the join-code index becomes JOIN_CODE_TAKEN; anything else is rethrown. */
    private static RuntimeException translateJoinCodeRace(DataIntegrityViolationException e) {
        if (String.valueOf(e.getMostSpecificCause().getMessage()).contains(JOIN_CODE_INDEX)) {
            return joinCodeTaken();
        }
        return e;
    }

    private static ApiException joinCodeTaken() {
        return new ApiException(HttpStatus.CONFLICT, "JOIN_CODE_TAKEN", "Another game that isn't finished uses that join code.");
    }
}
