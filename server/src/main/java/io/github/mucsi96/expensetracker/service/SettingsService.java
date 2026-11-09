package io.github.mucsi96.expensetracker.service;

import java.math.BigDecimal;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.expensetracker.entity.Settings;
import io.github.mucsi96.expensetracker.model.SettingsRequest;
import io.github.mucsi96.expensetracker.model.SettingsResponse;
import io.github.mucsi96.expensetracker.repository.SettingsRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SettingsService {
  private final SettingsRepository settingsRepository;
  private final CurrencyConversionService currencyConversionService;

  public SettingsResponse getSettings() {
    return toResponse(requireSettings());
  }

  @Transactional
  public SettingsResponse updateSettings(SettingsRequest request) {
    Settings settings = requireSettings();
    settings.setClosingDay(requireValidClosingDay(request.closingDay()));
    // Older clients only send closingDay; preserve the budget in that case.
    if (request.monthlyBudget() != null) {
      settings.setMonthlyBudget(requireValidBudget(request.monthlyBudget()));
    }
    return toResponse(settings);
  }

  // The single settings row is seeded by the database migration; its absence
  // is a broken deployment, not a case to paper over
  private Settings requireSettings() {
    return settingsRepository.findAll().stream()
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("Settings row is missing"));
  }

  private static int requireValidClosingDay(Integer closingDay) {
    if (closingDay == null || closingDay < 1 || closingDay > 31) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Closing day must be between 1 and 31");
    }
    return closingDay;
  }

  private static BigDecimal requireValidBudget(BigDecimal budget) {
    if (budget.signum() < 0 || budget.compareTo(new BigDecimal("999999999.99")) > 0
        || budget.stripTrailingZeros().scale() > 2) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Monthly budget must be between 0 and 999999999.99 with at most two decimal places");
    }
    return budget;
  }

  private SettingsResponse toResponse(Settings settings) {
    return new SettingsResponse(settings.getClosingDay(), settings.getMonthlyBudget(),
        currencyConversionService.getBaseCurrency());
  }
}
