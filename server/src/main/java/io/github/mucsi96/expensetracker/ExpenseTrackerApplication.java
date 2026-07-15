package io.github.mucsi96.expensetracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import io.github.mucsi96.expensetracker.config.DatabaseStartupInitializer;

@SpringBootApplication
public class ExpenseTrackerApplication {

  public static void main(String[] args) {
    final SpringApplication app = new SpringApplication(ExpenseTrackerApplication.class);
    app.addInitializers(new DatabaseStartupInitializer());
    app.run(args);
  }
}
