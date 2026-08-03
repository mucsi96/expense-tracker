package io.github.mucsi96.expensetracker.service;

import java.time.Instant;

import org.springframework.stereotype.Service;

import io.github.mucsi96.expensetracker.entity.BankNotification;
import io.github.mucsi96.expensetracker.model.BankNotificationRequest;
import io.github.mucsi96.expensetracker.repository.BankNotificationRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class BankNotificationService {
  private final BankNotificationRepository bankNotificationRepository;

  public void store(BankNotificationRequest request) {
    bankNotificationRepository.save(BankNotification.builder()
        .receivedAt(Instant.now())
        .fromAddress(request.from())
        .toAddress(request.to())
        .subject(request.subject())
        .raw(request.raw())
        .build());
  }
}
