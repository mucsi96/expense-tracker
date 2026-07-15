package io.github.mucsi96.expensetracker.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import io.github.mucsi96.expensetracker.enums.CSVType;

class UploadServiceTest {

  UploadService uploadService = new UploadService();

  static final String CARD_CSV = """
      sep=;
      Account number;Card number;Account/Cardholder;Purchase date;Booking text;Sector;Amount;Original currency;Rate;Currency;Debit;Credit;Booked
      3842 7186 6400;4901 18XX XXXX 5896;EVA BARI;15.07.2026;TWINT * Zürcher Verkehrsverbund - APP Zürich CHE;Commuter transportation;7.2;CHF;;CHF;;;
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

  @Test
  void newCardFormat() {
    MockMultipartFile file = new MockMultipartFile("file", "card.csv", "text/csv",
        CARD_CSV.getBytes(StandardCharsets.ISO_8859_1));
    assertEquals(CSVType.CARD_STATEMENT, uploadService.detectCSVType(file).orElseThrow());
    var expenses = uploadService.parseExpenses(file, CSVType.CARD_STATEMENT);
    assertEquals(1, expenses.size());
    assertEquals("7.2", expenses.get(0).getAmount().toString());
    assertEquals("Expense", expenses.get(0).getType());
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
    assertEquals(1, expenses.size());
    assertEquals("Expense", expenses.get(0).getType());
  }
}
