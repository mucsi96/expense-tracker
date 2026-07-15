package io.github.mucsi96.expensetracker.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import lombok.Builder;

@Builder
public record CardStatement(
    String accountNumber,
    String cardNumber,
    String accountCardholder,
    Optional<LocalDate> purchaseDate,
    String bookingText,
    String sector,
    Optional<BigDecimal> amount,
    String originalCurrency,
    Optional<BigDecimal> rate,
    String currency,
    Optional<BigDecimal> debit,
    Optional<BigDecimal> credit,
    boolean booked) {
}
