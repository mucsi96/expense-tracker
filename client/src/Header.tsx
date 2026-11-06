import { useQuery } from '@tanstack/react-query';
import { AppHeader, AppHeaderActions, Button, Menu, MenuItem, MenuPopover, MenuTrigger } from '@mucsi96/react-ui';
import { Link, useNavigate } from 'react-router-dom';
import { fetchJson, userInfoSchema } from './api';
import styles from './Header.module.css';

export function Header() {
  const navigate = useNavigate();
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: ({ signal }) => fetchJson('/oauth2/userinfo', userInfoSchema, { signal }),
  });
  const name = (profile.data?.additionalClaims?.name ?? profile.data?.preferredUsername ?? profile.data?.email)?.trim();
  const initials = name
    ?.split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <AppHeader>
      <Link className={styles.title} to="/">
        Expense Tracker
      </Link>
      <AppHeaderActions>
        {name && (
          <MenuTrigger>
            <Button variant="avatar" aria-label={initials}>
              {initials}
            </Button>
            <MenuPopover>
              <div className={styles.name}>{name}</div>
              <Menu aria-label="User menu">
                <MenuItem onAction={() => navigate('/settings')}>Settings</MenuItem>
              </Menu>
            </MenuPopover>
          </MenuTrigger>
        )}
        {profile.isError && <Button onPress={() => void profile.refetch()}>Retry profile</Button>}
      </AppHeaderActions>
    </AppHeader>
  );
}
