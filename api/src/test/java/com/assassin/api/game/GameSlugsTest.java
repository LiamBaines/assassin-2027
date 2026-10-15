package com.assassin.api.game;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class GameSlugsTest {

    @Test
    void lowercasesAndJoinsWordsWithHyphens() {
        assertThat(GameSlugs.base("Work Assassin")).isEqualTo("work-assassin");
        assertThat(GameSlugs.base("  Spring 2027!! ")).isEqualTo("spring-2027");
    }

    @Test
    void stripsAccents() {
        assertThat(GameSlugs.base("Café Noël")).isEqualTo("cafe-noel");
    }

    @Test
    void emptyResultFallsBackToGame() {
        assertThat(GameSlugs.base("🔪🔪")).isEqualTo("game");
        assertThat(GameSlugs.base("---")).isEqualTo("game");
    }

    @Test
    void reservedNamesGetASuffix() {
        assertThat(GameSlugs.base("Admin")).isEqualTo("admin-2");
        assertThat(GameSlugs.base("Join")).isEqualTo("join-2");
    }

    @Test
    void longNamesAreTruncatedWithoutATrailingHyphen() {
        String slug = GameSlugs.base("a".repeat(GameSlugs.MAX_LENGTH - 1) + " bbb");
        assertThat(slug).hasSizeLessThanOrEqualTo(GameSlugs.MAX_LENGTH).doesNotEndWith("-");
    }
}
