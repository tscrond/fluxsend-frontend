import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import {
  Box, Typography, TextField, Button, CircularProgress, Paper,
  InputAdornment, IconButton, Alert,
} from '@mui/material';
import { Lock, Eye, EyeOff, Download, ExternalLink, ShieldOff, Clock, FileQuestion } from 'lucide-react';
import { getShareInfo, resolvePublicShare, ApiError, type ShareInfoResponse } from '@/api';
import { useThemeMode } from '@/hooks/useThemeMode';

const MAX_ATTEMPTS = 5;

type PageState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'blocked' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; info: ShareInfoResponse };

export default function SharePage() {
  const { token = '' } = useParams<{ token: string }>();
  const { mode: themeMode } = useThemeMode();
  const isDark = themeMode === 'dark';

  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);

  useEffect(() => {
    if (!token) {
      setState({ kind: 'not_found' });
      return;
    }
    getShareInfo(token)
      .then((info) => setState({ kind: 'ready', info }))
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          if (err.status === 404) return setState({ kind: 'not_found' });
          if (err.status === 403) {
            const msg = err.message ?? '';
            if (msg.includes('expired') || msg.includes('expiration')) return setState({ kind: 'expired' });
            if (msg.includes('blocked')) return setState({ kind: 'blocked' });
            return setState({ kind: 'expired' });
          }
        }
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
      });
  }, [token]);

  const handleResolve = async (targetMode: 'inline' | 'download') => {
    if (state.kind !== 'ready') return;
    setSubmitting(true);
    setPasswordError('');
    try {
      const result = await resolvePublicShare(token, targetMode, password);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403 && err.message?.includes('blocked')) {
          setState({ kind: 'blocked' });
          return;
        }
        if (err.status === 403 || err.status === 401) {
          const remaining = attemptsLeft - 1;
          setAttemptsLeft(remaining);
          if (remaining <= 0) {
            setState({ kind: 'blocked' });
          } else {
            setPasswordError(`Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
          }
          return;
        }
        if (err.status === 404) { setState({ kind: 'not_found' }); return; }
        if (err.status === 403) { setState({ kind: 'expired' }); return; }
      }
      setPasswordError(err instanceof Error ? err.message : 'Failed to resolve share');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-resolve when share is not password-protected
  useEffect(() => {
    if (state.kind === 'ready' && !state.info.password_protected) {
      // Don't auto-redirect — show the two buttons
    }
  }, [state]);

  const card = (children: React.ReactNode) => (
    <Box
      className="flex items-center justify-center min-h-screen px-4"
      sx={{ bgcolor: 'background.default' }}
    >
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, sm: 4 },
          width: '100%',
          maxWidth: 420,
          borderColor: isDark ? '#30363d' : '#d0d7de',
        }}
      >
        {children}
      </Paper>
    </Box>
  );

  const logo = (
    <Box className="flex items-center gap-2 mb-6">
      <img src="/fs.png" alt="FluxSend" className="h-7 w-auto opacity-90" />
      <Typography variant="body1" fontWeight={800} sx={{ letterSpacing: '-0.01em', color: 'text.primary' }}>
        FLUX<span style={{ color: '#6366f1' }}>SEND</span>
      </Typography>
    </Box>
  );

  if (state.kind === 'loading') {
    return card(
      <Box className="flex flex-col items-center gap-3 py-4">
        {logo}
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary">Loading share…</Typography>
      </Box>,
    );
  }

  if (state.kind === 'not_found') {
    return card(
      <>
        {logo}
        <Box className="flex flex-col items-center gap-3 py-2 text-center">
          <FileQuestion size={40} color="#7d8590" />
          <Typography variant="h6" fontWeight={700}>Share not found</Typography>
          <Typography variant="body2" color="text.secondary">
            This link doesn't exist or has already been used.
          </Typography>
        </Box>
      </>,
    );
  }

  if (state.kind === 'expired') {
    return card(
      <>
        {logo}
        <Box className="flex flex-col items-center gap-3 py-2 text-center">
          <Clock size={40} color="#d29922" />
          <Typography variant="h6" fontWeight={700}>Link expired</Typography>
          <Typography variant="body2" color="text.secondary">
            This share link is no longer valid. Ask the sender for a new one.
          </Typography>
        </Box>
      </>,
    );
  }

  if (state.kind === 'blocked') {
    return card(
      <>
        {logo}
        <Box className="flex flex-col items-center gap-3 py-2 text-center">
          <ShieldOff size={40} color="#f85149" />
          <Typography variant="h6" fontWeight={700} color="error">Access blocked</Typography>
          <Typography variant="body2" color="text.secondary">
            Too many incorrect password attempts. This share has been revoked for security.
          </Typography>
        </Box>
      </>,
    );
  }

  if (state.kind === 'error') {
    return card(
      <>
        {logo}
        <Alert severity="error" sx={{ mt: 1 }}>{state.message}</Alert>
      </>,
    );
  }

  // state.kind === 'ready'
  const { info } = state;
  const shortName = info.file_name.split('/').pop() ?? info.file_name;
  const expiresAt = new Date(info.expires_at).toLocaleString();

  if (!info.password_protected) {
    return card(
      <>
        {logo}
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Shared file</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }} className="truncate">
          {shortName}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 3 }}>
          Expires {expiresAt}
        </Typography>
        <Box className="flex flex-col gap-2">
          <Button
            fullWidth
            variant="contained"
            startIcon={submitting ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <ExternalLink size={16} />}
            onClick={() => handleResolve('inline')}
            disabled={submitting}
            sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
          >
            View in browser
          </Button>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<Download size={16} />}
            onClick={() => handleResolve('download')}
            disabled={submitting}
          >
            Download file
          </Button>
        </Box>
      </>,
    );
  }

  // Password-protected
  return card(
    <>
      {logo}
      <Box className="flex items-center gap-2 mb-1">
        <Lock size={18} color="#6366f1" />
        <Typography variant="h6" fontWeight={700}>Password required</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }} className="truncate">
        {shortName}
      </Typography>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 3 }}>
        Expires {expiresAt}
      </Typography>

      {passwordError && (
        <Alert severity="error" sx={{ mb: 2, py: 0.5 }}>{passwordError}</Alert>
      )}

      <Box
        component="form"
        onSubmit={(e) => { e.preventDefault(); handleResolve('inline'); }}
        className="flex flex-col gap-3"
      >
        <TextField
          fullWidth
          size="small"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          disabled={submitting}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowPassword((v) => !v)} edge="end">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Button
          fullWidth
          variant="contained"
          type="submit"
          disabled={submitting || !password}
          startIcon={submitting ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <ExternalLink size={16} />}
          sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
        >
          View in browser
        </Button>
        <Button
          fullWidth
          variant="outlined"
          disabled={submitting || !password}
          startIcon={<Download size={16} />}
          onClick={() => handleResolve('download')}
        >
          Download file
        </Button>
      </Box>
    </>,
  );
}
