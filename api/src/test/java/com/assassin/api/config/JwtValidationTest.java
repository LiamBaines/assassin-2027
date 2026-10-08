package com.assassin.api.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.assassin.api.JwtTestSupport;
import java.time.Instant;
import java.util.Date;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

/** Fast, Docker-free checks of the production JWT validators and the admin authorities converter. */
class JwtValidationTest {

    private static final String USER = "player@example.com";

    private final AppProperties props =
            new AppProperties(JwtTestSupport.SUPABASE_URL + "/", "authenticated", Set.of(" Admin@Example.com "));
    private final JwtDecoder decoder = JwtTestSupport.decoder(props);

    @Test
    void propertiesNormalizeUrlAndEmails() {
        assertThat(props.issuer()).isEqualTo(JwtTestSupport.ISSUER);
        assertThat(props.jwkSetUri()).isEqualTo(JwtTestSupport.ISSUER + "/.well-known/jwks.json");
        assertThat(props.adminEmails()).containsExactly("admin@example.com");
    }

    @Test
    void acceptsValidToken() {
        Jwt jwt = decoder.decode(JwtTestSupport.token(USER));
        assertThat(jwt.getSubject()).isEqualTo(JwtTestSupport.subFor(USER).toString());
        assertThat(jwt.getClaimAsString("email")).isEqualTo(USER);
    }

    @Test
    void rejectsBadIssuer() {
        String token = JwtTestSupport.sign(JwtTestSupport.claims(USER).issuer("https://evil.test/auth/v1").build());
        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsBadAudience() {
        String token = JwtTestSupport.sign(JwtTestSupport.claims(USER).audience("anon").build());
        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsExpiredToken() {
        Instant past = Instant.now().minusSeconds(7200);
        String token = JwtTestSupport.sign(JwtTestSupport.claims(USER)
                .issueTime(Date.from(past)).expirationTime(Date.from(past.plusSeconds(3600))).build());
        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsUnknownKey() {
        String token = JwtTestSupport.sign(JwtTestSupport.claims(USER).build(), JwtTestSupport.generateKey());
        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void adminConverterIsCaseInsensitive() {
        AdminAuthoritiesConverter converter = new AdminAuthoritiesConverter(props.adminEmails());
        assertThat(converter.convert(decoder.decode(JwtTestSupport.token("ADMIN@example.COM"))))
                .extracting(GrantedAuthority::getAuthority).containsExactlyInAnyOrder("ROLE_USER", "ROLE_ADMIN");
        assertThat(converter.convert(decoder.decode(JwtTestSupport.token(USER))))
                .extracting(GrantedAuthority::getAuthority).containsExactly("ROLE_USER");
    }
}
