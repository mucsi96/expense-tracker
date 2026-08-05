package io.github.mucsi96.expensetracker.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.expensetracker.model.CategoryRequest;
import io.github.mucsi96.expensetracker.model.CategoryResponse;
import io.github.mucsi96.expensetracker.service.CategoryService;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class CategoryController {
  private final CategoryService categoryService;

  @GetMapping("/categories")
  @PreAuthorize("hasAuthority('APPROLE_ExpenseReader') and hasAuthority('SCOPE_readExpenses')")
  public List<CategoryResponse> getCategories() {
    return categoryService.getCategories();
  }

  @PostMapping("/categories")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAuthority('APPROLE_ExpenseReader') and hasAuthority('SCOPE_createExpenses')")
  public CategoryResponse createCategory(@RequestBody CategoryRequest request) {
    return categoryService.createCategory(request.name());
  }

  @PutMapping("/categories/{id}")
  @PreAuthorize("hasAuthority('APPROLE_ExpenseReader') and hasAuthority('SCOPE_createExpenses')")
  public CategoryResponse renameCategory(@PathVariable Long id, @RequestBody CategoryRequest request) {
    return categoryService.renameCategory(id, request.name());
  }

  @DeleteMapping("/categories/{id}")
  @PreAuthorize("hasAuthority('APPROLE_ExpenseReader') and hasAuthority('SCOPE_deleteExpenses')")
  public void deleteCategory(@PathVariable Long id) {
    categoryService.deleteCategory(id);
  }
}
