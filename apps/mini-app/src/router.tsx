import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TelegramGuard } from './components/TelegramGuard';
import { HomePage } from './pages/HomePage';
import { ListFormPage } from './pages/ListFormPage';

function Layout() {
  return (
    <AuthProvider>
      <TelegramGuard>
        <Outlet />
      </TelegramGuard>
    </AuthProvider>
  );
}

export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'lists/new', element: <ListFormPage /> },
        { path: 'lists/:id', element: <ListFormPage /> },
      ],
    },
  ],
  { basename: '/app' },
);
