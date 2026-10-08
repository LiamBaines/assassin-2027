package com.assassin.api.player;

import com.assassin.api.common.ApiException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Limits wrong join-code guesses per account, so the code can't be brute-forced.
 * In-memory is enough: the API runs as a single Fly machine.
 */
@Component
public class JoinCodeAttemptLimiter {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(10);

    private final Map<UUID, Deque<Instant>> failures = new ConcurrentHashMap<>();

    /** Throws 429 if the user has used up their wrong guesses for the current window. */
    public void checkAllowed(UUID authUserId) {
        Deque<Instant> recent = failures.get(authUserId);
        if (recent == null) {
            return;
        }
        synchronized (recent) {
            prune(recent);
            if (recent.size() >= MAX_FAILURES) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                        "Too many wrong join codes. Try again in a few minutes.");
            }
        }
    }

    public void recordFailure(UUID authUserId) {
        Deque<Instant> recent = failures.computeIfAbsent(authUserId, id -> new ArrayDeque<>());
        synchronized (recent) {
            prune(recent);
            recent.addLast(Instant.now());
        }
    }

    private static void prune(Deque<Instant> recent) {
        Instant cutoff = Instant.now().minus(WINDOW);
        while (!recent.isEmpty() && recent.peekFirst().isBefore(cutoff)) {
            recent.removeFirst();
        }
    }
}
