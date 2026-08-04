package io.github.mucsi96.expensetracker.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import io.github.mucsi96.expensetracker.entity.Expense;
import io.github.mucsi96.expensetracker.model.BankNotificationRequest;
import io.github.mucsi96.expensetracker.repository.ExpenseRepository;

class BankNotificationServiceTest {

  ExchangeRateProvider exchangeRateProvider = (from, to, date) -> new BigDecimal("0.95");
  CurrencyConversionService currencyConversionService = new CurrencyConversionService("CHF",
      exchangeRateProvider);
  ExpenseRepository expenseRepository = mock(ExpenseRepository.class);
  ExpenseService expenseService = new ExpenseService(expenseRepository);
  BankNotificationService bankNotificationService = new BankNotificationService(
      currencyConversionService, expenseService);

  // Same shape as the real card debit notification: multipart/mixed with a
  // quoted-printable HTML part carrying the transaction (soft line breaks
  // splitting the merchant name, ’ as =E2=80=99 in the balance) and a
  // plain-text part holding only the legal disclaimer. The decoy money value
  // in the hidden preview sits outside the NOTIFICATION_CONTENT markers and
  // must not be picked up as the amount.
  static final String RAW = String.join("\r\n",
      "Received: from mail.bank.example (203.0.113.10)",
      "        by email-forwarder.example (forwarder) id AbCdEf123456",
      "        for <expenses@user.example>; Tue, 04 Aug 2026 16:39:01 +0000",
      "Date: Tue, 4 Aug 2026 17:37:23 +0200 (CEST)",
      "From: Example Bank <noreply-alerting@bank.example>",
      "To: expenses@user.example",
      "Subject: Example Bank Digital Banking: Card debit",
      "MIME-Version: 1.0",
      "Content-Type: multipart/mixed; boundary=\"----=_notification\"",
      "",
      "------=_notification",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "<html><head><style type=3D\"text/css\">body { margin:0; }</style></head>",
      "<body><div style=3D\"display:none\">Example Bank Digital Banking: Card deb=",
      "it - annual fee CHF 99.99</div>",
      "<table><tr><td>Hello,<br><br>",
      "<!-- NOTIFICATION_CONTENT_BEGIN -->",
      "CHF 7.00 have been charged to card \"7324\". Stra=",
      "ndbad Baumen Pf=C3=A4ffikon ZH CHE. Available amount: CHF 7=E2=80=99317.38.",
      "<!-- NOTIFICATION_CONTENT_END -->",
      "<br><br>Kind regards,<br>Example Bank AG</td></tr></table></body></html>",
      "------=_notification",
      "Content-Type: text/plain; charset=us-ascii; name=\"disclaim.txt\"",
      "Content-Transfer-Encoding: 7bit",
      "Content-Disposition: inline",
      "Content-Description: Legal Disclaimer",
      "",
      "This message contains confidential information and is intended only",
      "for the individual named.",
      "------=_notification--",
      "");

  static final BankNotificationRequest REQUEST = new BankNotificationRequest(
      "noreply-alerting@bank.example",
      "expenses@user.example",
      "Example Bank Digital Banking: Card debit",
      RAW);

  @Test
  void extractsTransactionFromHtmlPart() {
    when(expenseRepository.findAll()).thenReturn(List.of());

    bankNotificationService.store(REQUEST);

    ArgumentCaptor<List<Expense>> captor = ArgumentCaptor.captor();
    verify(expenseRepository).saveAll(captor.capture());
    List<Expense> saved = captor.getValue();
    assertEquals(1, saved.size());
    Expense expense = saved.get(0);
    assertEquals("Strandbad Baumen Pfäffikon ZH CHE", expense.getDescription());
    assertEquals(new BigDecimal("7.00"), expense.getAmount());
    assertEquals("CHF", expense.getCurrency());
    assertEquals(new BigDecimal("7.00"), expense.getConvertedAmount());
    assertEquals("CHF", expense.getBaseCurrency());
    assertEquals("Card payment", expense.getMethod());
    assertEquals("Expense", expense.getType());
    // No date in the body, so the email's Date header (17:37:23 +0200) is used
    assertEquals(Instant.parse("2026-08-04T15:37:23Z"), expense.getDate());
  }

  @Test
  void extractsTransactionFromHtmlWithoutContentMarkers() {
    when(expenseRepository.findAll()).thenReturn(List.of());

    BankNotificationRequest noMarkers = new BankNotificationRequest(
        REQUEST.from(), REQUEST.to(), REQUEST.subject(),
        String.join("\r\n",
            "Date: Tue, 4 Aug 2026 17:37:23 +0200",
            "From: Example Bank <noreply-alerting@bank.example>",
            "Subject: Example Bank Digital Banking: Card debit",
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=UTF-8",
            "",
            "<html><body><p>Date: 04.08.2026 08:44:12<br>Amount: CHF 12.50<br>",
            "Merchant: COFFEE SHOP ZUERICH</p></body></html>",
            ""));

    bankNotificationService.store(noMarkers);

    ArgumentCaptor<List<Expense>> captor = ArgumentCaptor.captor();
    verify(expenseRepository).saveAll(captor.capture());
    List<Expense> saved = captor.getValue();
    assertEquals(1, saved.size());
    assertEquals("COFFEE SHOP ZUERICH", saved.get(0).getDescription());
    assertEquals(new BigDecimal("12.50"), saved.get(0).getAmount());
    assertEquals(Instant.parse("2026-08-04T06:44:12Z"), saved.get(0).getDate());
  }

  @Test
  void rejectsNotificationWithoutHtmlPart() {
    BankNotificationRequest plainOnly = new BankNotificationRequest(
        REQUEST.from(), REQUEST.to(), REQUEST.subject(),
        String.join("\r\n",
            "Date: Tue, 4 Aug 2026 17:37:23 +0200",
            "From: Example Bank <noreply-alerting@bank.example>",
            "Subject: Example Bank Digital Banking: Card debit",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=UTF-8",
            "",
            "Amount: CHF 12.50",
            "Merchant: COFFEE SHOP ZUERICH",
            "Date: 04.08.2026 08:44:12",
            ""));

    assertThrows(UnparseableBankNotificationException.class,
        () -> bankNotificationService.store(plainOnly));
  }
}
