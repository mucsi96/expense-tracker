package io.github.mucsi96.expensetracker.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.mucsi96.expensetracker.entity.Expense;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
  @Modifying
  @Query("update Expense e set e.category = :newName where e.category = :oldName")
  int updateCategoryName(@Param("oldName") String oldName, @Param("newName") String newName);
}
