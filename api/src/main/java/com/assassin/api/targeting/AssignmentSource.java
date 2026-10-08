package com.assassin.api.targeting;

public enum AssignmentSource {
    RING,
    KILL_INHERIT,
    /** The assassin inherited the target of a player who was removed from the ring. */
    SPLICE,
    MANUAL
}
