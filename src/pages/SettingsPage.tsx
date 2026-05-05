import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { deleteAccount } from '@/api';
import {
  Paper, Typography, Avatar, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Checkbox, FormControlLabel, Alert, Chip, CircularProgress,
} from '@mui/material';
import { User, Shield, Trash2, AlertTriangle, CreditCard } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [showDelete, setShowDelete] = useState(false);
  const [deleteData, setDeleteData] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

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

  return (
    <div>
      <div className="mb-6">
        <Typography variant="h5" fontWeight={700}>Settings</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage your account and preferences
        </Typography>
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
              Signed in via {user?.provider ? `${user.provider.charAt(0).toUpperCase()}${user.provider.slice(1)} OAuth` : 'OAuth'}
            </Typography>
          </div>
          <Chip label="Active" size="small" color="success" />
        </div>
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
    </div>
  );
}
