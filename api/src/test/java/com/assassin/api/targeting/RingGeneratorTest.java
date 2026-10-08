package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.assassin.api.targeting.RingGenerator.Link;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.SplittableRandom;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class RingGeneratorTest {

    private static final int SEEDS = 25;

    private static List<Integer> players(int n) {
        return IntStream.range(0, n).boxed().toList();
    }

    @Test
    void producesSingleCycleWithEveryPlayerOnceOnEachSide() {
        for (int n = 2; n <= 200; n++) {
            for (long seed = 0; seed < SEEDS; seed++) {
                List<Link<Integer>> ring = RingGenerator.generate(players(n), new SplittableRandom(seed * 7919 + n));
                String ctx = "n=" + n + " seed=" + seed;

                assertThat(ring).as(ctx).hasSize(n);
                assertThat(ring).as(ctx).allSatisfy(l -> assertThat(l.assassin()).isNotEqualTo(l.target()));
                Set<Integer> assassins = new HashSet<>();
                Set<Integer> targets = new HashSet<>();
                Map<Integer, Integer> next = new HashMap<>();
                for (Link<Integer> l : ring) {
                    assassins.add(l.assassin());
                    targets.add(l.target());
                    next.put(l.assassin(), l.target());
                }
                assertThat(assassins).as(ctx).containsExactlyInAnyOrderElementsOf(players(n));
                assertThat(targets).as(ctx).containsExactlyInAnyOrderElementsOf(players(n));

                // Following targets from any player visits all n players before returning: one n-cycle.
                int steps = 0;
                int current = 0;
                do {
                    current = next.get(current);
                    steps++;
                } while (current != 0 && steps <= n);
                assertThat(steps).as(ctx + " cycle length").isEqualTo(n);
            }
        }
    }

    @Test
    void linksAreEmittedInCycleOrder() {
        List<Link<Integer>> ring = RingGenerator.generate(players(10), new SplittableRandom(42));
        for (int i = 0; i < ring.size(); i++) {
            assertThat(ring.get(i).target()).isEqualTo(ring.get((i + 1) % ring.size()).assassin());
        }
    }

    @Test
    void allSixCyclesOfFourAreRoughlyEquallyLikely() {
        int trials = 60_000;
        SplittableRandom random = new SplittableRandom(2027);
        Map<String, Integer> counts = new HashMap<>();
        for (int t = 0; t < trials; t++) {
            Map<Integer, Integer> next = new HashMap<>();
            RingGenerator.generate(players(4), random).forEach(l -> next.put(l.assassin(), l.target()));
            // Canonical form: walk from player 0.
            StringBuilder key = new StringBuilder("0");
            for (int c = next.get(0); c != 0; c = next.get(c)) {
                key.append(c);
            }
            counts.merge(key.toString(), 1, Integer::sum);
        }
        assertThat(counts).hasSize(6);
        double expected = trials / 6.0;
        // One standard deviation is about 91; allow +/-5% (about 5.5 sigma).
        assertThat(counts.values()).allSatisfy(c -> assertThat((double) c).isBetween(expected * 0.95, expected * 1.05));
    }

    @Test
    void doesNotModifyInput() {
        List<Integer> input = new ArrayList<>(players(5));
        RingGenerator.generate(input, new SplittableRandom(1));
        assertThat(input).containsExactly(0, 1, 2, 3, 4);
    }

    @Test
    void rejectsFewerThanTwoPlayers() {
        assertThatThrownBy(() -> RingGenerator.generate(List.of(), new SplittableRandom(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RingGenerator.generate(List.of(1), new SplittableRandom(1)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
