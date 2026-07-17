package io.github.mucsi96.expensetracker.service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
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
 */
@Component
@Profile("!test")
public class FrankfurterExchangeRateProvider implements ExchangeRateProvider {
  private static final Duration CACHE_TTL = Duration.ofDays(1);

  private final RestClient restClient;
  private final Map<CacheKey, CachedRate> cache = new ConcurrentHashMap<>();

  public FrankfurterExchangeRateProvider(
      @Value("${expense-tracker.exchange-rate-api-url:https://api.frankfurter.dev/v1}") String baseUrl) {
    this.restClient = RestClient.builder().baseUrl(baseUrl).build();
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
  private record FrankfurterResponse(Map<String, BigDecimal> rates) {
  }
}
