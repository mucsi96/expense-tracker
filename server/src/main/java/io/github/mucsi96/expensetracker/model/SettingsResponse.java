package io.github.mucsi96.expensetracker.model;

import java.math.BigDecimal;

public record SettingsResponse(int closingDay, BigDecimal monthlyBudget, String baseCurrency) {
}
