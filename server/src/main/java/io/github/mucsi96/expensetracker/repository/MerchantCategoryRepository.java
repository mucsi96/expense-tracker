package io.github.mucsi96.expensetracker.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.mucsi96.expensetracker.entity.MerchantCategory;

public interface MerchantCategoryRepository extends JpaRepository<MerchantCategory, Long> {
  Optional<MerchantCategory> findByMerchant(String merchant);

  void deleteByCategory(String category);

  @Modifying
  @Query("update MerchantCategory m set m.category = :newName where m.category = :oldName")
  int updateCategoryName(@Param("oldName") String oldName, @Param("newName") String newName);
}
