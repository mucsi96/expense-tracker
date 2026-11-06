import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AppMain } from '@mucsi96/react-ui';
import { Header } from './Header';
import { Loading } from './Loading';

const Home = lazy(() => import('./home/Home'));
const Settings = lazy(() => import('./settings/Settings'));
const Categories = lazy(() => import('./categories/Categories'));

export function App() {
  return (
    <>
      <Header />
      <AppMain>
        <Suspense fallback={<Loading label="Loading page" />}>
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
    </>
  );
}
