package com.assassin.api;

import com.assassin.api.config.AppProperties;
import com.assassin.api.config.SecurityConfig;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Mints real ES256 Supabase-style access tokens with an in-memory P-256 key, and replaces the JWKS-backed
 * decoder with one that trusts that key while applying the same production validators.
 */
@TestConfiguration(proxyBeanMethods = false)
public class JwtTestSupport {

    public static final String SUPABASE_URL = "http://supabase.test";
    public static final String ISSUER = SUPABASE_URL + "/auth/v1";
    public static final String AUDIENCE = "authenticated";
    public static final String ADMIN_EMAIL = "admin@example.com";

    private static final ECKey KEY = generateKey();

    @Bean
    @Primary
    JwtDecoder testJwtDecoder(AppProperties props) {
        return decoder(props);
    }

    /** Decoder that trusts the test key, with the production validators. */
    public static NimbusJwtDecoder decoder(AppProperties props) {
        DefaultJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
        processor.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.ES256,
                new ImmutableJWKSet<>(new JWKSet(KEY.toPublicJWK()))));
        // As in NimbusJwtDecoder's builders: claims are checked by Spring validators, not Nimbus.
        processor.setJWTClaimsSetVerifier((claims, context) -> {
        });
        NimbusJwtDecoder decoder = new NimbusJwtDecoder(processor);
        decoder.setJwtValidator(SecurityConfig.supabaseJwtValidator(props));
        return decoder;
    }

    /** A valid token for {@code email}. The {@code sub} is derived from the lowercased email, so it is stable. */
    public static String token(String email) {
        return sign(claims(email).build());
    }

    /** Valid default claims, to tweak in tests. */
    public static JWTClaimsSet.Builder claims(String email) {
        Instant now = Instant.now();
        return new JWTClaimsSet.Builder()
                .subject(subFor(email).toString())
                .issuer(ISSUER)
                .audience(AUDIENCE)
                .claim("email", email)
                .claim("role", "authenticated")
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(3600)));
    }

    public static UUID subFor(String email) {
        return UUID.nameUUIDFromBytes(email.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
    }

    public static String sign(JWTClaimsSet claims) {
        return sign(claims, KEY);
    }

    public static String sign(JWTClaimsSet claims, ECKey key) {
        try {
            SignedJWT jwt = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(key.getKeyID()).build(), claims);
            jwt.sign(new ECDSASigner(key));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }

    public static ECKey generateKey() {
        try {
            return new ECKeyGenerator(Curve.P_256).keyID(UUID.randomUUID().toString()).generate();
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }
}
