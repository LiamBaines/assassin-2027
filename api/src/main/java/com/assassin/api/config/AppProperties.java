package com.assassin.api.config;

import jakarta.validation.constraints.NotBlank;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * {@code app.*} settings.
 *
 * @param supabaseUrl base URL of the Supabase project, e.g. {@code https://xyz.supabase.co}
 * @param jwtAudience required value in the JWT {@code aud} claim
 * @param adminEmails emails granted ROLE_ADMIN, compared case-insensitively
 */
@Validated
@ConfigurationProperties("app")
public record AppProperties(
        @NotBlank String supabaseUrl,
        @DefaultValue("authenticated") @NotBlank String jwtAudience,
        @DefaultValue Set<String> adminEmails) {

    public AppProperties {
        supabaseUrl = supabaseUrl == null ? null : supabaseUrl.replaceAll("/+$", "");
        adminEmails = adminEmails.stream()
                .map(String::strip)
                .filter(e -> !e.isEmpty())
                .map(e -> e.toLowerCase(Locale.ROOT))
                .collect(Collectors.toUnmodifiableSet());
    }

    public String issuer() {
        return supabaseUrl + "/auth/v1";
    }

    public String jwkSetUri() {
        return issuer() + "/.well-known/jwks.json";
    }
}
