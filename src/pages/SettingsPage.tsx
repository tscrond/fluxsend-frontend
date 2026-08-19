import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ApiError, deleteAccount, requestPasswordAttach, requestPasswordReset } from '@/api';
import {
  Paper, Typography, Avatar, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Checkbox, FormControlLabel, Alert, Chip, CircularProgress, Stack,
} from '@mui/material';
import { User, Shield, Trash2, AlertTriangle, CreditCard } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout, identities, hasPasswordIdentity } = useAuth();
  const { toast } = useToast();
  const [search] = useSearchParams();
  const [showDelete, setShowDelete] = useState(false);
  const [deleteData, setDeleteData] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState(user?.email ?? '');
  const [resetSending, setResetSending] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
  const [setupSending, setSetupSending] = useState(false);

  const passwordAttachedNotice = search.get('password_attached') === '1';

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteAccount(deleteData);
      toast('info', 'Account deleted');
      await logout();
    } catch {
      toast('error', 'Failed to delete account');
      setDeleting(false);
    }
  };

  const handleResetRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = resetEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast('error', 'Email is required');
      return;
    }

    setResetSending(true);
    try {
      await requestPasswordReset(normalizedEmail);
      toast('success', 'If that email has a password identity, a reset link will arrive shortly.');
      setShowReset(false);
    } catch (error) {
      if (error instanceof ApiError) {
        toast('error', error.message || 'Password reset request failed.');
      } else {
        toast('error', 'Password reset request failed.');
      }
    } finally {
      setResetSending(false);
    }
  };

  const handleSetupPasswordRequest = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedPassword = setupPassword.trim();
    const normalizedPasswordConfirm = setupPasswordConfirm.trim();

    if (normalizedPassword.length < 8) {
      toast('error', 'Password must be at least 8 characters.');
      return;
    }

    if (normalizedPassword !== normalizedPasswordConfirm) {
      toast('error', 'Passwords do not match.');
      return;
    }

    setSetupSending(true);
    try {
      await requestPasswordAttach(normalizedPassword);
      setShowSetup(false);
      setSetupPassword('');
      setSetupPasswordConfirm('');
      toast('success', 'Verification link sent. Check your email to finish linking password login.');
    } catch (error) {
      if (error instanceof ApiError) {
        toast('error', error.message || 'Password setup request failed.');
      } else {
        toast('error', 'Password setup request failed.');
      }
    } finally {
      setSetupSending(false);
    }
  };

  const formatProvider = (provider: string) => provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <div>
      <div className="mb-6">
        <Typography variant="h5" fontWeight={700}>Settings</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage your account and preferences
        </Typography>
        {passwordAttachedNotice && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Password login is now linked to your account.
          </Alert>
        )}
      </div>

      {/* Profile */}
      <Paper variant="outlined" className="p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <User size={18} className="text-slate-500" />
          <Typography variant="subtitle1" fontWeight={600}>Profile</Typography>
        </div>
        <div className="flex items-center gap-4">
          {user?.picture ? (
            <Avatar src={user.picture} sx={{ width: 56, height: 56 }} imgProps={{ referrerPolicy: 'no-referrer' }} />
          ) : (
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: 24 }}>
              {user?.given_name?.[0] ?? '?'}
            </Avatar>
          )}
          <div>
            <Typography fontWeight={600}>{user?.name}</Typography>
            <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
          </div>
        </div>
      </Paper>

      {/* Plan & Billing */}
      <Paper variant="outlined" className="p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={18} className="text-slate-500" />
          <Typography variant="subtitle1" fontWeight={600}>Plan &amp; Billing</Typography>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <div>
            <Typography variant="body2" fontWeight={500}>Current plan</Typography>
            <Typography variant="caption" color="text.secondary">Your active subscription tier</Typography>
          </div>
          <Chip label={user?.plan_name ?? 'Free'} size="small" color="default" variant="outlined" />
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <Typography variant="body2" fontWeight={500}>Manage billing</Typography>
            <Typography variant="caption" color="text.secondary">Upgrade, downgrade, or view invoices</Typography>
          </div>
          <Button size="small" variant="outlined" disabled title="Coming soon">
            Manage
          </Button>
        </div>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Billing management is coming soon.
        </Typography>
      </Paper>

      {/* Security */}
      <Paper variant="outlined" className="p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-slate-500" />
          <Typography variant="subtitle1" fontWeight={600}>Security</Typography>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <div>
            <Typography variant="body2" fontWeight={500}>Authentication</Typography>
            <Typography variant="caption" color="text.secondary">
              Signed in via {user?.provider ? `${user.provider.charAt(0).toUpperCase()}${user.provider.slice(1)} Auth` : 'Auth'}
            </Typography>
          </div>
          <Chip label="Active" size="small" color="success" />
        </div>
        <div className="py-3 border-b border-slate-100">
          <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
            Linked identities
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {identities.map((identity) => (
              <Chip
                key={`${identity.provider}:${identity.provider_user_id}`}
                label={`${formatProvider(identity.provider)}${identity.email ? ` • ${identity.email}` : ''}`}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        </div>
        {hasPasswordIdentity && (
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <Typography variant="body2" fontWeight={500}>Password authentication</Typography>
              <Typography variant="caption" color="text.secondary">
                Reset the password identity linked to this account.
              </Typography>
            </div>
            <Button size="small" variant="contained" onClick={() => setShowReset(true)}>
              Reset Password
            </Button>
          </div>
        )}
        {!hasPasswordIdentity && (
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <Typography variant="body2" fontWeight={500}>Add password login</Typography>
              <Typography variant="caption" color="text.secondary">
                Set up password authentication for this account. We will verify via email.
              </Typography>
            </div>
            <Button size="small" variant="contained" onClick={() => setShowSetup(true)}>
              Set Up Password
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between py-3">
          <div>
            <Typography variant="body2" fontWeight={500}>Sign out</Typography>
            <Typography variant="caption" color="text.secondary">Sign out of your account on this device</Typography>
          </div>
          <Button size="small" variant="outlined" onClick={logout}>Sign Out</Button>
        </div>
      </Paper>

      {/* Danger zone */}
      <Paper variant="outlined" sx={{ borderColor: 'error.main' }} className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-red-500" />
          <Typography variant="subtitle1" fontWeight={600} color="error">Danger Zone</Typography>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <Typography variant="body2" fontWeight={500}>Delete account</Typography>
            <Typography variant="caption" color="text.secondary">Permanently delete your account and all data</Typography>
          </div>
          <Button size="small" variant="contained" color="error" startIcon={<Trash2 size={14} />} onClick={() => setShowDelete(true)}>
            Delete
          </Button>
        </div>
      </Paper>

      {/* Delete confirmation */}
      <Dialog open={showDelete} onClose={() => setShowDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent className="flex flex-col gap-4 pt-2!">
          <Alert severity="error" icon={<AlertTriangle size={18} />}>
            This action is irreversible. Your account and all associated data will be permanently destroyed.
          </Alert>
          <FormControlLabel
            control={<Checkbox checked={deleteData} onChange={(e) => setDeleteData(e.target.checked)} />}
            label="Also delete all uploaded files"
            slotProps={{ typography: { variant: 'body2' } }}
          />
          <TextField
            label="Type DELETE to confirm"
            placeholder="DELETE"
            size="small"
            fullWidth
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || deleting}
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {deleting ? 'Deleting...' : 'Delete My Account'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showReset} onClose={() => setShowReset(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <Stack component="form" spacing={2} onSubmit={handleResetRequest} sx={{ pt: 1 }}>
            <Alert severity="info">
              We’ll send a password reset link to the email address on your password identity.
            </Alert>
            <TextField
              label="Email"
              type="email"
              size="small"
              fullWidth
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              autoComplete="email"
              disabled={resetSending}
            />
            <DialogActions sx={{ px: 0, pb: 0 }}>
              <Button onClick={() => setShowReset(false)} disabled={resetSending}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={resetSending}>
                {resetSending ? 'Sending...' : 'Send reset link'}
              </Button>
            </DialogActions>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={showSetup} onClose={() => setShowSetup(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set Up Password Login</DialogTitle>
        <DialogContent>
          <Stack component="form" spacing={2} onSubmit={handleSetupPasswordRequest} sx={{ pt: 1 }}>
            <Alert severity="info">
              Choose a password and confirm using the verification email sent to your account.
            </Alert>
            <TextField
              label="New password"
              type="password"
              size="small"
              fullWidth
              value={setupPassword}
              onChange={(e) => setSetupPassword(e.target.value)}
              autoComplete="new-password"
              disabled={setupSending}
            />
            <TextField
              label="Confirm password"
              type="password"
              size="small"
              fullWidth
              value={setupPasswordConfirm}
              onChange={(e) => setSetupPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={setupSending}
            />
            <DialogActions sx={{ px: 0, pb: 0 }}>
              <Button onClick={() => setShowSetup(false)} disabled={setupSending}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={setupSending}>
                {setupSending ? 'Sending...' : 'Send verification email'}
              </Button>
            </DialogActions>
          </Stack>
        </DialogContent>
      </Dialog>
    </div>
  );
}
