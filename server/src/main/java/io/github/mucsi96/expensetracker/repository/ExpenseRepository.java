package io.github.mucsi96.expensetracker.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.mucsi96.expensetracker.entity.Expense;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
  List<Expense> findByDescription(String description);

  @Modifying
  @Query("update Expense e set e.category = :newName where e.category = :oldName")
  int updateCategoryName(@Param("oldName") String oldName, @Param("newName") String newName);
}
