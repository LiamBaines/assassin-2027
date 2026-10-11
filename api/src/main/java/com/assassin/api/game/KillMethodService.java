package com.assassin.api.game;

import com.assassin.api.common.ApiException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KillMethodService {

    private final KillMethodRepository methods;

    public KillMethodService(KillMethodRepository methods) {
        this.methods = methods;
    }

    /** An edit of one method: {@code id} null adds a new one. */
    public record KillMethodInput(Long id, String name, int points, boolean enabled) {
    }

    /** A method as the API returns it. */
    public record KillMethodView(long id, String name, int points, boolean enabled) {

        static KillMethodView from(KillMethod m) {
            return new KillMethodView(m.getId(), m.getName(), m.getPoints(), m.isEnabled());
        }
    }

    @Transactional(readOnly = true)
    public List<KillMethodView> list(UUID gameId, boolean enabledOnly) {
        return methods.findByGameIdOrderById(gameId).stream()
                .filter(m -> !enabledOnly || m.isEnabled())
                .map(KillMethodView::from)
                .toList();
    }

    /** Every method of the game, enabled or not. */
    @Transactional(readOnly = true)
    public List<KillMethod> all(UUID gameId) {
        return methods.findByGameIdOrderById(gameId);
    }

    /** The method a new kill or claim is filed with: it must be given, belong to the game and be enabled. */
    @Transactional(readOnly = true)
    public KillMethod requireEnabled(UUID gameId, Long methodId) {
        if (methodId == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "KILL_METHOD_REQUIRED", "Pick the kill method used.");
        }
        KillMethod method = require(gameId, methodId);
        if (!method.isEnabled()) {
            throw new ApiException(HttpStatus.CONFLICT, "KILL_METHOD_DISABLED", "That kill method is disabled.");
        }
        return method;
    }

    /** A method of this game, enabled or not. */
    @Transactional(readOnly = true)
    public KillMethod require(UUID gameId, long methodId) {
        return methods.findById(methodId).filter(m -> m.getGameId().equals(gameId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "KILL_METHOD_NOT_FOUND",
                        "There is no such kill method."));
    }

    /**
     * Applies the edits (null = none; methods not mentioned stay as they are) and checks that at least one method is
     * enabled. The caller must hold the game's lock ({@link GameService#lockForChange(UUID)}).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void applyForNewRound(UUID gameId, List<KillMethodInput> edits) {
        List<KillMethod> all = new ArrayList<>(methods.findByGameIdOrderById(gameId));
        Map<Long, KillMethod> byId = all.stream().collect(Collectors.toMap(KillMethod::getId, Function.identity()));
        Instant now = Instant.now();
        Set<Long> edited = new HashSet<>();
        for (KillMethodInput edit : edits == null ? List.<KillMethodInput>of() : edits) {
            String name = edit.name() == null ? "" : edit.name().trim();
            if (name.isEmpty() || edit.points() < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_KILL_METHOD",
                        "A kill method needs a name and non-negative points.");
            }
            if (edit.id() == null) {
                all.add(new KillMethod(gameId, name, edit.points(), edit.enabled(), now));
                continue;
            }
            KillMethod existing = byId.get(edit.id());
            if (existing == null) {
                throw new ApiException(HttpStatus.NOT_FOUND, "KILL_METHOD_NOT_FOUND", "There is no such kill method.");
            }
            if (!edited.add(edit.id())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_KILL_METHOD", "A kill method is listed twice.");
            }
            existing.update(name, edit.points(), edit.enabled());
        }
        Set<String> names = new HashSet<>();
        for (KillMethod m : all) {
            if (!names.add(m.getName().toLowerCase(Locale.ROOT))) {
                throw new ApiException(HttpStatus.CONFLICT, "KILL_METHOD_NAME_TAKEN",
                        "Another kill method is already called " + m.getName() + ".");
            }
        }
        if (all.stream().noneMatch(KillMethod::isEnabled)) {
            throw new ApiException(HttpStatus.CONFLICT, "NO_ENABLED_METHODS", "At least one kill method must be enabled.");
        }
        methods.saveAll(all);
        methods.flush();
    }
}
