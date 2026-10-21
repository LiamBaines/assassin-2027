package com.assassin.api.game;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;

class KillWordGeneratorTest {

    @Test
    void bundledListLoadsWithDistinctWords() {
        List<String> all = new KillWordGenerator().generate(Set.of(), 10_000, new Random(1));
        assertThat(all).hasSizeGreaterThan(100).doesNotHaveDuplicates();
    }

    @Test
    void skipsExcludedWordsCaseInsensitively() {
        KillWordGenerator generator = new KillWordGenerator(List.of("Apple", "pear", "plum"));
        assertThat(generator.generate(Set.of("apple", "pear"), 3, new Random(1))).containsExactly("plum");
    }

    @Test
    void returnsDistinctWordsAndNoMoreThanRequested() {
        KillWordGenerator generator = new KillWordGenerator(List.of("a", "b", "c", "d"));
        assertThat(generator.generate(Set.of(), 3, new Random(1))).hasSize(3).doesNotHaveDuplicates();
    }
}
