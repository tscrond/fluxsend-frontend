import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { ApiError, verifyPasswordAttach } from '@/api';

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export default function PasswordAttachVerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const email = useMemo(() => normalizeEmail(search.get('email') ?? ''), [search]);
  const code = useMemo(() => (search.get('code') ?? '').trim(), [search]);

  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('Verifying your password setup request...');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!id || !email || !code) {
        setStatus('error');
        setMessage('The verification link is invalid or incomplete.');
        return;
      }

      try {
        await verifyPasswordAttach(id, email, code);
        if (cancelled) return;
        setStatus('success');
        setMessage('Password login is now linked to your account. Redirecting...');
        window.setTimeout(() => {
          navigate('/settings?password_attached=1', { replace: true });
        }, 1200);
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        if (error instanceof ApiError) {
          setMessage(error.message || 'Password setup verification failed.');
          return;
        }
        setMessage('Password setup verification failed. Please try again.');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [id, email, code, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        background: 'linear-gradient(180deg, #0b1220 0%, #111827 100%)',
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: 520,
          p: 4,
          borderColor: '#334155',
          bgcolor: 'rgba(15,23,42,0.9)',
          color: '#e5e7eb',
        }}
      >
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Link Password Login
          </Typography>

          {status === 'pending' && <CircularProgress size={24} sx={{ color: '#818cf8' }} />}

          <Typography variant="body1" sx={{ color: '#cbd5e1' }}>
            {message}
          </Typography>

          {status === 'success' && (
            <Alert severity="success" sx={{ width: '100%' }}>
              You can now use email/password authentication for this account.
            </Alert>
          )}

          {status !== 'pending' && (
            <Stack direction="row" spacing={1.5}>
              <Button component={RouterLink} to="/settings" variant="contained">
                Go to Settings
              </Button>
              <Button component={RouterLink} to="/login" variant="outlined">
                Go to Login
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
