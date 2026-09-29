package io.github.mucsi96.expensetracker.entity;

import java.math.BigDecimal;
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
@Table(name = "settings", schema = "expensetracker")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Settings {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "closing_day")
  private Integer closingDay;

  @Column(name = "monthly_budget", precision = 11, scale = 2)
  private BigDecimal monthlyBudget;
}
