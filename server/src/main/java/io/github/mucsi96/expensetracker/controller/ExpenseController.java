package io.github.mucsi96.expensetracker.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.expensetracker.model.ExpenseCategoryRequest;
import io.github.mucsi96.expensetracker.model.ExpenseResponse;
import io.github.mucsi96.expensetracker.service.ExpenseService;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class ExpenseController {
  private final ExpenseService expenseService;

  @GetMapping("/expenses")
  @PreAuthorize("hasAuthority('APPROLE_readExpenses')")
  public List<ExpenseResponse> getExpenses() {
    return expenseService.getExpenses();
  }

  @DeleteMapping("/expenses")
  @PreAuthorize("hasAuthority('APPROLE_deleteExpenses')")
  public void deleteExpenses() {
    expenseService.deleteAllExpenses();
  }

  @PutMapping("/expenses/{id}/category")
  @PreAuthorize("hasAuthority('APPROLE_createExpenses')")
  public ExpenseResponse updateCategory(@PathVariable Long id, @RequestBody ExpenseCategoryRequest request) {
    return expenseService.updateCategory(id, request.category());
  }
}
