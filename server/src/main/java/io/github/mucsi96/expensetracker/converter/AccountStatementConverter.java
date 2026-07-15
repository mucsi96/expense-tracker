package io.github.mucsi96.expensetracker.converter;

import java.time.ZoneId;
import java.util.Optional;

import org.apache.commons.csv.CSVRecord;

import io.github.mucsi96.expensetracker.entity.Expense;
import io.github.mucsi96.expensetracker.enums.CSVType;
import io.github.mucsi96.expensetracker.model.AccountStatement;
import io.github.mucsi96.expensetracker.util.ConvertUtils;

public class AccountStatementConverter {
  public static Optional<AccountStatement> fromCSVRecord(CSVRecord record) {
    if (record.size() != 14 || String.join(";", record.values()).equals(CSVType.ACCOUNT_STATEMENT.getHeader())) {
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

  public static Expense toExpense(AccountStatement accountStatement) {
    return Expense.builder()
        .date(accountStatement.tradeDate()
            .map(date -> date.atStartOfDay(ZoneId.of("Europe/Zurich")).toInstant())
            .orElse(null))
        .description(accountStatement.description1())
        .location("")
        .category("")
        .amount(accountStatement.individualAmount().orElse(null))
        .currency(accountStatement.currency())
        .method("Direct payment")
        .comment(accountStatement.description2())
        .build();
  }
}
