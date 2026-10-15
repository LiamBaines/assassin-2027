package com.assassin.api.game;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

/** Builds URL slugs from game names. A game's slug is its id and appears at the top level of the web app. */
final class GameSlugs {

    static final int MAX_LENGTH = 40;

    private static final String FALLBACK = "game";

    /** Top-level web routes, which a game's slug must not shadow. */
    private static final Set<String> RESERVED = Set.of("admin", "api", "auth", "games", "join", "login", "me");

    private GameSlugs() {
    }

    /** Lowercase letters and digits joined by single hyphens; a reserved or empty result gets a safe form. */
    static String base(String name) {
        String ascii = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        String slug = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (slug.length() > MAX_LENGTH) {
            slug = slug.substring(0, MAX_LENGTH).replaceAll("-+$", "");
        }
        if (slug.isEmpty()) {
            return FALLBACK;
        }
        return RESERVED.contains(slug) ? withSuffix(slug, 2) : slug;
    }

    static String withSuffix(String base, int n) {
        return base + "-" + n;
    }
}
