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
import LandingPage from '@/pages/LandingPage';
import SharePage from '@/pages/SharePage';
import WorkspacesPage from '@/pages/WorkspacesPage';
import WorkspaceCreatePage from '@/pages/WorkspaceCreatePage';
import WorkspaceDetailPage from '@/pages/WorkspaceDetailPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import PrivateAPIKeysPage from '@/pages/PrivateAPIKeysPage';

function buildTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
      error: { main: '#f85149' },
      success: { main: '#3fb950' },
      warning: { main: '#d29922' },
      divider: isDark ? '#30363d' : '#d0d7de',
      text: {
        primary: isDark ? '#e6edf3' : '#1f2328',
        secondary: isDark ? '#7d8590' : '#57606a',
        disabled: isDark ? '#484f58' : '#8c959f',
      },
      background: isDark
        ? { default: '#0d1117', paper: '#161b22' }
        : { default: '#f6f8fa', paper: '#ffffff' },
      action: {
        hover: isDark ? 'rgba(177,186,196,0.07)' : 'rgba(31,35,40,0.05)',
        selected: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
      },
    },
    typography: {
      fontFamily: "'Datatype', system-ui, -apple-system, sans-serif",
      allVariants: { fontWeight: 700 },
      fontWeightRegular: 700,
      fontWeightMedium: 700,
      fontWeightBold: 800,
    },
    shape: { borderRadius: 6 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 700, letterSpacing: '0.01em' },
          outlined: {
            borderColor: isDark ? '#30363d' : '#d0d7de',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          outlined: {
            borderColor: isDark ? '#30363d' : '#d0d7de',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: {
            borderColor: isDark ? '#30363d' : '#d0d7de',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: isDark ? '#30363d' : '#d0d7de' },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: isDark ? '#21262d' : '#eaecef' },
          head: {
            backgroundColor: isDark ? '#161b22' : '#f6f8fa',
            color: isDark ? '#7d8590' : '#57606a',
            fontWeight: 700,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.04em' },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#0d1117' : '#f6f8fa',
            borderColor: isDark ? '#30363d' : '#d0d7de',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#0d1117' : '#f6f8fa',
            borderColor: isDark ? '#30363d' : '#d0d7de',
          },
        },
      },
    },
  });
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/share/:token',
    element: <SharePage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: 'files', element: <FilesPage /> },
          { path: 'upload', element: <UploadPage /> },
          { path: 'shared', element: <SharedPage /> },
          { path: 'received', element: <ReceivedPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'api-keys', element: <PrivateAPIKeysPage /> },
          { path: 'workspaces', element: <WorkspacesPage /> },
          { path: 'workspaces/create', element: <WorkspaceCreatePage /> },
          { path: 'workspaces/:workspaceId', element: <WorkspaceDetailPage /> },
          { path: 'analytics', element: <AnalyticsPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
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
