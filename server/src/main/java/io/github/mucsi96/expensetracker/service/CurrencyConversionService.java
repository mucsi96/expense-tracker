package io.github.mucsi96.expensetracker.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Converts statement amounts into the configured base (reporting) currency.
 *
 * Bank/card statements already carry the exchange rate that was applied to the
 * transaction (the most accurate figure available - it is exactly what was
 * charged), so conversion multiplies the original amount by that rate rather
 * than re-deriving it from an external service. When the original currency
 * already matches the base currency no rate is needed. A foreign amount without
 * a rate cannot be converted and fails fast.
 */
@Service
public class CurrencyConversionService {
  private static final int SCALE = 2;

  private final String baseCurrency;

  public CurrencyConversionService(
      @Value("${expense-tracker.base-currency:CHF}") String baseCurrency) {
    this.baseCurrency = baseCurrency;
  }

  public String getBaseCurrency() {
    return baseCurrency;
  }

  public Optional<BigDecimal> convertToBase(Optional<BigDecimal> amount, String currency,
      Optional<BigDecimal> rate) {
    return amount.map(value -> {
      if (baseCurrency.equalsIgnoreCase(currency)) {
        return value.setScale(SCALE, RoundingMode.HALF_UP);
      }

      BigDecimal effectiveRate = rate.orElseThrow(() -> new IllegalArgumentException(
          "Missing exchange rate to convert %s to %s".formatted(currency, baseCurrency)));

      return value.multiply(effectiveRate).setScale(SCALE, RoundingMode.HALF_UP);
    });
  }
}
