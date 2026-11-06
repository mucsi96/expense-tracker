import { Button, Tooltip } from '@mucsi96/react-ui';
import type { Category, Expense } from '../api';
import styles from './Home.module.css';

const dayLabel = (day: string) =>
  day
    ? new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'Unknown date';

export function ExpenseList({
  expenses,
  categories,
  onChoose,
}: {
  expenses: Expense[];
  categories: Category[];
  onChoose: (expense: Expense) => void;
}) {
  const days = [...new Set(expenses.map((expense) => expense.date?.slice(0, 10) ?? ''))].sort((a, b) =>
    b.localeCompare(a)
  );
  return (
    <>
      {days.map((day) => (
        <section key={day}>
          <h2 className={styles.day}>{dayLabel(day)}</h2>
          <ul className={styles.list}>
            {expenses
              .filter((expense) => (expense.date?.slice(0, 10) ?? '') === day)
              .map((expense) => {
                const category = categories.find((category) => category.name === expense.category);
                const foreign = expense.currency !== expense.baseCurrency && expense.convertedAmount != null;
                const amount = foreign ? expense.convertedAmount : expense.amount;
                const chip = (
                  <Button
                    variant="outlined"
                    className={styles.chip}
                    aria-label={`Change category: ${expense.category || 'Uncategorized'}`}
                    aria-describedby={category?.description ? `category-description-${expense.id}` : undefined}
                    onPress={() => onChoose(expense)}
                  >
                    <span aria-hidden="true">{category?.emoji}</span> {expense.category || 'Uncategorized'}
                  </Button>
                );
                return (
                  <li key={expense.id} className={styles.expense}>
                    <div className={styles.details}>
                      <span>{expense.description}</span>
                      {category?.description && (
                        <span id={`category-description-${expense.id}`} hidden>
                          {category.description}
                        </span>
                      )}
                      {category?.description ? <Tooltip content={category.description}>{chip}</Tooltip> : chip}
                    </div>
                    <div className={styles.amounts}>
                      <span className={expense.type === 'Income' ? styles.income : undefined}>
                        {amount != null
                          ? `${expense.type === 'Income' ? '+' : '-'}${amount.toFixed(2)} ${foreign ? expense.baseCurrency : expense.currency}`
                          : ''}
                      </span>
                      {foreign && expense.amount != null && (
                        <small>
                          {expense.amount.toFixed(2)} {expense.currency}
                        </small>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </>
  );
}
