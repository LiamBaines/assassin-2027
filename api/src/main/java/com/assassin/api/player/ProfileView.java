package com.assassin.api.player;

public record ProfileView(String displayName) {

    public static ProfileView from(Profile profile) {
        return new ProfileView(profile.getDisplayName());
    }
}
