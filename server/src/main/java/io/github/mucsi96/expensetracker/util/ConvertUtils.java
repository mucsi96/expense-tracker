package io.github.mucsi96.expensetracker.util;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

public class ConvertUtils {
  private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy");
  private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");

  public static Optional<LocalDate> parseDate(String dateStr) {
    if (dateStr == null || dateStr.isEmpty()) {
      return Optional.empty();
    }

    return Optional.of(LocalDate.parse(dateStr, DATE_FORMATTER));
  }

  public static Optional<LocalTime> parseTime(String timeStr) {
    if (timeStr == null || timeStr.isEmpty()) {
      return Optional.empty();
    }

    return Optional.of(LocalTime.parse(timeStr, TIME_FORMATTER));
  }

  public static Optional<BigDecimal> toBigDecimal(String str) {
    if (str == null || str.isEmpty()) {
      return Optional.empty();
    }

    return Optional.of(new BigDecimal(str));
  }
}
