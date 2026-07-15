package io.github.mucsi96.expensetracker.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.expensetracker.model.ExpenseResponse;
import io.github.mucsi96.expensetracker.service.ExpenseService;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class ExpenseController {
  private final ExpenseService expenseService;

  @GetMapping("/expenses")
  @PreAuthorize("hasAuthority('APPROLE_ExpenseReader') and hasAuthority('SCOPE_readExpenses')")
  public List<ExpenseResponse> getExpenses() {
    return expenseService.getExpenses();
  }
}
