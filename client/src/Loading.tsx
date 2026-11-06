import { Alert, Button } from '@mucsi96/react-ui';
import styles from './Loading.module.css';

export function Loading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className={styles.skeleton}>
      <span />
      <span />
      <span />
    </div>
  );
}
export function LoadError({ retry }: { retry: () => void }) {
  return (
    <Alert tone="error">
      Unable to load data. <Button onPress={retry}>Try again</Button>
    </Alert>
  );
}
