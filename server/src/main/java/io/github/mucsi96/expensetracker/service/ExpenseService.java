package io.github.mucsi96.expensetracker.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.expensetracker.entity.Expense;
import io.github.mucsi96.expensetracker.entity.MerchantCategory;
import io.github.mucsi96.expensetracker.model.ExpenseResponse;
import io.github.mucsi96.expensetracker.repository.CategoryRepository;
import io.github.mucsi96.expensetracker.repository.ExpenseRepository;
import io.github.mucsi96.expensetracker.repository.MerchantCategoryRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ExpenseService {
  private final ExpenseRepository expenseRepository;
  private final CategoryRepository categoryRepository;
  private final MerchantCategoryRepository merchantCategoryRepository;

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

  /**
   * Drops a single transaction, e.g. one that should not be tracked at all
   * instead of being categorized.
   */
  public void deleteExpense(Long id) {
    Expense expense = expenseRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Expense not found"));
    expenseRepository.delete(expense);
  }

  /**
   * Assigns a category to an expense and binds it to the expense's merchant
   * (the description): every other expense at the same merchant is
   * re-categorized too, and the binding is applied to future imports.
   */
  @Transactional
  public ExpenseResponse updateCategory(Long id, String category) {
    if (!categoryRepository.existsByName(category)) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Unknown category: " + category);
    }
    Expense expense = expenseRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Expense not found"));
    String merchant = expense.getDescription();
    if (merchant == null || merchant.isBlank()) {
      expense.setCategory(category);
    } else {
      merchantCategoryRepository.findByMerchant(merchant).ifPresentOrElse(
          binding -> binding.setCategory(category),
          () -> merchantCategoryRepository.save(
              MerchantCategory.builder().merchant(merchant).category(category).build()));
      expenseRepository.findByDescription(merchant)
          .forEach(sameMerchant -> sameMerchant.setCategory(category));
    }
    return toResponse(expense);
  }

  public int importExpenses(List<Expense> expenses) {
    Set<ExpenseKey> existingKeys = expenseRepository.findAll().stream()
        .map(ExpenseKey::of)
        .collect(Collectors.toSet());
    Map<String, String> boundCategories = merchantCategoryRepository.findAll().stream()
        .collect(Collectors.toMap(MerchantCategory::getMerchant, MerchantCategory::getCategory));
    List<Expense> newExpenses = expenses.stream()
        .filter(expense -> !existingKeys.contains(ExpenseKey.of(expense)))
        .map(expense -> withBoundCategory(expense, boundCategories))
        .toList();
    expenseRepository.saveAll(newExpenses);
    return newExpenses.size();
  }

  private static Expense withBoundCategory(Expense expense, Map<String, String> boundCategories) {
    String boundCategory = boundCategories.get(expense.getDescription());
    if ((expense.getCategory() == null || expense.getCategory().isBlank()) && boundCategory != null) {
      expense.setCategory(boundCategory);
    }
    return expense;
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
