package io.github.mucsi96.expensetracker.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Deterministic exchange rates for the test profile so E2E statement imports
 * never depend on a live FX API. Fails fast on any unexpected pair.
 */
@Component
@Profile("test")
public class StubExchangeRateProvider implements ExchangeRateProvider {
  private static final Map<String, BigDecimal> RATES_TO_CHF = Map.of(
      "EUR", new BigDecimal("0.95"),
      "USD", new BigDecimal("0.90"),
      "HUF", new BigDecimal("0.0026"));

  @Override
  public BigDecimal getRate(String fromCurrency, String toCurrency, LocalDate date) {
    if (!"CHF".equalsIgnoreCase(toCurrency)) {
      throw new IllegalArgumentException("Stub only converts to CHF, requested " + toCurrency);
    }

    return Optional.ofNullable(RATES_TO_CHF.get(fromCurrency.toUpperCase()))
        .orElseThrow(() -> new IllegalArgumentException("No stub exchange rate for " + fromCurrency));
  }
}
