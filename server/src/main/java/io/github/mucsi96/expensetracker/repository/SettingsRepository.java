package io.github.mucsi96.expensetracker.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.mucsi96.expensetracker.entity.Settings;

public interface SettingsRepository extends JpaRepository<Settings, Long> {
}
