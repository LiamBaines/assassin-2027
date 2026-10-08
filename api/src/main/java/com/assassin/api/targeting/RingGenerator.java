package com.assassin.api.targeting;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.random.RandomGenerator;

/**
 * Builds a ring: a single cycle through every player, so each player is the assassin of exactly one target and the
 * target of exactly one assassin. Every one of the (n-1)! cycles is equally likely.
 */
public final class RingGenerator {

    private RingGenerator() {
    }

    public record Link<T>(T assassin, T target) {
    }

    /** Fisher-Yates shuffles a copy of {@code players}, then links {@code p[i] -> p[(i+1) % n]}. */
    public static <T> List<Link<T>> generate(List<T> players, RandomGenerator random) {
        int n = players.size();
        if (n < 2) {
            throw new IllegalArgumentException("A ring needs at least 2 players, got " + n);
        }
        List<T> p = new ArrayList<>(players);
        for (int i = n - 1; i > 0; i--) {
            Collections.swap(p, i, random.nextInt(i + 1));
        }
        List<Link<T>> ring = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            ring.add(new Link<>(p.get(i), p.get((i + 1) % n)));
        }
        return ring;
    }
}
