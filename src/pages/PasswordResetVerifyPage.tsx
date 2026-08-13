import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router';
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { ApiError, verifyPasswordReset } from '@/api';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export default function PasswordResetVerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const email = useMemo(() => normalizeEmail(search.get('email') ?? ''), [search]);
  const code = useMemo(() => (search.get('code') ?? '').trim(), [search]);

  const [phase, setPhase] = useState<'verifying' | 'ready' | 'resetting' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your reset link...');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!id || !email || !code || !emailPattern.test(email)) {
        setPhase('error');
        setMessage('The reset link is invalid or incomplete.');
        return;
      }

      try {
        await verifyPasswordReset(id, email, code);
        if (cancelled) return;
        setPhase('ready');
        setMessage('Reset link verified. Choose a new password below.');
      } catch (error) {
        if (cancelled) return;
        setPhase('error');
        if (error instanceof ApiError) {
          setMessage(error.message || 'Password reset verification failed.');
          return;
        }
        setMessage('Password reset verification failed. Please try again.');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [id, email, code]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedPassword = newPassword.trim();
    if (normalizedPassword.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    if (normalizedPassword !== confirmPassword.trim()) {
      setMessage('Passwords do not match.');
      return;
    }

    if (!id || !email || !code) {
      setMessage('The reset link is invalid or incomplete.');
      return;
    }

    setPhase('resetting');
    setMessage('Saving your new password...');
    try {
      await verifyPasswordReset(id, email, code, normalizedPassword);
      navigate('/login?reset=1', { replace: true });
    } catch (error) {
      setPhase('ready');
      if (error instanceof ApiError) {
        setMessage(error.message || 'Password reset failed.');
        return;
      }
      setMessage('Password reset failed. Please try again.');
    }
  }

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
          maxWidth: 560,
          p: 4,
          borderColor: '#334155',
          bgcolor: 'rgba(15,23,42,0.92)',
          color: '#e5e7eb',
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Reset Password
          </Typography>

          {(phase === 'verifying' || phase === 'resetting') && (
            <CircularProgress size={24} sx={{ color: '#818cf8' }} />
          )}

          <Typography variant="body1" sx={{ color: '#cbd5e1' }}>
            {message}
          </Typography>

          {phase === 'ready' && (
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              <TextField
                label="Email"
                type="email"
                value={email}
                disabled
                fullWidth
              />
              <TextField
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                fullWidth
              />
              <TextField
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                fullWidth
              />
              <Button type="submit" variant="contained" size="large">
                Update password
              </Button>
            </Stack>
          )}

          {phase === 'error' && (
            <Alert severity="error">
              {message}
            </Alert>
          )}

          <Button component={RouterLink} to="/login" variant="outlined">
            Back to login
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
