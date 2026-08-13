import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router';
import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { passwordVerifyNewUser, ApiError } from '@/api';

export default function PasswordVerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('Verifying your email...');

  const email = useMemo(() => (search.get('email') ?? '').trim().toLowerCase(), [search]);
  const code = useMemo(() => (search.get('code') ?? '').trim(), [search]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!id || !email || !code) {
        setStatus('error');
        setMessage('The verification link is invalid or incomplete.');
        return;
      }

      try {
        await passwordVerifyNewUser(id, email, code);
        if (cancelled) return;
        setStatus('success');
        setMessage('Email verified. Redirecting to login...');
        window.setTimeout(() => {
          navigate('/login?verified=1', { replace: true });
        }, 1200);
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        if (error instanceof ApiError) {
          setMessage(error.message || 'Verification failed.');
          return;
        }
        setMessage('Verification failed. Please try again.');
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
            Confirm Your Email
          </Typography>

          {status === 'pending' && <CircularProgress size={24} sx={{ color: '#818cf8' }} />}

          <Typography variant="body1" sx={{ color: '#cbd5e1' }}>
            {message}
          </Typography>

          {status !== 'pending' && (
            <Button component={RouterLink} to="/login" variant="contained">
              Go To Login
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
