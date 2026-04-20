import { useAuth } from '@/hooks/useAuth';
import { useThemeMode } from '@/hooks/useThemeMode';
import { Navigate } from 'react-router';
import { Button, CircularProgress, Typography, Box, IconButton } from '@mui/material';
import { Shield, Share2, Cloud, Sun, Moon, Terminal } from 'lucide-react';

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const { mode, toggleMode } = useThemeMode();

  if (isLoading) {
    return (
      <Box className="flex items-center justify-center h-screen">
        <CircularProgress />
      </Box>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/files" replace />;
  }

  return (
    <div className="flex min-h-screen max-md:flex-col">
      {/* Left hero */}
      <div
        className="flex-1 flex items-center justify-center p-12 text-white max-md:p-8"
        style={{ background: 'linear-gradient(160deg, #0d1117 0%, #161b22 60%, #1a1f2e 100%)' }}
      >
        <div className="max-w-md w-full">
          <div className="flex flex-row items-center mb-10 gap-3">
            {/* <img src="/fs.png" alt="FluxSend logo" className="h-32 w-auto opacity-90" /> */}
            <span
              className="sm:text-2xl text-xl font-extrabold tracking-widest uppercase"
              style={{ fontFamily: 'monospace', color: '#7d8590', letterSpacing: '0.12em' }}
            >
              fluxsend
            </span>
          </div>
          <div
            className="text-xs font-mono mb-4 px-2 py-1 rounded inline-flex items-center gap-1.5"
            style={{ background: '#21262d', color: '#3fb950' }}
          >
            <Terminal size={12} />
            begin now
          </div>
          <h1
            className="text-3xl font-extrabold leading-tight mt-2 mb-3 max-md:text-2xl"
            style={{ color: '#e6edf3' }}
          >
            Encrypted transfers.<br />
            <span style={{ color: '#818cf8' }}>Zero friction.</span>
          </h1>
          <p className="text-sm leading-relaxed mb-10" style={{ color: '#7d8590' }}>
            Self-hosted file sharing with expiring links, per-file access control, and S3-compatible storage.
          </p>
          <div className="flex flex-col gap-4 max-md:hidden">
            {[
              { icon: Cloud, title: 'Cloud Storage', desc: 'Your files safely stored and accessible anywhere' },
              { icon: Share2, title: 'Expiring share links', desc: 'Time-limited, token-based access — no account needed to receive' },
              { icon: Shield, title: 'Secure by default', desc: 'Secure delivery and time-limited access' },
            ].map((f) => (
              <div key={f.title} className="flex gap-3 items-start">
                <f.icon size={15} style={{ color: '#6366f1', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <strong className="block text-sm mb-0.5" style={{ color: '#c9d1d9' }}>{f.title}</strong>
                  <p className="text-xs leading-snug" style={{ color: '#7d8590' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login */}
      <Box className="flex-1 flex items-center justify-center p-12 max-md:p-8 relative" sx={{ bgcolor: 'background.default' }}>
        <IconButton
          onClick={toggleMode}
          size="small"
          sx={{ position: 'absolute', top: 16, right: 16, color: 'text.secondary' }}
        >
          {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        <div className="max-w-sm w-full">
          <Typography variant="h6" fontWeight={800} gutterBottom sx={{ letterSpacing: '-0.01em' }}>
            Sign in
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 4, lineHeight: 1.6 }}>
            Access your personal FluxSend workspace
          </Typography>

          <Button
            variant="outlined"
            size="large"
            fullWidth
            onClick={login}
            sx={{
              py: 1.5,
              fontSize: '0.875rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              borderColor: 'divider',
              color: 'text.primary',
              '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' },
            }}
            startIcon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
              </svg>
            }
          >
            Continue with Google
          </Button>

          <Typography variant="caption" color="text.disabled" sx={{ mt: 3, display: 'block' }}>
            By signing in, you agree to our terms and privacy policy.
          </Typography>
        </div>
      </Box>
    </div>
  );
}
