import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  listWorkspaces,
  deleteWorkspace,
  renameWorkspace,
  getMyInvites,
  acceptInvite,
  rejectInvite,
  type Workspace,
  type UserInvite,
} from '@/api';
import { useToast } from '@/hooks/useToast';
import { formatDateFull } from '@/lib/utils';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Tooltip,
  TextField,
} from '@mui/material';
import { LayoutGrid, Plus, Trash2, ArrowRight, Check, X, Pencil } from 'lucide-react';

const ROLE_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'warning' | 'error'> = {
  owner: 'primary',
  admin: 'secondary',
  editor: 'warning',
  viewer: 'default',
};

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Workspace | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [actingOnInvite, setActingOnInvite] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [data, inv] = await Promise.all([listWorkspaces(), getMyInvites()]);
        setWorkspaces(data ?? []);
        setInvites(inv ?? []);
      } catch {
        toast('error', 'Failed to load workspaces');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  const handleAccept = async (invite: UserInvite) => {
    setActingOnInvite(invite.id);
    try {
      await acceptInvite(invite.token);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      const data = await listWorkspaces();
      setWorkspaces(data ?? []);
      toast('success', `Joined workspace "${invite.workspace_name}"`);
      window.dispatchEvent(new Event('invites-changed'));
    } catch {
      toast('error', 'Failed to accept invite');
    } finally {
      setActingOnInvite(null);
    }
  };

  const handleReject = async (invite: UserInvite) => {
    setActingOnInvite(invite.id);
    try {
      await rejectInvite(invite.token);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      toast('info', `Declined invite to "${invite.workspace_name}"`);
      window.dispatchEvent(new Event('invites-changed'));
    } catch {
      toast('error', 'Failed to reject invite');
    } finally {
      setActingOnInvite(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWorkspace(deleteTarget.workspace_id);
      setWorkspaces((prev) => prev.filter((w) => w.workspace_id !== deleteTarget.workspace_id));
      toast('success', `Workspace "${deleteTarget.name}" deleted`);
    } catch {
      toast('error', 'Failed to delete workspace');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameName.trim()) return;
    setRenaming(true);
    try {
      await renameWorkspace(renameTarget.workspace_id, renameName.trim());
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.workspace_id === renameTarget.workspace_id ? { ...w, name: renameName.trim() } : w,
        ),
      );
      toast('success', `Workspace renamed to "${renameName.trim()}"`);
      setRenameTarget(null);
    } catch {
      toast('error', 'Failed to rename workspace');
    } finally {
      setRenaming(false);
    }
  };

  if (loading) {
    return (
      <Box className="flex items-center justify-center py-20">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Typography variant="h5" fontWeight={700}>Workspaces</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Collaborate with others in shared workspaces
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => navigate('/workspaces/create')}
        >
          New Workspace
        </Button>
      </div>

      {/* Pending invites section */}
      {invites.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Pending Invites</Typography>
          <div className="flex flex-col gap-2">
            {invites.map((invite) => (
              <Paper
                key={invite.id}
                variant="outlined"
                sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>{invite.workspace_name}</Typography>
                  <Typography variant="caption" color="text.secondary">/{invite.workspace_slug}</Typography>
                </Box>
                <Chip
                  label={invite.role}
                  size="small"
                  color={ROLE_COLORS[invite.role] ?? 'default'}
                  sx={{ flexShrink: 0 }}
                />
                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<Check size={14} />}
                    disabled={actingOnInvite === invite.id}
                    onClick={() => handleAccept(invite)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<X size={14} />}
                    disabled={actingOnInvite === invite.id}
                    onClick={() => handleReject(invite)}
                  >
                    Decline
                  </Button>
                </Box>
              </Paper>
            ))}
          </div>
        </Box>
      )}

      {workspaces.length === 0 ? (
        <Paper variant="outlined" className="flex flex-col items-center py-16 text-center">
          <LayoutGrid size={48} className="text-slate-400 mb-4" />
          <Typography variant="subtitle1" fontWeight={600}>No workspaces yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create a workspace to start collaborating
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Plus size={16} />}
            onClick={() => navigate('/workspaces/create')}
          >
            Create your first workspace
          </Button>
        </Paper>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <Paper
              key={ws.workspace_id}
              variant="outlined"
              sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}
            >
              <Box className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Typography variant="subtitle1" fontWeight={700} noWrap>
                    {ws.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    /{ws.slug}
                  </Typography>
                </div>
                <Chip
                  label={ws.role}
                  size="small"
                  color={ROLE_COLORS[ws.role] ?? 'default'}
                  sx={{ flexShrink: 0 }}
                />
              </Box>

              <Typography variant="caption" color="text.secondary">
                Created {formatDateFull(ws.created_at)}
              </Typography>

              <Box className="flex items-center justify-between" sx={{ mt: 'auto', pt: 1 }}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title={ws.role === 'owner' || ws.role === 'admin' ? 'Rename workspace' : 'Admin or owner only'}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => { setRenameTarget(ws); setRenameName(ws.name); }}
                        disabled={ws.role !== 'owner' && ws.role !== 'admin'}
                      >
                        <Pencil size={16} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={ws.role === 'owner' ? 'Delete workspace' : 'Only the owner can delete'}
                  >
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(ws)}
                        disabled={ws.role !== 'owner'}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<ArrowRight size={14} />}
                  onClick={() => navigate(`/workspaces/${ws.workspace_id}`, { state: { workspace: ws } })}
                >
                  Open
                </Button>
              </Box>
            </Paper>
          ))}
        </div>
      )}

      {/* Rename dialog */}
      <Dialog
        open={!!renameTarget}
        onClose={() => !renaming && setRenameTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Rename workspace</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Workspace name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !renaming && renameName.trim() && renameName.length <= 64) handleRename(); }}
            size="small"
            sx={{ mt: 1 }}
            inputProps={{ maxLength: 64 }}
            error={renameName.length > 64}
            helperText={
              renameName.length > 64
                ? `Name too long (${renameName.length}/64)`
                : `${renameName.length}/64`
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameTarget(null)} disabled={renaming}>
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            variant="contained"
            disabled={renaming || !renameName.trim() || renameName.length > 64}
          >
            {renaming ? 'Saving…' : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete workspace?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone and will remove all members and invites.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
