import { useMemo } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider } from '@/hooks/useAuth';
import { ToastProvider } from '@/hooks/useToast';
import { ThemeModeProvider, useThemeMode } from '@/hooks/useThemeMode';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import FilesPage from '@/pages/FilesPage';
import UploadPage from '@/pages/UploadPage';
import SharedPage from '@/pages/SharedPage';
import ReceivedPage from '@/pages/ReceivedPage';
import SettingsPage from '@/pages/SettingsPage';

function buildTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: {
      mode,
      primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
      error: { main: '#ef4444' },
      success: { main: '#22c55e' },
      warning: { main: '#f59e0b' },
      ...(mode === 'light'
        ? { background: { default: '#f8fafc', paper: '#ffffff' } }
        : { background: { default: '#0f172a', paper: '#1e293b' } }),
    },
    typography: {
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 500 },
        },
      },
    },
  });
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/files" replace /> },
          { path: 'files', element: <FilesPage /> },
          { path: 'upload', element: <UploadPage /> },
          { path: 'shared', element: <SharedPage /> },
          { path: 'received', element: <ReceivedPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/files" replace />,
  },
]);

function ThemedApp() {
  const { mode } = useThemeMode();
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <ThemeModeProvider>
      <ThemedApp />
    </ThemeModeProvider>
  );
}
