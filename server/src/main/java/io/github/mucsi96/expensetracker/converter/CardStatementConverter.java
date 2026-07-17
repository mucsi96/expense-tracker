package io.github.mucsi96.expensetracker.converter;

import java.time.ZoneId;
import java.util.Optional;

import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import io.github.mucsi96.expensetracker.entity.Expense;
import io.github.mucsi96.expensetracker.enums.CSVType;
import io.github.mucsi96.expensetracker.model.CardStatement;
import io.github.mucsi96.expensetracker.service.CurrencyConversionService;
import io.github.mucsi96.expensetracker.util.ConvertUtils;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class CardStatementConverter {
  private final CurrencyConversionService currencyConversionService;

  public Optional<CardStatement> fromCSVRecord(CSVRecord record) {
    if (record.size() != 13 || String.join(";", record.values()).equals(CSVType.CARD_STATEMENT.getHeader())) {
      return Optional.empty();
    }

    try {
      return Optional.of(CardStatement.builder()
          .accountNumber(record.get(0))
          .cardNumber(record.get(1))
          .accountCardholder(record.get(2))
          .purchaseDate(ConvertUtils.parseDate(record.get(3)))
          .bookingText(record.get(4))
          .sector(record.get(5))
          .amount(ConvertUtils.toBigDecimal(record.get(6)))
          .originalCurrency(record.get(7))
          .rate(ConvertUtils.toBigDecimal(record.get(8)))
          .currency(record.get(9))
          .debit(ConvertUtils.toBigDecimal(record.get(10)))
          .credit(ConvertUtils.toBigDecimal(record.get(11)))
          .booked(Boolean.parseBoolean(record.get(12)))
          .build());
    } catch (Exception e) {
      return Optional.empty();
    }
  }

  public Expense toExpense(CardStatement cardStatement) {
    // "Amount"/"Original currency" hold what was actually spent; "Currency" is
    // the account's settlement currency. Store the original as-is (used for
    // duplicate detection) and the converted value for reporting.
    return Expense.builder()
        .date(cardStatement.purchaseDate()
            .map(date -> date.atStartOfDay(ZoneId.of("Europe/Zurich")).toInstant())
            .orElse(null))
        .description(cardStatement.bookingText())
        .location("")
        .category(cardStatement.sector())
        .amount(cardStatement.amount().orElse(null))
        .currency(cardStatement.originalCurrency())
        .convertedAmount(currencyConversionService.convertToBase(
            cardStatement.amount(), cardStatement.originalCurrency(), cardStatement.rate()).orElse(null))
        .baseCurrency(currencyConversionService.getBaseCurrency())
        .method("Card payment")
        .type(cardStatement.credit().isPresent() ? "Income" : "Expense")
        .comment("")
        .build();
  }
}
