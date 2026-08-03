package io.github.mucsi96.expensetracker.model;

import jakarta.validation.constraints.NotBlank;

public record BankNotificationRequest(
    @NotBlank String from,
    @NotBlank String to,
    String subject,
    @NotBlank String raw) {
}
