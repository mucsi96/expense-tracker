package io.github.mucsi96.expensetracker.service;

import java.math.BigDecimal;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Currency;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;

import io.github.mucsi96.expensetracker.entity.Expense;
import io.github.mucsi96.expensetracker.model.BankNotificationRequest;
import lombok.RequiredArgsConstructor;

/**
 * Turns a bank card notification email into an expense. The amount is the
 * first "CHF 12.50" / "12.50 CHF" style money value (with a valid ISO 4217
 * currency code) found in the subject or body; the subject becomes the
 * description and the arrival time the expense date. A notification without a
 * recognizable amount fails fast instead of being stored incomplete.
 */
@Service
@RequiredArgsConstructor
public class BankNotificationService {
  private static final ZoneId ZONE = ZoneId.of("Europe/Zurich");
  private static final String AMOUNT = "\\d[\\d'’]*(?:[.,]\\d{1,2})?";
  private static final String SPACE = "[\\s\\u00A0]*";
  private static final Pattern CURRENCY_FIRST = Pattern.compile("\\b([A-Z]{3})" + SPACE + "(" + AMOUNT + ")\\b");
  private static final Pattern AMOUNT_FIRST = Pattern.compile("\\b(" + AMOUNT + ")" + SPACE + "([A-Z]{3})\\b");

  private final CurrencyConversionService currencyConversionService;
  private final ExpenseService expenseService;

  public void store(BankNotificationRequest request) {
    ParsedAmount amount = Stream.of(request.subject(), request.raw())
        .map(BankNotificationService::findAmount)
        .flatMap(Optional::stream)
        .findFirst()
        .orElseThrow(() -> new UnparseableBankNotificationException(
            "No amount with an ISO currency code found in bank notification"));

    ZonedDateTime receivedAt = ZonedDateTime.now(ZONE);

    Expense expense = Expense.builder()
        .date(receivedAt.toInstant())
        .description(request.subject())
        .location("")
        .category("")
        .amount(amount.value())
        .currency(amount.currency())
        .convertedAmount(currencyConversionService.convertToBase(
            Optional.of(amount.value()), amount.currency(), Optional.of(receivedAt.toLocalDate())).orElse(null))
        .baseCurrency(currencyConversionService.getBaseCurrency())
        .method("Card payment")
        .type("Expense")
        .comment("")
        .build();

    // Duplicate detection also swallows redelivery of the same email
    expenseService.importExpenses(List.of(expense));
  }

  private static Optional<ParsedAmount> findAmount(String text) {
    return Stream.of(matches(CURRENCY_FIRST, text, 2, 1), matches(AMOUNT_FIRST, text, 1, 2))
        .flatMap(candidates -> candidates)
        .findFirst();
  }

  private static Stream<ParsedAmount> matches(Pattern pattern, String text, int valueGroup, int currencyGroup) {
    Matcher matcher = pattern.matcher(text);
    return matcher.results()
        .map(result -> toParsedAmount(result.group(valueGroup), result.group(currencyGroup)))
        .flatMap(Optional::stream);
  }

  private static Optional<ParsedAmount> toParsedAmount(String value, String currencyCode) {
    try {
      Currency.getInstance(currencyCode);
    } catch (IllegalArgumentException e) {
      return Optional.empty();
    }

    return Optional.of(new ParsedAmount(
        new BigDecimal(value.replaceAll("['’]", "").replace(',', '.')),
        currencyCode));
  }

  private record ParsedAmount(BigDecimal value, String currency) {
  }
}
