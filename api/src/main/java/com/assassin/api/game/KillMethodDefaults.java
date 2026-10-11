package com.assassin.api.game;

import java.util.List;

/** The standard kill methods every new game starts with. Keep in step with the seed in migration V9. */
final class KillMethodDefaults {

    record Method(String name, int points) {
    }

    static final List<Method> STANDARD = List.of(
            new Method("Clamp", 10),
            new Method("Ticker Bomb", 10),
            new Method("Poison", 10),
            new Method("Electric Chair", 10),
            new Method("Goodbye Note", 10),
            new Method("Duel", 15),
            new Method("Death Sentence", 10),
            new Method("ADoS Injection", 10),
            new Method("Remote Shutdown", 10),
            new Method("Hand Grenade", 10));

    private KillMethodDefaults() {
    }
}
