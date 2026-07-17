package io.github.mucsi96.expensetracker.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import io.github.mucsi96.expensetracker.converter.AccountStatementConverter;
import io.github.mucsi96.expensetracker.converter.CardStatementConverter;
import io.github.mucsi96.expensetracker.entity.Expense;
import io.github.mucsi96.expensetracker.enums.CSVType;

class UploadServiceTest {

  // Fixed rates so conversion is deterministic and independent of the rate the
  // statement itself carries (proving the exchange-rate service drives it).
  ExchangeRateProvider exchangeRateProvider = (from, to, date) -> new BigDecimal("0.95");
  CurrencyConversionService currencyConversionService = new CurrencyConversionService("CHF",
      exchangeRateProvider);
  UploadService uploadService = new UploadService(
      new AccountStatementConverter(currencyConversionService),
      new CardStatementConverter(currencyConversionService));

  static final String CARD_CSV = """
      sep=;
      Account number;Card number;Account/Cardholder;Purchase date;Booking text;Sector;Amount;Original currency;Rate;Currency;Debit;Credit;Booked
      3842 7186 6400;4901 18XX XXXX 5896;EVA BARI;15.07.2026;TWINT * Zürcher Verkehrsverbund - APP Zürich CHE;Commuter transportation;7.2;CHF;;CHF;;;
      3842 7186 6400;;;;Total per currency;;;;;CHF;7.2;;
      3842 7186 6400;;;;Total card bookings;;;;;CHF;7.2;;
      """;

  static final String ACCOUNT_CSV = """
      Account number:;0285 00110045.40;
      IBAN:;CH32 0028 5285 1100 4540 A;
      From:;2024-01-04;
      Until:;2026-07-14;
      Opening balance:;-96.18;
      Closing balance:;-590.19;
      Valued in:;CHF;
      Numbers of transactions in this period:;380;

      Trade date;Trade time;Booking date;Value date;Currency;Debit;Credit;Individual amount;Balance;Transaction no.;Description1;Description2;Description3;Footnotes;
      2026-07-14;;2026-07-14;2026-07-14;CHF;-225.00;;;-590.19;8385195TO9070959;"Gemeinde Birmensdorf ZH;Stallikonerstrasse 9; 8903 Birmensdorf; CH";e-banking payment order;"Reference no. QRR: 00 00000 00056 74011 11899 91005; Reason for payment: Rechnung Nr. 11118999; Account no. IBAN: CH90 3000 0002 8000 9900 6; Costs: E-Banking domestic; Transaction no. 8385195TO9070959";;
      """;

  static final String FOREIGN_CARD_CSV = """
      sep=;
      Account number;Card number;Account/Cardholder;Purchase date;Booking text;Sector;Amount;Original currency;Rate;Currency;Debit;Credit;Booked
      3842 7186 6400;5101 99XX XXXX 7324;IGOR BARI;25.04.2026;Aral Station 191329101   Passau       DEU;Gasoline service stations;162.15;EUR;0.95418677;CHF;154.72;;27.04.2026
      3842 7186 6400;5101 99XX XXXX 7324;IGOR BARI;25.04.2026;NH BUDAPEST CITY  CP H   BUDAPEST     HUN;Hotels;25.47;CHF;;CHF;25.47;;27.04.2026
      """;

  @Test
  void newCardFormat() {
    MockMultipartFile file = new MockMultipartFile("file", "card.csv", "text/csv",
        CARD_CSV.getBytes(StandardCharsets.ISO_8859_1));
    assertEquals(CSVType.CARD_STATEMENT, uploadService.detectCSVType(file).orElseThrow());
    var expenses = uploadService.parseExpenses(file, CSVType.CARD_STATEMENT);
    assertEquals(1, expenses.size());
    assertEquals("7.2", expenses.get(0).getAmount().toString());
    assertEquals("CHF", expenses.get(0).getCurrency());
    assertEquals("7.20", expenses.get(0).getConvertedAmount().toString());
    assertEquals("CHF", expenses.get(0).getBaseCurrency());
    assertEquals("Expense", expenses.get(0).getType());
  }

  @Test
  void convertsForeignCardAmountsToBaseCurrency() {
    MockMultipartFile file = new MockMultipartFile("file", "card.csv", "text/csv",
        FOREIGN_CARD_CSV.getBytes(StandardCharsets.ISO_8859_1));
    var expenses = uploadService.parseExpenses(file, CSVType.CARD_STATEMENT);
    assertEquals(2, expenses.size());

    // Foreign row: original amount/currency preserved, converted via the
    // exchange-rate service (0.95), not the statement's own rate (0.95418677).
    Expense foreign = expenses.get(0);
    assertEquals("162.15", foreign.getAmount().toString());
    assertEquals("EUR", foreign.getCurrency());
    assertEquals("154.04", foreign.getConvertedAmount().toString());
    assertEquals("CHF", foreign.getBaseCurrency());

    // Already-base-currency row: converted equals the original amount.
    Expense domestic = expenses.get(1);
    assertEquals("25.47", domestic.getAmount().toString());
    assertEquals("CHF", domestic.getCurrency());
    assertEquals("25.47", domestic.getConvertedAmount().toString());
    assertEquals("CHF", domestic.getBaseCurrency());
  }

  @Test
  void skipsSummaryRows() {
    MockMultipartFile file = new MockMultipartFile("file", "card.csv", "text/csv",
        CARD_CSV.getBytes(StandardCharsets.ISO_8859_1));
    var descriptions = uploadService.parseExpenses(file, CSVType.CARD_STATEMENT).stream()
        .map(expense -> expense.getDescription())
        .toList();
    assertEquals(List.of("TWINT * Zürcher Verkehrsverbund - APP Zürich CHE"), descriptions);
  }

  @Test
  void newAccountFormat() {
    MockMultipartFile file = new MockMultipartFile("file", "account.csv", "text/csv",
        ACCOUNT_CSV.getBytes(StandardCharsets.UTF_8));
    assertEquals(CSVType.ACCOUNT_STATEMENT, uploadService.detectCSVType(file).orElseThrow());
    var expenses = uploadService.parseExpenses(file, CSVType.ACCOUNT_STATEMENT);
    assertEquals(1, expenses.size());
    assertEquals("225.00", expenses.get(0).getAmount().toString());
    assertEquals("Expense", expenses.get(0).getType());
  }

  @Test
  void accountFixtureFile() throws Exception {
    byte[] bytes = Files.readAllBytes(Path.of("..", "test", "files", "account-statement.csv"));
    MockMultipartFile file = new MockMultipartFile("file", "account-statement.csv", "text/csv", bytes);
    assertEquals(CSVType.ACCOUNT_STATEMENT, uploadService.detectCSVType(file).orElseThrow());
    var expenses = uploadService.parseExpenses(file, CSVType.ACCOUNT_STATEMENT);
    assertEquals(2, expenses.size());
    assertEquals("Expense", expenses.get(0).getType());
    assertEquals("Income", expenses.get(1).getType());
    assertEquals("150.00", expenses.get(1).getAmount().toString());
  }

  @Test
  void cardFixtureFile() throws Exception {
    byte[] bytes = Files.readAllBytes(Path.of("..", "test", "files", "card-statement.csv"));
    MockMultipartFile file = new MockMultipartFile("file", "card-statement.csv", "text/csv", bytes);
    assertEquals(CSVType.CARD_STATEMENT, uploadService.detectCSVType(file).orElseThrow());
    var expenses = uploadService.parseExpenses(file, CSVType.CARD_STATEMENT);
    assertEquals(2, expenses.size());
    assertEquals("Expense", expenses.get(0).getType());

    Expense foreign = expenses.get(1);
    assertEquals("Lidl Konstanz", foreign.getDescription());
    assertEquals("20.00", foreign.getAmount().toString());
    assertEquals("EUR", foreign.getCurrency());
    assertEquals("19.00", foreign.getConvertedAmount().toString());
    assertEquals("CHF", foreign.getBaseCurrency());
  }
}
