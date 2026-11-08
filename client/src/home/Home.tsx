import { lazy, Suspense, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Button, LoadingArea } from '@mucsi96/react-ui';
import { categoriesQuery, expensesQuery, settingsQuery, type Category, type Expense, type Settings } from '../api';
import { currentMonthKey, toMonthKey, toMonthLabel } from '../domain/month';
import { LoadError } from '../LoadError';
import { ExpenseList } from './ExpenseList';
import { CategoryPicker } from './CategoryPicker';
import styles from './Home.module.css';

const BudgetBurndown = lazy(() => import('../charts/BudgetBurndown'));
const MonthlySpending = lazy(() => import('../charts/MonthlySpending'));

export default function Home() {
  const expenses = useQuery(expensesQuery);
  const categories = useQuery(categoriesQuery);
  const settings = useQuery(settingsQuery);
  return (
    <>
      <title>Expenses</title>
      <h1>Expenses</h1>
      {expenses.isPending || categories.isPending || settings.isPending ? (
        <LoadingArea label="Loading expenses" fill />
      ) : expenses.isError || categories.isError || settings.isError ? (
        <LoadError
          retry={() => {
            void expenses.refetch();
            void categories.refetch();
            void settings.refetch();
          }}
        />
      ) : (
        <Expenses expenses={expenses.data} categories={categories.data} settings={settings.data} />
      )}
    </>
  );
}

function Expenses({
  expenses,
  categories,
  settings,
}: {
  expenses: Expense[];
  categories: Category[];
  settings: Settings;
}) {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('budget');
  const [choosing, setChoosing] = useState<Expense | null>(null);
  const month = params.get('month') ?? currentMonthKey(settings.closingDay);
  const category = params.get('category');
  const months = [
    ...new Set([
      currentMonthKey(settings.closingDay),
      ...expenses.flatMap((expense) => (expense.date ? [toMonthKey(expense.date, settings.closingDay)] : [])),
    ]),
  ].sort((a, b) => b.localeCompare(a));
  const filtered = expenses.filter(
    (expense) =>
      (month === 'all' || (expense.date && toMonthKey(expense.date, settings.closingDay) === month)) &&
      (category === null || category === expense.category)
  );
  const uncategorized = category === null ? expenses.filter((expense) => !expense.category) : [];
  const categorized = filtered.filter((expense) => expense.category);
  const spend = filtered
    .filter((expense) => expense.type === 'Expense')
    .reduce((sum, expense) => sum + (expense.convertedAmount ?? 0), 0);
  const apply = useCallback(
    (month: string, category: string | null, replace = false) => {
      setParams(category === null ? { month } : { month, category }, { replace });
    },
    [setParams]
  );
  const selectCategory = useCallback(
    (category: string, pickedMonth?: string) => apply(pickedMonth ?? month, category),
    [apply, month]
  );
  const tabs = [
    { id: 'budget', label: 'Budget burndown' },
    { id: 'spending', label: 'Monthly spending' },
  ];
  return (
    <>
      <div role="tablist" aria-label="Spending charts" className={styles.tabs}>
        {tabs.map((item, index) => (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? 1
                    : ['ArrowLeft', 'ArrowRight'].includes(event.key)
                      ? 1 - index
                      : undefined;
              if (next !== undefined) {
                event.preventDefault();
                setTab(tabs[next].id);
                document.getElementById(`tab-${tabs[next].id}`)?.focus();
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        <Suspense fallback={<LoadingArea label="Loading chart" />}>
          {tab === 'budget' ? (
            <BudgetBurndown expenses={expenses} settings={settings} month={month} />
          ) : (
            <MonthlySpending expenses={expenses} closingDay={settings.closingDay} onSelect={selectCategory} />
          )}
        </Suspense>
      </div>
      {!!uncategorized.length && (
        <section aria-label="Uncategorized">
          <h2>Uncategorized</h2>
          <ExpenseList expenses={uncategorized} categories={categories} onChoose={setChoosing} />
        </section>
      )}
      {category !== null && (
        <div className={styles.filter}>
          <Button
            variant="outlined"
            className={styles.filterChip}
            aria-label={`Clear category filter: ${category}`}
            onPress={() => apply(month, null)}
          >
            <span className={styles.filterIcon} aria-hidden="true">
              {categories.find((item) => item.name === category)?.emoji}
            </span>
            <span className={styles.filterName}>{category}</span>
            <span className={styles.filterIcon} aria-hidden="true">
              ✕
            </span>
          </Button>
          <span>
            {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
          </span>
        </div>
      )}
      <div className={styles.months}>
        <fieldset className={styles.monthGroup}>
          <legend>Filter by month</legend>
          <div className={styles.monthOptions}>
            {[...months, 'all'].map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="month"
                  value={value}
                  checked={month === value}
                  onChange={() => apply(value, category, true)}
                />
                <span>{value === 'all' ? 'All' : toMonthLabel(value)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p>
          Spent {spend.toFixed(2)} {settings.baseCurrency}
        </p>
      </div>
      {categorized.length ? (
        <ExpenseList expenses={categorized} categories={categories} onChoose={setChoosing} />
      ) : expenses.length ? (
        <p>
          No {category ? `${category} ` : ''}transactions in {month === 'all' ? 'any month' : toMonthLabel(month)}.
        </p>
      ) : (
        <p>No expenses yet. Card payments show up here automatically when bank notifications arrive.</p>
      )}
      {choosing && <CategoryPicker expense={choosing} categories={categories} close={() => setChoosing(null)} />}
    </>
  );
}
