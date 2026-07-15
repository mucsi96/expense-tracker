package io.github.mucsi96.expensetracker.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import io.github.mucsi96.expensetracker.converter.AccountStatementConverter;
import io.github.mucsi96.expensetracker.converter.CardStatementConverter;
import io.github.mucsi96.expensetracker.entity.Expense;
import io.github.mucsi96.expensetracker.enums.CSVType;

@Service
public class UploadService {
  private static final CSVFormat CSV_FORMAT = CSVFormat.EXCEL.builder().setDelimiter(";").build();

  public Optional<CSVType> detectCSVType(MultipartFile file) {
    List<String> lines = withRecords(file, StandardCharsets.UTF_8, records -> records.stream()
        .map(record -> String.join(";", record.values()))
        .toList());

    return Arrays.stream(CSVType.values())
        .filter(type -> lines.stream().anyMatch(line -> line.equals(type.getHeader())))
        .findFirst();
  }

  public List<Expense> parseExpenses(MultipartFile file, CSVType type) {
    return switch (type) {
      case ACCOUNT_STATEMENT -> withRecords(file, StandardCharsets.UTF_8, records -> records.stream()
          .map(AccountStatementConverter::fromCSVRecord)
          .flatMap(Optional::stream)
          .map(AccountStatementConverter::toExpense)
          .toList());
      case CARD_STATEMENT -> withRecords(file, StandardCharsets.ISO_8859_1, records -> records.stream()
          .map(CardStatementConverter::fromCSVRecord)
          .flatMap(Optional::stream)
          .map(CardStatementConverter::toExpense)
          .toList());
    };
  }

  private <T> T withRecords(MultipartFile file, Charset charset, Function<List<CSVRecord>, T> mapper) {
    try (BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(file.getInputStream(), charset));
        CSVParser csvParser = new CSVParser(bufferedReader, CSV_FORMAT)) {
      return mapper.apply(csvParser.getRecords());
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to read CSV file", e);
    }
  }
}
