import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, useNotifications } from '@mucsi96/react-ui';
import { Link } from 'react-router-dom';
import { expenseSchema, fetchJson, type Category, type Expense } from '../api';
import styles from './Home.module.css';

export function CategoryPicker({
  expense,
  categories,
  close,
}: {
  expense: Expense;
  categories: Category[];
  close: () => void;
}) {
  const client = useQueryClient();
  const notifications = useNotifications();
  const update = useMutation({
    mutationFn: (category: string) =>
      fetchJson(`/api/expenses/${expense.id}/category`, expenseSchema, {
        method: 'PUT',
        body: JSON.stringify({ category }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['expenses'] });
      close();
    },
    onError: () => notifications.error('Failed to update category'),
  });
  return (
    <Dialog
      title="Choose category"
      style={{ alignItems: 'end', paddingBottom: 0 }}
      isOpen
      onOpenChange={(open) => {
        if (!open) close();
      }}
      className={styles.picker}
    >
      <div className={styles.options}>
        {categories.map((category) => (
          <Button
            key={category.id}
            variant="text"
            isDisabled={update.isPending}
            onPress={() => {
              if (category.name === expense.category) close();
              else update.mutate(category.name);
            }}
          >
            <span>
              <span aria-hidden="true">{category.emoji}</span> {category.name}
              {category.description && <small>{category.description}</small>}
            </span>
          </Button>
        ))}
      </div>
      {!categories.length && (
        <p>
          No categories yet.{' '}
          <Link to="/settings/categories" onClick={close}>
            Manage categories
          </Link>
        </p>
      )}
      <Button variant="text" onPress={close}>
        Cancel
      </Button>
    </Dialog>
  );
}
