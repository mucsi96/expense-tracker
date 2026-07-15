package io.github.mucsi96.expensetracker.util;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

public class ConvertUtils {
  private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
      DateTimeFormatter.ofPattern("dd.MM.yyyy"),
      DateTimeFormatter.ISO_LOCAL_DATE);
  private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");

  public static Optional<LocalDate> parseDate(String dateStr) {
    if (dateStr == null || dateStr.isEmpty()) {
      return Optional.empty();
    }

    return Optional.of(DATE_FORMATTERS.stream()
        .flatMap(formatter -> {
          try {
            return Stream.of(LocalDate.parse(dateStr, formatter));
          } catch (DateTimeParseException e) {
            return Stream.empty();
          }
        })
        .findFirst()
        .orElseThrow(() -> new DateTimeParseException("Unsupported date format", dateStr, 0)));
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
