import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, DialogTrigger, TextField, useNotifications } from '@mucsi96/react-ui';
import {
  categoriesQuery,
  categorySchema,
  deleteResource,
  fetchJson,
  type Category,
  type CategoryAttributes,
} from '../api';
import { Loading, LoadError } from '../Loading';
import styles from './Categories.module.css';

const empty = { name: '', emoji: '', description: '' };

export default function Categories() {
  const query = useQuery(categoriesQuery);
  const client = useQueryClient();
  const notifications = useNotifications();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['categories'] }),
      client.invalidateQueries({ queryKey: ['expenses'] }),
    ]);
  const remove = useMutation({
    mutationFn: (id: number) => deleteResource(`/api/categories/${id}`),
    onSuccess: async () => {
      await refresh();
      notifications.success('Category deleted');
    },
    onError: () => notifications.error('Failed to delete category'),
  });
  return (
    <div className={styles.page}>
      <title>Categories</title>
      <div className={styles.header}>
        <Link to="/settings" className={styles.back}>
          ‹ Settings
        </Link>
        <h1>Categories</h1>
      </div>
      <CategoryForm onSaved={refresh} />
      {query.isPending ? (
        <Loading label="Loading categories" />
      ) : query.isError ? (
        <LoadError retry={() => void query.refetch()} />
      ) : !query.data.length ? (
        <p className={styles.empty}>No categories yet. Add your first category above.</p>
      ) : (
        <ul className={styles.list}>
          {query.data.map((category) => (
            <li key={category.id} className={styles.item}>
              <div className={styles.details}>
                <span>
                  {category.emoji} {category.name}
                </span>
                <small>{category.description}</small>
              </div>
              <div className={styles.actions}>
                <DialogTrigger>
                  <Button variant="text" aria-label={`Edit ${category.name}`}>
                    Edit
                  </Button>
                  <Dialog title="Edit category">
                    {({ close }) => (
                      <CategoryForm
                        category={category}
                        onSaved={async () => {
                          await refresh();
                          close();
                        }}
                        onCancel={close}
                      />
                    )}
                  </Dialog>
                </DialogTrigger>
                <Button
                  variant="text"
                  aria-label={`Delete ${category.name}`}
                  isDisabled={remove.isPending}
                  onPress={() => remove.mutate(category.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryForm({
  category,
  onSaved,
  onCancel,
}: {
  category?: Category;
  onSaved: () => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [attributes, setAttributes] = useState<CategoryAttributes>(category ?? empty);
  const notifications = useNotifications();
  const save = useMutation({
    mutationFn: () =>
      fetchJson(category ? `/api/categories/${category.id}` : '/api/categories', categorySchema, {
        method: category ? 'PUT' : 'POST',
        body: JSON.stringify(attributes),
      }),
    onSuccess: async () => {
      await onSaved();
      if (!category) setAttributes(empty);
      notifications.success(category ? 'Category updated' : 'Category added');
    },
    onError: () => notifications.error(category ? 'Failed to update category' : 'Failed to add category'),
  });
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (attributes.name.trim()) save.mutate();
      }}
    >
      <TextField
        label="Emoji"
        value={attributes.emoji ?? ''}
        onChange={(emoji) => setAttributes({ ...attributes, emoji })}
      />
      <TextField
        label={category ? 'Name' : 'New category'}
        isRequired
        value={attributes.name}
        onChange={(name) => setAttributes({ ...attributes, name })}
      />
      <TextField
        label="Description"
        value={attributes.description ?? ''}
        onChange={(description) => setAttributes({ ...attributes, description })}
      />
      <div className={styles.actions}>
        {onCancel && (
          <Button variant="text" onPress={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" isDisabled={!attributes.name.trim() || save.isPending}>
          {category ? 'Save' : 'Add'}
        </Button>
      </div>
    </form>
  );
}
