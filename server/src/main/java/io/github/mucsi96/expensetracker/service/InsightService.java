package io.github.mucsi96.expensetracker.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Service;

import io.github.mucsi96.expensetracker.model.ExpenseResponse;
import io.github.mucsi96.expensetracker.model.InsightResponse;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class InsightService {
  private final ExpenseService expenseService;
  private final AnthropicChatModel chatModel;

  public InsightResponse getInsight() {
    List<ExpenseResponse> expenses = expenseService.getExpenses();

    Map<String, BigDecimal> totalsByCategory = expenses.stream()
        .filter(expense -> expense.amount() != null)
        .collect(Collectors.groupingBy(
            expense -> expense.category() == null || expense.category().isBlank()
                ? "Uncategorized"
                : expense.category(),
            Collectors.reducing(BigDecimal.ZERO, ExpenseResponse::amount, BigDecimal::add)));

    String summary = totalsByCategory.entrySet().stream()
        .map(entry -> entry.getKey() + ": " + entry.getValue())
        .collect(Collectors.joining(", "));

    Prompt prompt = new Prompt(List.of(
        new SystemMessage("You are a personal finance assistant. Generate a short, actionable insight."),
        new UserMessage("Analyze the following expenses by category and share one insight: " + summary)));

    return new InsightResponse(chatModel.call(prompt).getResult().getOutput().getText());
  }
}
