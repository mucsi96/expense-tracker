package io.github.mucsi96.expensetracker.config;

import java.util.Collection;
import java.util.Optional;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;

import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfiguration {

    @Bean
    @Order(1)
    SecurityFilterChain bankNotificationSecurityFilterChain(HttpSecurity http,
            @Value("${bank-notification-token}") String bankNotificationToken)
            throws Exception {

        if (bankNotificationToken.isBlank()) {
            throw new IllegalStateException("bank-notification-token must not be blank");
        }

        http.securityMatcher("/bank-notifications")
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new BankNotificationTokenFilter(bankNotificationToken), AuthorizationFilter.class)
                .authorizeHttpRequests(requests -> requests.anyRequest().authenticated())
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)));

        return http.build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain securityFilterChain(HttpSecurity http)
            throws Exception {

        http.oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())));

        http.authorizeHttpRequests(requests -> requests
                .requestMatchers("/environment").permitAll()
                .requestMatchers("/actuator/**").permitAll()
                .anyRequest().hasAuthority("SCOPE_api-access"));

        return http.build();
    }

    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> Stream.concat(
                scopeConverter.convert(jwt).stream(),
                Optional.ofNullable(jwt.getClaimAsStringList("roles"))
                        .stream()
                        .flatMap(Collection::stream)
                        .map(role -> new SimpleGrantedAuthority("APPROLE_" + role)))
                .toList());
        return converter;
    }
}
