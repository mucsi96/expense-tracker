package io.github.mucsi96.expensetracker.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.expensetracker.entity.Expense;
import io.github.mucsi96.expensetracker.model.ExpenseResponse;
import io.github.mucsi96.expensetracker.repository.CategoryRepository;
import io.github.mucsi96.expensetracker.repository.ExpenseRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ExpenseService {
  private final ExpenseRepository expenseRepository;
  private final CategoryRepository categoryRepository;

  public List<ExpenseResponse> getExpenses() {
    return expenseRepository.findAll().stream()
        .sorted(Comparator.comparing(Expense::getDate,
            Comparator.nullsLast(Comparator.reverseOrder())))
        .map(ExpenseService::toResponse)
        .toList();
  }

  public void deleteAllExpenses() {
    expenseRepository.deleteAllInBatch();
  }

  @Transactional
  public ExpenseResponse updateCategory(Long id, String category) {
    if (!categoryRepository.existsByName(category)) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Unknown category: " + category);
    }
    Expense expense = expenseRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Expense not found"));
    expense.setCategory(category);
    return toResponse(expense);
  }

  public int importExpenses(List<Expense> expenses) {
    Set<ExpenseKey> existingKeys = expenseRepository.findAll().stream()
        .map(ExpenseKey::of)
        .collect(Collectors.toSet());
    List<Expense> newExpenses = expenses.stream()
        .filter(expense -> !existingKeys.contains(ExpenseKey.of(expense)))
        .toList();
    expenseRepository.saveAll(newExpenses);
    return newExpenses.size();
  }

  private static ExpenseResponse toResponse(Expense expense) {
    return new ExpenseResponse(
        expense.getId(),
        expense.getDate(),
        expense.getDescription(),
        expense.getLocation(),
        expense.getCategory(),
        expense.getAmount(),
        expense.getCurrency(),
        expense.getConvertedAmount(),
        expense.getBaseCurrency(),
        expense.getMethod(),
        expense.getType(),
        expense.getComment());
  }

  /**
   * Identity of an expense for deduplication: same day, same description and
   * same whole amount count as the same expense regardless of source statement.
   */
  private record ExpenseKey(LocalDate date, String description, BigDecimal amount) {
    static ExpenseKey of(Expense expense) {
      return new ExpenseKey(
          toLocalDate(expense.getDate()),
          expense.getDescription(),
          expense.getAmount() == null ? null : expense.getAmount().setScale(0, RoundingMode.DOWN));
    }

    private static LocalDate toLocalDate(Instant instant) {
      return instant == null ? null : LocalDate.ofInstant(instant, ZoneOffset.UTC);
    }
  }
}
