package com.assassin.api.game;

import com.assassin.api.common.ApiException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KillWordService {

    static final int MAX_LENGTH = 60;
    static final int MAX_SUGGESTIONS = 200;

    private final KillWordRepository words;
    private final GameService games;
    private final KillWordGenerator generator;

    public KillWordService(KillWordRepository words, GameService games, KillWordGenerator generator) {
        this.words = words;
        this.games = games;
        this.generator = generator;
    }

    /** A word as the admin API returns it; {@code playerId} and {@code roundNo} are set once allocated. */
    public record KillWordView(long id, String text, KillWord.State state, KillWord.Origin origin, UUID playerId,
                               Integer roundNo, Instant usedAt) {

        static KillWordView from(KillWord w) {
            return new KillWordView(w.getId(), w.getText(), w.getState(), w.getOrigin(), w.getPlayerId(),
                    w.getRoundNo(), w.getUsedAt());
        }
    }

    /** Trims and collapses inner whitespace; null if nothing is left. */
    static String normalise(String raw) {
        if (raw == null) {
            return null;
        }
        String text = raw.trim().replaceAll("\\s+", " ");
        return text.isEmpty() ? null : text;
    }

    @Transactional(readOnly = true)
    public List<KillWordView> list(String gameId) {
        games.find(gameId);
        return words.findByGameIdOrderById(gameId).stream().map(KillWordView::from).toList();
    }

    /**
     * Adds the words to the game's list, all or nothing. Blank entries are skipped. Fails if none are left, one is too
     * long, one repeats within the request (case-insensitive), or one is already in the game's list, burned or not.
     */
    @Transactional
    public List<KillWordView> add(String gameId, List<String> raw) {
        Game game = games.lockForChange(gameId);
        Map<String, String> byLower = new LinkedHashMap<>();
        for (String entry : raw == null ? List.<String>of() : raw) {
            String text = normalise(entry);
            if (text == null) {
                continue;
            }
            if (text.length() > MAX_LENGTH) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "KILL_WORD_TOO_LONG",
                        "A kill word can be at most " + MAX_LENGTH + " characters.");
            }
            if (byLower.putIfAbsent(text.toLowerCase(Locale.ROOT), text) != null) {
                throw new ApiException(HttpStatus.CONFLICT, "KILL_WORD_TAKEN", "\"" + text + "\" is listed twice.");
            }
        }
        if (byLower.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "KILL_WORD_REQUIRED", "Enter at least one kill word.");
        }
        List<KillWord> existing = words.findByGameIdAndLowerTextIn(game.getId(), byLower.keySet());
        if (!existing.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "KILL_WORD_TAKEN",
                    "\"" + existing.get(0).getText() + "\" is already in this game's word list.");
        }
        Instant now = Instant.now();
        return words.saveAll(byLower.values().stream()
                        .map(t -> new KillWord(game.getId(), t, KillWord.Origin.ADMIN, now)).toList())
                .stream().map(KillWordView::from).toList();
    }

    /** Deletes a word that hasn't been allocated. Allocated and used words stay burned. */
    @Transactional
    public void delete(String gameId, long wordId) {
        games.lockForChange(gameId);
        KillWord word = words.findById(wordId).filter(w -> w.getGameId().equals(gameId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "KILL_WORD_NOT_FOUND",
                        "There is no such kill word."));
        if (word.getState() != KillWord.State.UNUSED) {
            throw new ApiException(HttpStatus.CONFLICT, "KILL_WORD_ALLOCATED",
                    "That word has been allocated, so it can't be deleted.");
        }
        words.delete(word);
    }

    /**
     * Random words from the bundled list that are not in the game's list (so none are burned or collide with the admin's
     * words). Nothing is persisted. Fails if the bundled list can't supply {@code count} more words.
     */
    @Transactional(readOnly = true)
    public List<String> generate(String gameId, int count) {
        games.find(gameId);
        if (count < 1 || count > MAX_SUGGESTIONS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "KILL_WORD_COUNT_INVALID",
                    "Ask for between 1 and " + MAX_SUGGESTIONS + " words.");
        }
        List<String> taken = words.findByGameIdOrderById(gameId).stream()
                .map(w -> w.getText().toLowerCase(Locale.ROOT)).toList();
        List<String> picked = generator.generate(taken, count, new Random());
        if (picked.size() < count) {
            throw new ApiException(HttpStatus.CONFLICT, "KILL_WORD_POOL_EXHAUSTED",
                    "There aren't enough unused random words left. Add some of your own.");
        }
        return picked;
    }

    /**
     * Allocates one word to each assassin of a new round. A word already in the game's list must be UNUSED; any other
     * text is added as a RANDOM word. Fails if a player has no word, a word repeats or is already burned, or a key is
     * not one of {@code playerIds}. The caller must hold the game's lock and have flushed the round row.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void allocate(String gameId, int roundNo, Collection<UUID> playerIds, Map<UUID, String> requested) {
        Map<UUID, String> given = requested == null ? Map.of() : requested;
        if (!playerIds.containsAll(given.keySet())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "KILL_WORD_PLAYER_INVALID",
                    "A kill word was given for a player who isn't in this round.");
        }
        Map<String, UUID> owners = new HashMap<>();
        Map<UUID, String> texts = new LinkedHashMap<>();
        for (UUID playerId : playerIds) {
            String text = normalise(given.get(playerId));
            if (text == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "KILL_WORD_MISSING",
                        "Every player in the round needs a kill word.");
            }
            if (text.length() > MAX_LENGTH) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "KILL_WORD_TOO_LONG",
                        "A kill word can be at most " + MAX_LENGTH + " characters.");
            }
            if (owners.putIfAbsent(text.toLowerCase(Locale.ROOT), playerId) != null) {
                throw new ApiException(HttpStatus.CONFLICT, "KILL_WORD_TAKEN",
                        "\"" + text + "\" is given to more than one player.");
            }
            texts.put(playerId, text);
        }
        Map<String, KillWord> existing = words.findByGameIdAndLowerTextIn(gameId, owners.keySet()).stream()
                .collect(Collectors.toMap(w -> w.getText().toLowerCase(Locale.ROOT), Function.identity()));
        Instant now = Instant.now();
        List<KillWord> toSave = new ArrayList<>();
        texts.forEach((playerId, text) -> {
            KillWord word = existing.get(text.toLowerCase(Locale.ROOT));
            if (word == null) {
                word = new KillWord(gameId, text, KillWord.Origin.RANDOM, now);
            } else if (word.getState() != KillWord.State.UNUSED) {
                throw new ApiException(HttpStatus.CONFLICT, "KILL_WORD_BURNED",
                        "\"" + word.getText() + "\" has already been used in this game.");
            }
            word.allocate(playerId, roundNo);
            toSave.add(word);
        });
        words.saveAllAndFlush(toSave);
    }

    /** The assassin's unspent word for the round, or KILL_WORD_NOT_AVAILABLE if they have none. */
    @Transactional(propagation = Propagation.MANDATORY)
    public KillWord requireLive(String gameId, UUID assassinId, int roundNo) {
        return words.findByGameIdAndPlayerIdAndRoundNoAndState(gameId, assassinId, roundNo, KillWord.State.ALLOCATED)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "KILL_WORD_NOT_AVAILABLE",
                        "The assassin has no live kill word this round, so a Death Sentence kill isn't possible."));
    }
}
