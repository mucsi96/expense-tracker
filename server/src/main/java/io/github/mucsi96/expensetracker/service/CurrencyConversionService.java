package io.github.mucsi96.expensetracker.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Converts statement amounts into the configured base (reporting) currency.
 *
 * Amounts already in the base currency are kept as-is. Foreign amounts are
 * converted using the exchange rate for the transaction date obtained from an
 * {@link ExchangeRateProvider}. A foreign amount without a date cannot be
 * converted and fails fast rather than being silently treated as base currency.
 */
@Service
public class CurrencyConversionService {
  private static final int SCALE = 2;

  private final String baseCurrency;
  private final ExchangeRateProvider exchangeRateProvider;

  public CurrencyConversionService(
      @Value("${expense-tracker.base-currency:CHF}") String baseCurrency,
      ExchangeRateProvider exchangeRateProvider) {
    this.baseCurrency = baseCurrency;
    this.exchangeRateProvider = exchangeRateProvider;
  }

  public String getBaseCurrency() {
    return baseCurrency;
  }

  public Optional<BigDecimal> convertToBase(Optional<BigDecimal> amount, String currency,
      Optional<LocalDate> date) {
    return amount.map(value -> {
      if (baseCurrency.equalsIgnoreCase(currency)) {
        return value.setScale(SCALE, RoundingMode.HALF_UP);
      }

      LocalDate rateDate = date.orElseThrow(() -> new IllegalArgumentException(
          "Cannot convert %s to %s without a transaction date".formatted(currency, baseCurrency)));

      BigDecimal rate = exchangeRateProvider.getRate(currency, baseCurrency, rateDate);
      return value.multiply(rate).setScale(SCALE, RoundingMode.HALF_UP);
    });
  }
}
