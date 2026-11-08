import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Dialog, DialogTrigger, useNotifications } from '@mucsi96/react-ui';
import { Link } from 'react-router-dom';
import { deleteResource, fetchJson, settingsQuery, settingsSchema, type Settings as SettingsData } from '../api';
import { Loading, LoadError } from '../Loading';
import styles from './Settings.module.css';

export default function Settings() {
  const query = useQuery(settingsQuery);
  return (
    <>
      <title>Settings</title>
      <h1>Settings</h1>
      {query.isPending ? (
        <Loading label="Loading settings" />
      ) : query.isError ? (
        <LoadError retry={() => void query.refetch()} />
      ) : (
        <SettingsForm settings={query.data} />
      )}
    </>
  );
}

function SettingsForm({ settings }: { settings: SettingsData }) {
  const client = useQueryClient();
  const notifications = useNotifications();
  const [budget, setBudget] = useState(String(settings.monthlyBudget));
  const [day, setDay] = useState(String(settings.closingDay));
  const save = useMutation({
    mutationFn: ({ kind, value }: { kind: 'budget' | 'day'; value: number }) =>
      fetchJson('/api/settings', settingsSchema, {
        method: 'PUT',
        body: JSON.stringify(
          kind === 'day' ? { closingDay: value } : { closingDay: settings.closingDay, monthlyBudget: value }
        ),
      }),
    onSuccess: (data, { kind }) => {
      client.setQueryData(settingsQuery.queryKey, data);
      notifications.success(kind === 'day' ? 'Closing day saved' : 'Monthly budget saved');
    },
    onError: (_, { kind }) =>
      notifications.error(kind === 'day' ? 'Failed to save closing day' : 'Failed to save monthly budget'),
  });
  const cleanup = useMutation({
    mutationFn: () => deleteResource('/api/expenses'),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['expenses'] });
      notifications.success('All transactions deleted');
    },
    onError: () => notifications.error('Failed to delete transactions'),
  });
  const validBudget =
    budget.trim() !== '' &&
    Number(budget) >= 0 &&
    Number(budget) <= 999999999.99 &&
    Math.abs(Number(budget) * 100 - Math.round(Number(budget) * 100)) < 0.00001;
  const validDay = day.trim() !== '' && Number.isInteger(Number(day)) && Number(day) >= 1 && Number(day) <= 31;
  return (
    <div className={styles.sections}>
      <Card>
        <h2>Monthly budget</h2>
        <p>Budget for each closing period in {settings.baseCurrency}. Set 0 to disable the burndown chart.</p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (validBudget) save.mutate({ kind: 'budget', value: Number(budget) });
          }}
        >
          <label>
            Monthly budget
            <input
              type="number"
              min="0"
              max="999999999.99"
              step="0.01"
              required
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          <Button type="submit" isDisabled={!validBudget || save.isPending}>
            Update budget
          </Button>
        </form>
      </Card>
      <Card>
        <h2>Monthly closing day</h2>
        <p>
          Monthly expenses are collected up to this day of the month; transactions after it count towards the next
          month. Set 31 to use calendar months.
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (validDay) save.mutate({ kind: 'day', value: Number(day) });
          }}
        >
          <label>
            Closing day
            <input type="number" min="1" max="31" required value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <Button type="submit" isDisabled={!validDay || save.isPending}>
            Save
          </Button>
        </form>
      </Card>
      <Card>
        <h2>Categories</h2>
        <p>Manage the categories used to group your transactions.</p>
        <Link to="/settings/categories" className={styles.categoriesLink}>
          Manage categories
        </Link>
      </Card>
      <Card className={styles.danger}>
        <h2>Danger zone</h2>
        <p>Remove all imported transactions from the database. This action cannot be undone.</p>
        <DialogTrigger>
          <Button tone="error" isDisabled={cleanup.isPending}>
            Clear all transactions
          </Button>
          <Dialog title="Clear all transactions?" description="This action cannot be undone">
            {({ close }) => (
              <div className={styles.form}>
                <Button variant="text" onPress={close}>
                  Cancel
                </Button>
                <Button
                  tone="error"
                  onPress={() => {
                    close();
                    cleanup.mutate();
                  }}
                >
                  Delete
                </Button>
              </div>
            )}
          </Dialog>
        </DialogTrigger>
      </Card>
    </div>
  );
}
