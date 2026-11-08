import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AppMain, LoadingArea } from '@mucsi96/react-ui';
import { Header } from './Header';
import styles from './App.module.css';

const Home = lazy(() => import('./home/Home'));
const Settings = lazy(() => import('./settings/Settings'));
const Categories = lazy(() => import('./categories/Categories'));

export function App() {
  return (
    <div className={styles.layout}>
      <Header />
      <AppMain className={styles.main}>
        <Suspense fallback={<LoadingArea label="Loading page" fill />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/categories" element={<Categories />} />
            <Route
              path="*"
              element={
                <>
                  <title>Page not found</title>
                  <h1>Page not found</h1>
                  <Link to="/">Return to expenses</Link>
                </>
              }
            />
          </Routes>
        </Suspense>
      </AppMain>
    </div>
  );
}
