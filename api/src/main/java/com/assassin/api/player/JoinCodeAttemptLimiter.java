package com.assassin.api.player;

import com.assassin.api.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Limits wrong join-code guesses per account, so the code can't be brute-forced.
 * In-memory is enough: the API runs as a single Fly machine.
 *
 * <p>Every lookup first {@link #reserve reserves} an attempt under the account's lock, so concurrent guesses can't
 * all slip past the check. A reservation counts as a failure until it is {@link Reservation#release released},
 * which callers do when the code turns out to be valid.
 */
@Component
public class JoinCodeAttemptLimiter {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(10);

    private final Map<UUID, Deque<Instant>> attempts = new ConcurrentHashMap<>();
    private final Clock clock;

    @Autowired
    public JoinCodeAttemptLimiter() {
        this(Clock.systemUTC());
    }

    JoinCodeAttemptLimiter(Clock clock) {
        this.clock = clock;
    }

    /**
     * Reserves one attempt for the account, or throws 429 TOO_MANY_ATTEMPTS if it has used up its wrong guesses for
     * the current window. Release the reservation if the code is valid; otherwise it stays as a failure.
     */
    public Reservation reserve(UUID authUserId) {
        // compute() runs atomically per key, so check-and-add can't interleave for one account.
        Instant now = clock.instant();
        Instant[] slot = new Instant[1];
        attempts.compute(authUserId, (id, recent) -> {
            Deque<Instant> deque = recent == null ? new ArrayDeque<>() : recent;
            prune(deque, now);
            if (deque.size() < MAX_FAILURES) {
                deque.addLast(now);
                slot[0] = now;
            }
            return deque;
        });
        if (slot[0] == null) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                    "Too many wrong join codes. Try again in a few minutes.");
        }
        return new Reservation(authUserId, slot[0]);
    }

    private void release(UUID authUserId, Instant slot) {
        attempts.computeIfPresent(authUserId, (id, recent) -> {
            recent.removeFirstOccurrence(slot);
            return recent.isEmpty() ? null : recent;
        });
    }

    private void prune(Deque<Instant> recent, Instant now) {
        Instant cutoff = now.minus(WINDOW);
        while (!recent.isEmpty() && recent.peekFirst().isBefore(cutoff)) {
            recent.removeFirst();
        }
    }

    /** One reserved attempt. {@link #release()} it when the code was valid, so it doesn't count as a failure. */
    public final class Reservation {

        private final UUID authUserId;
        private final Instant slot;
        private boolean released;

        private Reservation(UUID authUserId, Instant slot) {
            this.authUserId = authUserId;
            this.slot = slot;
        }

        public void release() {
            if (!released) {
                released = true;
                JoinCodeAttemptLimiter.this.release(authUserId, slot);
            }
        }
    }
}
