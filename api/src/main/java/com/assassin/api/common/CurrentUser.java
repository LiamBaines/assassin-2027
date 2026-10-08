package com.assassin.api.common;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * The caller, from a verified Supabase access token.
 *
 * @param authUserId the JWT {@code sub} (Supabase auth user id)
 * @param email the JWT {@code email} claim, as issued
 * @param admin whether the caller has ROLE_ADMIN
 */
public record CurrentUser(UUID authUserId, String email, boolean admin) {

    public static CurrentUser from(JwtAuthenticationToken auth) {
        UUID sub;
        try {
            sub = UUID.fromString(auth.getToken().getSubject());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_TOKEN", "Token subject is not a user id.");
        }
        boolean admin = auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return new CurrentUser(sub, auth.getToken().getClaimAsString("email"), admin);
    }
}
