package com.assassin.api.player;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.assassin.api.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class JoinCodeAttemptLimiterTest {

    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2027-01-01T12:00:00Z"));
    private final JoinCodeAttemptLimiter limiter = new JoinCodeAttemptLimiter(new Clock() {
        @Override
        public Instant instant() {
            return now.get();
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }
    });
    private final UUID user = UUID.randomUUID();

    @Test
    void unreleasedReservationsAreFailuresUpToTheLimit() {
        for (int i = 0; i < JoinCodeAttemptLimiter.MAX_FAILURES; i++) {
            limiter.reserve(user);
        }
        assertTooManyAttempts(user);
        // Other accounts have their own budget.
        limiter.reserve(UUID.randomUUID());
    }

    @Test
    void releasedReservationsDoNotCount() {
        for (int i = 0; i < 50; i++) {
            limiter.reserve(user).release();
        }
        for (int i = 0; i < JoinCodeAttemptLimiter.MAX_FAILURES; i++) {
            limiter.reserve(user);
        }
        assertTooManyAttempts(user);
    }

    @Test
    void releasingTwiceFreesOnlyOneSlot() {
        JoinCodeAttemptLimiter.Reservation valid = limiter.reserve(user);
        for (int i = 0; i < JoinCodeAttemptLimiter.MAX_FAILURES - 1; i++) {
            limiter.reserve(user);
        }
        valid.release();
        valid.release();
        limiter.reserve(user);
        assertTooManyAttempts(user);
    }

    @Test
    void failuresExpireAfterTheWindow() {
        for (int i = 0; i < JoinCodeAttemptLimiter.MAX_FAILURES; i++) {
            limiter.reserve(user);
        }
        now.set(now.get().plus(JoinCodeAttemptLimiter.WINDOW).minusSeconds(1));
        assertTooManyAttempts(user);
        now.set(now.get().plus(Duration.ofSeconds(2)));
        limiter.reserve(user);
    }

    @Test
    void concurrentReservationsNeverExceedTheLimit() throws Exception {
        int threads = 32;
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                results.add(pool.submit(() -> {
                    go.await();
                    try {
                        limiter.reserve(user);
                        return true;
                    } catch (ApiException e) {
                        return false;
                    }
                }));
            }
            go.countDown();
            int granted = 0;
            for (Future<Boolean> result : results) {
                granted += result.get() ? 1 : 0;
            }
            assertThat(granted).isEqualTo(JoinCodeAttemptLimiter.MAX_FAILURES);
        } finally {
            pool.shutdownNow();
        }
    }

    private void assertTooManyAttempts(UUID authUserId) {
        assertThatThrownBy(() -> limiter.reserve(authUserId))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("TOO_MANY_ATTEMPTS"));
    }
}
