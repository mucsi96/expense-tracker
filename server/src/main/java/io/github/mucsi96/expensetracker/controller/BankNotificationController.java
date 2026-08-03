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
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;

/**
 * Logs received bank card notification emails so the exact message format can
 * be captured from the logs. Parsing into expenses comes once the format is
 * known.
 */
@RestController
@Slf4j
public class BankNotificationController {

  @PostMapping("/bank-notifications")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void receive(@Valid @RequestBody BankNotificationRequest request) {
    log.info("Received bank notification from={} to={} subject={}\n{}",
        request.from(), request.to(), request.subject(), request.raw());
  }

  // Respond directly instead of dispatching to /error, which belongs to the
  // JWT filter chain and would turn a bad request into a 401.
  @ExceptionHandler({ MethodArgumentNotValidException.class, HttpMessageNotReadableException.class })
  ResponseEntity<Void> handleInvalidRequest() {
    return ResponseEntity.badRequest().build();
  }
}
