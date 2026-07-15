package io.github.mucsi96.expensetracker.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

import lombok.Builder;

@Builder
public record AccountStatement(
    Optional<LocalDate> tradeDate,
    Optional<LocalTime> tradeTime,
    Optional<LocalDate> bookingDate,
    Optional<LocalDate> valueDate,
    String currency,
    Optional<BigDecimal> debit,
    Optional<BigDecimal> credit,
    Optional<BigDecimal> individualAmount,
    Optional<BigDecimal> balance,
    String transactionNo,
    String description1,
    String description2,
    String description3,
    String footnotes) {
}
