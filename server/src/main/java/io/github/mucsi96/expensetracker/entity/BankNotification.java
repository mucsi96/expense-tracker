package io.github.mucsi96.expensetracker.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "bank_notifications", schema = "expensetracker")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BankNotification {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "received_at")
  private Instant receivedAt;

  @Column(name = "from_address")
  private String fromAddress;

  @Column(name = "to_address")
  private String toAddress;

  private String subject;

  private String raw;
}
