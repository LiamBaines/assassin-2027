package com.assassin.api.game;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Picks random kill words from the bundled list ({@code kill-words.txt}). */
@Component
public class KillWordGenerator {

    private final List<String> pool;

    public KillWordGenerator() {
        this.pool = load();
    }

    /** Test seam: a generator over a fixed pool. */
    KillWordGenerator(List<String> pool) {
        this.pool = List.copyOf(pool);
    }

    /**
     * Up to {@code n} distinct words from the pool whose lower-cased text is not in {@code excludedLower}. Returns fewer
     * if the pool runs out.
     */
    public List<String> generate(Collection<String> excludedLower, int n, Random random) {
        Set<String> excluded = Set.copyOf(excludedLower);
        List<String> candidates = new ArrayList<>(pool.stream()
                .filter(w -> !excluded.contains(w.toLowerCase(Locale.ROOT))).toList());
        Collections.shuffle(candidates, random);
        return List.copyOf(candidates.subList(0, Math.min(n, candidates.size())));
    }

    private static List<String> load() {
        try (BufferedReader in = new BufferedReader(new InputStreamReader(
                new ClassPathResource("kill-words.txt").getInputStream(), StandardCharsets.UTF_8))) {
            return in.lines().map(KillWordService::normalise).filter(l -> l != null).distinct().toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
