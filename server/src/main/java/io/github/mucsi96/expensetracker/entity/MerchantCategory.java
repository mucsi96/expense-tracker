package io.github.mucsi96.expensetracker.entity;

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

/**
 * Binds a merchant (the expense description) to a category. Recorded when a
 * transaction is categorized and applied to every expense at that merchant,
 * including newly imported ones.
 */
@Entity
@Table(name = "merchant_categories", schema = "expensetracker")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MerchantCategory {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true)
  private String merchant;

  @Column(nullable = false)
  private String category;
}
