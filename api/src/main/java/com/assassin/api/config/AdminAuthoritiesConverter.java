package com.assassin.api.config;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

/** Everyone gets ROLE_USER. A lowercased {@code email} claim in the admin allowlist also gets ROLE_ADMIN. */
public class AdminAuthoritiesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    private static final GrantedAuthority USER = new SimpleGrantedAuthority("ROLE_USER");
    private static final GrantedAuthority ADMIN = new SimpleGrantedAuthority("ROLE_ADMIN");

    private final Set<String> adminEmails;

    public AdminAuthoritiesConverter(Set<String> adminEmails) {
        this.adminEmails = adminEmails;
    }

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        if (email != null && adminEmails.contains(email.strip().toLowerCase(Locale.ROOT))) {
            return List.of(USER, ADMIN);
        }
        return List.of(USER);
    }
}
