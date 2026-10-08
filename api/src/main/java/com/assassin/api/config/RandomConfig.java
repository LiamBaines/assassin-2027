package com.assassin.api.config;

import java.security.SecureRandom;
import java.util.random.RandomGenerator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class RandomConfig {

    /** Randomness for ring generation. Tests can supply a seeded generator instead. */
    @Bean
    RandomGenerator randomGenerator() {
        return new SecureRandom();
    }
}
