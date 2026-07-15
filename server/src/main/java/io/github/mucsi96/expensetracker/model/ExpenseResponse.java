package io.github.mucsi96.expensetracker.model;

import java.math.BigDecimal;
import java.time.Instant;

public record ExpenseResponse(
    Long id,
    Instant date,
    String description,
    String location,
    String category,
    BigDecimal amount,
    String currency,
    String method,
    String comment) {
}
