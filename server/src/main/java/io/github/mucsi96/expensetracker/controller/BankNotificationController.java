package io.github.mucsi96.expensetracker.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.expensetracker.model.BankNotificationRequest;
import io.github.mucsi96.expensetracker.service.BankNotificationService;
import io.github.mucsi96.expensetracker.service.UnparseableBankNotificationException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Receives bank card notification emails from the Cloudflare email worker and
 * stores each as an expense. A notification in an unrecognized format is
 * logged with all email details (as the endpoint originally did for format
 * capture) and rejected, so the worker fails the delivery and the format can
 * be added to the parser.
 */
@RestController
@RequiredArgsConstructor
@Slf4j
public class BankNotificationController {

  private final BankNotificationService bankNotificationService;

  @PostMapping("/bank-notifications")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void receive(@Valid @RequestBody BankNotificationRequest request) {
    bankNotificationService.store(request);
  }

  // Respond directly instead of dispatching to /error, which belongs to the
  // JWT filter chain and would turn the failure into a 401.
  @ExceptionHandler(UnparseableBankNotificationException.class)
  ResponseEntity<Void> handleUnparseable(UnparseableBankNotificationException exception) {
    log.error("Unrecognized bank notification: {}", exception.getMessage());
    return ResponseEntity.unprocessableEntity().build();
  }

  @ExceptionHandler({ MethodArgumentNotValidException.class, HttpMessageNotReadableException.class })
  ResponseEntity<Void> handleInvalidRequest() {
    return ResponseEntity.badRequest().build();
  }
}
