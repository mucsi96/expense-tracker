package io.github.mucsi96.expensetracker.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.mucsi96.expensetracker.entity.BankNotification;

public interface BankNotificationRepository extends JpaRepository<BankNotification, Long> {
}
