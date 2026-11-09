package io.github.mucsi96.expensetracker.model;

import java.math.BigDecimal;

public record SettingsRequest(Integer closingDay, BigDecimal monthlyBudget) {
}
