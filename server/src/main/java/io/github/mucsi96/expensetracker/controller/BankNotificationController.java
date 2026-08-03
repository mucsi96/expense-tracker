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

@RestController
@RequiredArgsConstructor
public class BankNotificationController {
  private final BankNotificationService bankNotificationService;

  @PostMapping("/bank-notifications")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void receive(@Valid @RequestBody BankNotificationRequest request) {
    bankNotificationService.store(request);
  }

  // Respond directly instead of dispatching to /error, which belongs to the
  // JWT filter chain and would turn a bad request into a 401.
  @ExceptionHandler({
      MethodArgumentNotValidException.class,
      HttpMessageNotReadableException.class,
      UnparseableBankNotificationException.class })
  ResponseEntity<Void> handleInvalidRequest() {
    return ResponseEntity.badRequest().build();
  }
}
