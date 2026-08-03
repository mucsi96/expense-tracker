package io.github.mucsi96.expensetracker.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * Authenticates requests carrying the static bearer token issued to the bank
 * email worker (Key Vault secret "bank-notification-token").
 */
@RequiredArgsConstructor
public class BankNotificationTokenFilter extends OncePerRequestFilter {
  private static final String BEARER_PREFIX = "Bearer ";

  private final String token;

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String header = request.getHeader(HttpHeaders.AUTHORIZATION);

    if (header != null && header.startsWith(BEARER_PREFIX) && MessageDigest.isEqual(
        header.substring(BEARER_PREFIX.length()).getBytes(StandardCharsets.UTF_8),
        token.getBytes(StandardCharsets.UTF_8))) {
      SecurityContextHolder.getContext().setAuthentication(
          UsernamePasswordAuthenticationToken.authenticated(
              "bank-email-worker", null, List.of(new SimpleGrantedAuthority("BANK_NOTIFICATION"))));
    }

    filterChain.doFilter(request, response);
  }
}
