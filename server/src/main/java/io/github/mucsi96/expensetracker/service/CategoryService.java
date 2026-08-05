package io.github.mucsi96.expensetracker.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.expensetracker.entity.Category;
import io.github.mucsi96.expensetracker.model.CategoryRequest;
import io.github.mucsi96.expensetracker.model.CategoryResponse;
import io.github.mucsi96.expensetracker.repository.CategoryRepository;
import io.github.mucsi96.expensetracker.repository.ExpenseRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CategoryService {
  private final CategoryRepository categoryRepository;
  private final ExpenseRepository expenseRepository;

  public List<CategoryResponse> getCategories() {
    return categoryRepository.findAllByOrderByNameAsc().stream()
        .map(CategoryService::toResponse)
        .toList();
  }

  @Transactional
  public CategoryResponse createCategory(CategoryRequest request) {
    String validName = requireValidName(request.name());
    requireAvailableName(validName);
    return toResponse(categoryRepository.save(Category.builder()
        .name(validName)
        .emoji(normalize(request.emoji()))
        .description(normalize(request.description()))
        .build()));
  }

  @Transactional
  public CategoryResponse updateCategory(Long id, CategoryRequest request) {
    Category category = requireCategory(id);
    String validName = requireValidName(request.name());
    if (!validName.equals(category.getName())) {
      requireAvailableName(validName);
      expenseRepository.updateCategoryName(category.getName(), validName);
      category.setName(validName);
    }
    category.setEmoji(normalize(request.emoji()));
    category.setDescription(normalize(request.description()));
    return toResponse(category);
  }

  @Transactional
  public void deleteCategory(Long id) {
    categoryRepository.delete(requireCategory(id));
  }

  private Category requireCategory(Long id) {
    return categoryRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));
  }

  private void requireAvailableName(String name) {
    if (categoryRepository.existsByName(name)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Category already exists");
    }
  }

  private static String requireValidName(String name) {
    if (name == null || name.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category name must not be blank");
    }
    return name.trim();
  }

  private static String normalize(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private static CategoryResponse toResponse(Category category) {
    return new CategoryResponse(category.getId(), category.getName(), category.getEmoji(),
        category.getDescription());
  }
}
