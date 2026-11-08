import { Alert, Button } from '@mucsi96/react-ui';

export function LoadError({ retry }: { retry: () => void }) {
  return (
    <Alert tone="error">
      Unable to load data. <Button onPress={retry}>Try again</Button>
    </Alert>
  );
}
