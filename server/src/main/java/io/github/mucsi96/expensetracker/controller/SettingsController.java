package io.github.mucsi96.expensetracker.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.expensetracker.model.SettingsRequest;
import io.github.mucsi96.expensetracker.model.SettingsResponse;
import io.github.mucsi96.expensetracker.service.SettingsService;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class SettingsController {
  private final SettingsService settingsService;

  @GetMapping("/settings")
  @PreAuthorize("hasAuthority('APPROLE_readExpenses')")
  public SettingsResponse getSettings() {
    return settingsService.getSettings();
  }

  @PutMapping("/settings")
  @PreAuthorize("hasAuthority('APPROLE_createExpenses')")
  public SettingsResponse updateSettings(@RequestBody SettingsRequest request) {
    return settingsService.updateSettings(request);
  }
}
