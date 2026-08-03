package io.github.mucsi96.expensetracker.service;

public class UnparseableBankNotificationException extends RuntimeException {
  public UnparseableBankNotificationException(String message) {
    super(message);
  }
}
