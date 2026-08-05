package io.github.mucsi96.expensetracker.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.mucsi96.expensetracker.entity.Category;

public interface CategoryRepository extends JpaRepository<Category, Long> {
  List<Category> findAllByOrderByNameAsc();

  boolean existsByName(String name);
}
