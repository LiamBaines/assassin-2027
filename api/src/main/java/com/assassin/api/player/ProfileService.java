package com.assassin.api.player;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ProfileService {

    private final ProfileRepository profiles;

    public ProfileService(ProfileRepository profiles) {
        this.profiles = profiles;
    }

    /** Sets the caller's display name. It can only ever be set once. */
    public Profile create(CurrentUser user, String displayName) {
        validateDisplayName(displayName);
        if (profiles.existsById(user.authUserId())) {
            throw exists();
        }
        try {
            return profiles.saveAndFlush(new Profile(user.authUserId(), displayName));
        } catch (DataIntegrityViolationException e) {
            // Lost a race with a concurrent request.
            throw exists();
        }
    }

    /**
     * Counts code points, as Postgres does, so an emoji is one character. Rejects invisible
     * characters, so "Alice" plus a zero-width space can't sit next to "Alice".
     */
    static void validateDisplayName(String displayName) {
        int length = displayName.codePointCount(0, displayName.length());
        boolean invisible = displayName.codePoints().anyMatch(c ->
                Character.getType(c) == Character.CONTROL || Character.getType(c) == Character.FORMAT);
        if (length < 2 || length > 32 || invisible) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DISPLAY_NAME",
                    "Display names must be 2-32 visible characters.");
        }
    }

    private static ApiException exists() {
        return new ApiException(HttpStatus.CONFLICT, "PROFILE_EXISTS", "Your display name is already set.");
    }
}
