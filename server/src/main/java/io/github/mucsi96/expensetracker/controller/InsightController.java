package io.github.mucsi96.expensetracker.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.expensetracker.model.InsightResponse;
import io.github.mucsi96.expensetracker.service.InsightService;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class InsightController {
  private final InsightService insightService;

  @GetMapping("/insight")
  @PreAuthorize("hasAuthority('APPROLE_ExpenseReader') and hasAuthority('SCOPE_readExpenses')")
  public InsightResponse getInsight() {
    return insightService.getInsight();
  }
}
