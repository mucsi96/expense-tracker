package io.github.mucsi96.expensetracker.service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.aot.hint.annotation.RegisterReflectionForBinding;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Fetches historical exchange rates from the public Frankfurter API
 * (ECB reference rates, no API key required), keyed by the transaction date.
 *
 * Results are cached in memory for one day so a statement import - which
 * typically repeats the same few (currency, date) pairs across many rows -
 * hits the API at most once per pair per day.
 *
 * The base URL is configurable so tests can point it at a local mock server
 * ({@code mock_exchange_rate_server}) instead of the live API.
 *
 * The response is read by a plain {@code RestClient}, which is outside what
 * Spring's AOT processing infers reflection metadata for (controller payloads,
 * entities and repositories are covered), so the native image needs the
 * response type registered explicitly - without it the deserialization fails
 * only at runtime, on the first foreign-currency transaction.
 */
@RegisterReflectionForBinding(FrankfurterExchangeRateProvider.FrankfurterResponse.class)
@Component
public class FrankfurterExchangeRateProvider implements ExchangeRateProvider {
  private static final Duration CACHE_TTL = Duration.ofDays(1);
  private static final int TIMEOUT_MILLIS = 5000;

  private final RestClient restClient;
  private final Map<CacheKey, CachedRate> cache = new ConcurrentHashMap<>();

  public FrankfurterExchangeRateProvider(
      @Value("${expense-tracker.exchange-rate-api-url}") String baseUrl) {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(TIMEOUT_MILLIS);
    requestFactory.setReadTimeout(TIMEOUT_MILLIS);
    this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
  }

  @Override
  public BigDecimal getRate(String fromCurrency, String toCurrency, LocalDate date) {
    CacheKey key = new CacheKey(fromCurrency, toCurrency, date);
    CachedRate cached = cache.get(key);
    if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
      return cached.rate();
    }

    BigDecimal rate = fetchRate(fromCurrency, toCurrency, date);
    cache.put(key, new CachedRate(rate, Instant.now().plus(CACHE_TTL)));
    return rate;
  }

  private BigDecimal fetchRate(String fromCurrency, String toCurrency, LocalDate date) {
    FrankfurterResponse response = restClient.get()
        .uri(uriBuilder -> uriBuilder
            .pathSegment(date.toString())
            .queryParam("base", fromCurrency)
            .queryParam("symbols", toCurrency)
            .build())
        .retrieve()
        .body(FrankfurterResponse.class);

    return Optional.ofNullable(response)
        .map(FrankfurterResponse::rates)
        .map(rates -> rates.get(toCurrency))
        .orElseThrow(() -> new IllegalStateException(
            "No exchange rate available for %s to %s on %s".formatted(fromCurrency, toCurrency, date)));
  }

  private record CacheKey(String fromCurrency, String toCurrency, LocalDate date) {
  }

  private record CachedRate(BigDecimal rate, Instant expiresAt) {
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  record FrankfurterResponse(Map<String, BigDecimal> rates) {
  }
}
