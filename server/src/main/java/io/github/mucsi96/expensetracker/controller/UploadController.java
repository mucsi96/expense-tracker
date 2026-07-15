package io.github.mucsi96.expensetracker.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.expensetracker.enums.CSVType;
import io.github.mucsi96.expensetracker.model.UploadResponse;
import io.github.mucsi96.expensetracker.service.ExpenseService;
import io.github.mucsi96.expensetracker.service.UploadService;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class UploadController {
  private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

  private final UploadService uploadService;
  private final ExpenseService expenseService;

  @PostMapping("/upload")
  @PreAuthorize("hasAuthority('APPROLE_ExpenseReader') and hasAuthority('SCOPE_createExpenses')")
  public UploadResponse upload(@RequestParam("file") MultipartFile file) {
    if (file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please select a file to upload");
    }

    if (file.getSize() > MAX_FILE_SIZE) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File size must be less than 10MB");
    }

    String originalFilename = file.getOriginalFilename();
    if (originalFilename == null || !originalFilename.endsWith(".csv")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File extension must be CSV");
    }

    CSVType type = uploadService.detectCSVType(file)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported CSV header"));

    return new UploadResponse(expenseService.importExpenses(uploadService.parseExpenses(file, type)));
  }
}
