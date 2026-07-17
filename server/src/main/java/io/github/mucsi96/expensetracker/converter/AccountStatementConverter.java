package io.github.mucsi96.expensetracker.converter;

import java.math.BigDecimal;
import java.time.ZoneId;
import java.util.Optional;

import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import io.github.mucsi96.expensetracker.entity.Expense;
import io.github.mucsi96.expensetracker.enums.CSVType;
import io.github.mucsi96.expensetracker.model.AccountStatement;
import io.github.mucsi96.expensetracker.service.CurrencyConversionService;
import io.github.mucsi96.expensetracker.util.ConvertUtils;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class AccountStatementConverter {
  private final CurrencyConversionService currencyConversionService;

  public Optional<AccountStatement> fromCSVRecord(CSVRecord record) {
    // Rows carry 14 columns; newer exports terminate every row with a
    // separator, which parses as a 15th empty column.
    if ((record.size() != 14 && record.size() != 15)
        || String.join(";", record.values()).equals(CSVType.ACCOUNT_STATEMENT.getHeader())) {
      return Optional.empty();
    }

    try {
      return Optional.of(AccountStatement.builder()
          .tradeDate(ConvertUtils.parseDate(record.get(0)))
          .tradeTime(ConvertUtils.parseTime(record.get(1)))
          .bookingDate(ConvertUtils.parseDate(record.get(2)))
          .valueDate(ConvertUtils.parseDate(record.get(3)))
          .currency(record.get(4))
          .debit(ConvertUtils.toBigDecimal(record.get(5)))
          .credit(ConvertUtils.toBigDecimal(record.get(6)))
          .individualAmount(ConvertUtils.toBigDecimal(record.get(7)))
          .balance(ConvertUtils.toBigDecimal(record.get(8)))
          .transactionNo(record.get(9))
          .description1(record.get(10))
          .description2(record.get(11))
          .description3(record.get(12))
          .footnotes(record.get(13))
          .build());
    } catch (Exception e) {
      return Optional.empty();
    }
  }

  public Expense toExpense(AccountStatement accountStatement) {
    Optional<BigDecimal> amount = resolveAmount(accountStatement);
    return Expense.builder()
        .date(accountStatement.tradeDate()
            .map(date -> date.atStartOfDay(ZoneId.of("Europe/Zurich")).toInstant())
            .orElse(null))
        .description(accountStatement.description1())
        .location("")
        .category("")
        .amount(amount.orElse(null))
        .currency(accountStatement.currency())
        .convertedAmount(currencyConversionService.convertToBase(
            amount, accountStatement.currency(), accountStatement.tradeDate()).orElse(null))
        .baseCurrency(currencyConversionService.getBaseCurrency())
        .method("Direct payment")
        .type(accountStatement.credit().isPresent() ? "Income" : "Expense")
        .comment(accountStatement.description2())
        .build();
  }

  // Newer exports leave "Individual amount" empty and carry the signed value
  // in the Debit (or Credit) column instead.
  private static Optional<BigDecimal> resolveAmount(AccountStatement accountStatement) {
    return accountStatement.individualAmount()
        .or(() -> accountStatement.debit().map(BigDecimal::abs))
        .or(() -> accountStatement.credit().map(BigDecimal::abs));
  }
}
