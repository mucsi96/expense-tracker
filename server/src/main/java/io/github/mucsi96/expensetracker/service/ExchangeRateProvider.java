package io.github.mucsi96.expensetracker.service;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Supplies the exchange rate to multiply a {@code fromCurrency} amount by to get
 * its value in {@code toCurrency} on a given date.
 */
@FunctionalInterface
public interface ExchangeRateProvider {
  BigDecimal getRate(String fromCurrency, String toCurrency, LocalDate date);
}
