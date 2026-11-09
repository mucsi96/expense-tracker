package io.github.mucsi96.expensetracker.service;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Currency;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;

import io.github.mucsi96.expensetracker.entity.Expense;
import io.github.mucsi96.expensetracker.model.BankNotificationRequest;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Turns a bank card debit notification email (forwarded by the Cloudflare
 * email worker) into a "Card payment" expense.
 *
 * The HTML part of the raw MIME message is decoded (transfer encodings,
 * multipart), reduced to its text and the transaction is extracted from it.
 * Plain-text parts are ignored: the banks' notifications carry the
 * transaction only in HTML, while their sole plain-text part is a legal
 * disclaimer. The notification must be bracketed between
 * NOTIFICATION_CONTENT_BEGIN/END comment markers (as UBS does); only that
 * region is considered, so money values in headers, previews or footers
 * cannot shadow the transaction, and HTML without the markers is not
 * recognized. Extraction rules:
 * - amount: a labeled line ("Amount: CHF 12.50", "Betrag: ...") or the first
 *   "CHF 12.50" / "12.50 CHF" money value with a valid ISO 4217 code
 * - merchant: a labeled line ("Merchant: ...", "Händler: ...") or the
 *   "... CHF 12.50 at Coffee Shop ..." charge sentence, or the sentence
 *   following "CHF 12.50 have been charged to card "1234"."
 * - date: a labeled line ("Date: 04.08.2026 08:44") or the "on 04.08.2026"
 *   sentence, falling back to the email's Date header
 *
 * A notification where any of these cannot be extracted is not recognized and
 * fails fast with the full email details instead of being stored incomplete.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BankNotificationService {
  private static final ZoneId ZONE = ZoneId.of("Europe/Zurich");
  private static final DateTimeFormatter SWISS_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

  private static final String AMOUNT = "\\d[\\d'’]*(?:[.,]\\d{1,2})?";
  private static final String SPACE = "[\\s\\u00A0]*";
  private static final String MONEY = "(?:[A-Z]{3}" + SPACE + AMOUNT + "|" + AMOUNT + SPACE + "[A-Z]{3})";
  private static final String DATE = "(?:\\d{2}\\.\\d{2}\\.\\d{4}|\\d{4}-\\d{2}-\\d{2})"
      + "(?:[\\sT,]+(?:at\\s+|um\\s+)?\\d{2}:\\d{2}(?::\\d{2})?)?";

  private static final Pattern CURRENCY_FIRST = Pattern.compile("\\b([A-Z]{3})" + SPACE + "(" + AMOUNT + ")\\b");
  private static final Pattern AMOUNT_FIRST = Pattern.compile("\\b(" + AMOUNT + ")" + SPACE + "([A-Z]{3})\\b");
  private static final Pattern AMOUNT_LABEL = Pattern.compile(
      "(?im)^[ \\t]*(?:amount|betrag|montant|importo)[ \\t]*:[ \\t]*(.+)$");
  private static final Pattern MERCHANT_LABEL = Pattern.compile(
      "(?im)^[ \\t]*(?:merchant|h(?:ä|ae)ndler|commer[cç]ant|esercente)[ \\t]*:[ \\t]*(.+?)[ \\t]*$");
  private static final Pattern SENTENCE_MERCHANT = Pattern.compile(
      "(?i)" + MONEY + "\\s+(?:at|bei|chez|presso)\\s+(.+?)(?=\\s+(?:on|am|le|il)\\s+\\d|\\s*[.;\\r\\n]|\\s*$)");
  // UBS phrasing: the merchant is the sentence right after the charge
  // sentence: >CHF 7.00 have been charged to card "7324". Strandbad Baumen
  // Pfäffikon ZH CHE. Available amount: CHF 7'317.38.<
  private static final Pattern CHARGED_CARD_MERCHANT = Pattern.compile(
      "(?i)" + MONEY + "\\s+(?:has|have)\\s+been\\s+charged\\s+to\\s+(?:your\\s+)?card\\s+\"?[0-9Xx*]+\"?\\.\\s*"
          + "(.+?)(?=\\s*\\.(?:\\s|$)|\\s*[;\\r\\n]|\\s*$)");
  private static final Pattern DATE_LABEL = Pattern.compile(
      "(?im)^[ \\t]*(?:(?:transaction |purchase )?date|datum|data)[ \\t]*:[ \\t]*(.+)$");
  private static final Pattern SENTENCE_DATE = Pattern.compile(
      "(?i)\\b(?:on|am|le|il|vom)\\s+(" + DATE + ")");
  private static final Pattern DATE_VALUE = Pattern.compile(
      "(\\d{2}\\.\\d{2}\\.\\d{4}|\\d{4}-\\d{2}-\\d{2})(?:[\\sT,]+(?:at\\s+|um\\s+)?(\\d{2}:\\d{2}(?::\\d{2})?))?");
  private static final Pattern NOTIFICATION_CONTENT = Pattern.compile(
      "(?s)<!--\\s*NOTIFICATION_CONTENT_BEGIN\\s*-->(.*?)<!--\\s*NOTIFICATION_CONTENT_END\\s*-->");

  private final CurrencyConversionService currencyConversionService;
  private final ExpenseService expenseService;

  public void store(BankNotificationRequest request) {
    Email email = parse(request);
    String body = email.html()
        .orElseThrow(() -> new UnparseableBankNotificationException(
            "No HTML part found in bank notification", request))
        .transform(html -> matchGroup(NOTIFICATION_CONTENT, html))
        .map(BankNotificationService::htmlToText)
        .orElseThrow(() -> new UnparseableBankNotificationException(
            "No NOTIFICATION_CONTENT markers found in bank notification", request));

    ParsedAmount amount = findAmount(body)
        .or(() -> findAmount(Optional.ofNullable(request.subject()).orElse("")))
        .orElseThrow(() -> new UnparseableBankNotificationException(
            "No amount with an ISO currency code found in bank notification", request));

    String merchant = findMerchant(body)
        .orElseThrow(() -> new UnparseableBankNotificationException(
            "No merchant found in bank notification", request));

    ZonedDateTime transactionTime = findDate(body)
        .or(() -> email.sentDate().map(sentDate -> sentDate.toInstant().atZone(ZONE)))
        .orElseThrow(() -> new UnparseableBankNotificationException(
            "No transaction date found in bank notification", request));

    Expense expense = Expense.builder()
        .date(transactionTime.toInstant())
        .description(merchant)
        .location("")
        .category("")
        .amount(amount.value())
        .currency(amount.currency())
        .convertedAmount(currencyConversionService.convertToBase(
            Optional.of(amount.value()), amount.currency(), Optional.of(transactionTime.toLocalDate()))
            .orElse(null))
        .baseCurrency(currencyConversionService.getBaseCurrency())
        .method("Card payment")
        .type("Expense")
        .comment("")
        .build();

    // Duplicate detection also swallows redelivery of the same email
    int imported = expenseService.importExpenses(List.of(expense));
    log.info("Bank notification from={} subject={} parsed as {} {} at {} on {} ({})",
        request.from(), request.subject(), amount.currency(), amount.value(), merchant,
        transactionTime, imported == 0 ? "duplicate, skipped" : "stored");
  }

  private record Email(Optional<Date> sentDate, Optional<String> html) {
  }

  private record ParsedAmount(BigDecimal value, String currency) {
  }

  private static Email parse(BankNotificationRequest request) {
    try {
      MimeMessage message = new MimeMessage(Session.getInstance(new Properties()),
          new ByteArrayInputStream(request.raw().getBytes(StandardCharsets.UTF_8)));
      return new Email(Optional.ofNullable(message.getSentDate()),
          Optional.ofNullable(findHtml(message)));
    } catch (Exception e) {
      throw new UnparseableBankNotificationException(
          "Bank notification is not a readable MIME message (%s)".formatted(e), request);
    }
  }

  private static String findHtml(Part part) {
    try {
      if (part.isMimeType("text/html") && part.getContent() instanceof String html) {
        return html;
      }
      if (part.getContent() instanceof Multipart multipart) {
        for (int i = 0; i < multipart.getCount(); i++) {
          String html = findHtml(multipart.getBodyPart(i));
          if (html != null) {
            return html;
          }
        }
      }
      return null;
    } catch (Exception e) {
      return null;
    }
  }

  private static String htmlToText(String html) {
    return html
        .replaceAll("(?is)<(style|script|head)\\b[^>]*>.*?</\\1>", " ")
        .replaceAll("(?s)<!--.*?-->", " ")
        .replaceAll("(?i)<br[^>]*>", "\n")
        .replaceAll("(?i)</(?:p|div|li|td|th|tr|table|h[1-6]|blockquote)>", "\n")
        .replaceAll("<[^>]+>", " ")
        .replace("&nbsp;", " ")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replaceAll("[ \\t]+", " ")
        .replaceAll(" ?\\n ?", "\n")
        .trim();
  }

  private static Optional<ParsedAmount> findAmount(String text) {
    return matchGroup(AMOUNT_LABEL, text)
        .flatMap(BankNotificationService::findMoney)
        .or(() -> findMoney(text));
  }

  private static Optional<ParsedAmount> findMoney(String text) {
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
      // Negative fraction digits mark ISO 4217 pseudo-currencies (XXX, XAU,
      // ...), which would otherwise let masked card numbers like "XXXX 5896"
      // pass as money values.
      if (Currency.getInstance(currencyCode).getDefaultFractionDigits() < 0) {
        return Optional.empty();
      }
    } catch (IllegalArgumentException e) {
      return Optional.empty();
    }

    return Optional.of(new ParsedAmount(
        new BigDecimal(value.replaceAll("['’]", "").replace(',', '.')),
        currencyCode));
  }

  private static Optional<String> findMerchant(String text) {
    return matchGroup(MERCHANT_LABEL, text)
        .or(() -> matchGroup(SENTENCE_MERCHANT, text))
        .or(() -> matchGroup(CHARGED_CARD_MERCHANT, text))
        .filter(merchant -> !merchant.isBlank());
  }

  private static Optional<ZonedDateTime> findDate(String text) {
    return matchGroup(DATE_LABEL, text)
        .or(() -> matchGroup(SENTENCE_DATE, text))
        .flatMap(BankNotificationService::parseDateTime);
  }

  private static Optional<ZonedDateTime> parseDateTime(String value) {
    Matcher matcher = DATE_VALUE.matcher(value);
    if (!matcher.find()) {
      return Optional.empty();
    }

    LocalDate date = matcher.group(1).contains(".")
        ? LocalDate.parse(matcher.group(1), SWISS_DATE)
        : LocalDate.parse(matcher.group(1));
    LocalTime time = Optional.ofNullable(matcher.group(2))
        .map(LocalTime::parse)
        .orElse(LocalTime.MIDNIGHT);
    return Optional.of(date.atTime(time).atZone(ZONE));
  }

  private static Optional<String> matchGroup(Pattern pattern, String text) {
    Matcher matcher = pattern.matcher(text);
    return matcher.find() ? Optional.of(matcher.group(1).trim()) : Optional.empty();
  }
}
