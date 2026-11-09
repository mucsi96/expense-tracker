package io.github.mucsi96.expensetracker.service;

import io.github.mucsi96.expensetracker.model.BankNotificationRequest;

/**
 * Thrown when a bank notification email does not match any recognized format.
 * The message carries the full email details (from, to, subject and raw
 * content) so logging it captures everything needed to extend the parser.
 */
public class UnparseableBankNotificationException extends RuntimeException {
  public UnparseableBankNotificationException(String reason, BankNotificationRequest request) {
    super("%s from=%s to=%s subject=%s\n%s".formatted(
        reason, request.from(), request.to(), request.subject(), request.raw()));
  }
}
