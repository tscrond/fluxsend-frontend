import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router';
import {
  getWorkspaceMembers,
  getWorkspaceInvites,
  createWorkspaceInvite,
  deleteWorkspaceInvite,
  removeWorkspaceMember,
  renameWorkspace,
  changeMemberRole,
  getWorkspaceQuota,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceInvite,
  type WorkspaceQuota,
} from '@/api';
import { onDataRefresh } from '@/lib/dataRefresh';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { formatDateFull, formatBytes } from '@/lib/utils';
import WorkspaceAPIKeysPanel from '@/components/WorkspaceAPIKeysPanel';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Chip,
  Tabs,
  Tab,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import { ArrowLeft, Users, Trash2, Mail, Pencil, RefreshCw } from 'lucide-react';
import WorkspaceFilesBrowser from '@/components/WorkspaceFilesBrowser';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const ROLE_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'warning' | 'error'> = {
  owner: 'primary',
  admin: 'secondary',
  editor: 'warning',
  viewer: 'default',
};

type TabValue = 'members' | 'files' | 'api-keys' | 'administration';

export default function WorkspaceDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Workspace info passed via navigation state from the list page
  const workspace: Workspace | undefined = (location.state as { workspace?: Workspace })?.workspace;

  const [tab, setTab] = useState<TabValue>('members');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [removingInvite, setRemovingInvite] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  // Quota state
  const [quota, setQuota] = useState<WorkspaceQuota | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(false);

  // Rename state
  const [localName, setLocalName] = useState<string>(workspace?.name ?? '');
  const [localSlug, setLocalSlug] = useState<string>(workspace?.slug ?? '');
  const [renameName, setRenameName] = useState<string>(workspace?.name ?? '');
  const [renameSlug, setRenameSlug] = useState<string>(workspace?.slug ?? '');
  const [renameSlugTouched, setRenameSlugTouched] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const canManageWorkspace = workspace?.role === 'owner' || workspace?.role === 'admin';

  const loadQuota = useCallback(async () => {
    if (!workspaceId || !canManageWorkspace) return;
    setLoadingQuota(true);
    try {
      const data = await getWorkspaceQuota(workspaceId);
      setQuota(data);
    } catch {
      // non-fatal
    } finally {
      setLoadingQuota(false);
    }
  }, [workspaceId, canManageWorkspace]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  useEffect(() => {
    return onDataRefresh((detail) => {
      if (!detail.workspaceQuota || detail.workspaceId !== workspaceId) return;
      loadQuota();
    });
  }, [workspaceId, loadQuota]);

  useEffect(() => {
    if (!workspaceId) return;
    async function load() {
      setLoadingMembers(true);
      try {
        const m = await getWorkspaceMembers(workspaceId!);
        setMembers(m ?? []);
      } catch {
        toast('error', 'Failed to load workspace members');
      } finally {
        setLoadingMembers(false);
      }
      if (canManageWorkspace) {
        try {
          const i = await getWorkspaceInvites(workspaceId!);
          setInvites(i ?? []);
        } catch {
          // non-fatal — invites simply won't show
        }
      }
    }
    load();
  }, [workspaceId, canManageWorkspace, toast]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !workspaceId) return;
    setInviting(true);
    try {
      const result = await createWorkspaceInvite(workspaceId, inviteEmail.trim(), inviteRole);
      setInvites((prev) => [...prev, result]);
      toast('success', `Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('already_a_member')) {
        toast('error', `${inviteEmail} is already a member`);
      } else {
        toast('error', 'Failed to add member');
      }
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteInvite = async (invite: WorkspaceInvite) => {
    setRemovingInvite(invite.id);
    try {
      await deleteWorkspaceInvite(invite.id, invite.workspace_id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      toast('success', 'Invite removed');
    } catch {
      toast('error', 'Failed to remove invite');
    } finally {
      setRemovingInvite(null);
    }
  };

  const handleRemoveMember = async (member: WorkspaceMember) => {
    if (!workspaceId) return;
    setRemovingMember(member.user_id);
    try {
      await removeWorkspaceMember(workspaceId, member.user_id);
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
      toast('success', `${member.email} removed from workspace`);
    } catch {
      toast('error', 'Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  const handleChangeRole = async (member: WorkspaceMember, newRole: 'owner' | 'admin' | 'editor' | 'viewer') => {
    if (!workspaceId) return;
    setUpdatingRole(member.user_id);
    try {
      await changeMemberRole(workspaceId, member.user_id, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === member.user_id ? { ...m, role: newRole } : m)),
      );
      toast('success', `${member.email}'s role changed to ${newRole}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('only_owner_can_assign_owner_role')) {
        toast('error', 'Only the owner can assign the owner role');
      } else if (msg.includes('cannot_change_owner_role')) {
        toast('error', "Cannot change the owner's role");
      } else {
        toast('error', 'Failed to change role');
      }
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !renameName.trim()) return;
    setRenaming(true);
    try {
      const slugToSend = renameSlug.trim() !== localSlug ? renameSlug.trim() : undefined;
      await renameWorkspace(workspaceId, renameName.trim(), slugToSend);
      setLocalName(renameName.trim());
      if (slugToSend) setLocalSlug(slugToSend);
      setRenameSlugTouched(false);
      toast('success', 'Workspace updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast('error', 'That slug is already taken');
      } else {
        toast('error', 'Failed to update workspace');
      }
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button
          startIcon={<ArrowLeft size={16} />}
          variant="text"
          onClick={() => navigate('/workspaces')}
          sx={{ mb: 2, pl: 0 }}
        >
          Back to Workspaces
        </Button>
        <Box className="flex items-center gap-3 flex-wrap">
          <Typography variant="h5" fontWeight={700}>
            {localName || workspace?.name || 'Workspace'}
          </Typography>
          {workspace?.slug && (
            <Chip label={`/${localSlug || workspace.slug}`} size="small" variant="outlined" />
          )}
          {workspace?.role && (
            <Chip
              label={workspace.role}
              size="small"
              color={ROLE_COLORS[workspace.role] ?? 'default'}
            />
          )}
        </Box>
      </div>

      {/* Sub-nav tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as TabValue)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider', '& .MuiTabs-scrollButtons.Mui-disabled': { opacity: 0.3 } }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        <Tab value="members" label="Members" />
        <Tab value="files" label="Files" />
        {canManageWorkspace && <Tab value="api-keys" label="API Keys" />}
        {canManageWorkspace && (
          <Tab value="administration" label="Administration" />
        )}
      </Tabs>

      {/* Members tab */}
      {tab === 'members' && (
        <Paper variant="outlined">
          {loadingMembers ? (
            <Box className="flex items-center justify-center py-12">
              <CircularProgress />
            </Box>
          ) : members.length === 0 ? (
            <Box className="flex flex-col items-center py-12">
              <Users size={40} className="text-slate-400 mb-3" />
              <Typography variant="body2" color="text.secondary">No members yet</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small" sx={{ minWidth: 480 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Joined</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.user_id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {m.email}
                          {m.email === user?.email && (
                            <Chip label="You" size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 18 }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={m.role} size="small" color={ROLE_COLORS[m.role] ?? 'default'} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateFull(m.joined_at)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Files tab */}
      {tab === 'files' && workspaceId && workspace?.role && (
        <WorkspaceFilesBrowser workspaceId={workspaceId} role={workspace.role} />
      )}

      {tab === 'api-keys' && workspaceId && canManageWorkspace && (
        <WorkspaceAPIKeysPanel workspaceId={workspaceId} />
      )}

      {/* Administration tab */}
      {tab === 'administration' && canManageWorkspace && (
        <Box className="flex flex-col gap-6">
          {/* Plan limits */}
          <div>
            <Box className="flex items-center justify-between gap-2 mb-1.5">
              <Typography variant="subtitle2" fontWeight={700}>
                Plan limits
              </Typography>
              <Tooltip title="Refresh quota">
                <span>
                  <IconButton size="small" onClick={loadQuota} disabled={loadingQuota}>
                    <RefreshCw size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              {loadingQuota ? (
                <Box className="flex justify-center py-6"><CircularProgress size={24} /></Box>
              ) : quota ? (
                <Box className="flex flex-col gap-4">
                  {[
                    {
                      label: 'Files',
                      used: quota.file_count,
                      max: quota.max_files_workspace,
                      format: (n: number) => n.toLocaleString(),
                    },
                    {
                      label: 'Storage',
                      used: quota.total_bytes,
                      max: quota.max_total_storage_bytes_workspace,
                      format: formatBytes,
                    },
                    {
                      label: 'Folders',
                      used: quota.folder_count,
                      max: quota.max_workspace_folders,
                      format: (n: number) => n.toLocaleString(),
                    },
                    {
                      label: 'Members',
                      used: quota.member_count,
                      max: quota.max_users_workspace,
                      format: (n: number) => n.toLocaleString(),
                    },
                    {
                      label: 'API Keys',
                      used: quota.api_key_count,
                      max: quota.max_workspace_api_keys,
                      format: (n: number) => n.toLocaleString(),
                    },
                  ].map(({ label, used, max, format }) => {
                    const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
                    const color = pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'primary';
                    return (
                      <Box key={label}>
                        <Box className="flex justify-between items-baseline mb-1">
                          <Typography variant="body2" fontWeight={500}>{label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {format(used)} / {format(max)}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          color={color}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">Could not load quota information.</Typography>
              )}
            </Paper>
          </div>

          {/* Rename workspace */}
          <div>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Rename workspace
            </Typography>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Box component="form" onSubmit={handleRename} className="flex items-end gap-3 flex-wrap">
                <TextField
                  label="Workspace name"
                  value={renameName}
                  onChange={(e) => {
                    setRenameName(e.target.value);
                    if (!renameSlugTouched) setRenameSlug(slugify(e.target.value));
                  }}
                  size="small"
                  required
                  sx={{ flex: '1 1 200px' }}
                  inputProps={{ maxLength: 64 }}
                  error={renameName.length > 64}
                  helperText={
                    renameName.length > 64
                      ? `Name too long (${renameName.length}/64)`
                      : `${renameName.length}/64`
                  }
                />
                <TextField
                  label="Slug"
                  value={renameSlug}
                  onChange={(e) => {
                    setRenameSlugTouched(true);
                    setRenameSlug(slugify(e.target.value));
                  }}
                  size="small"
                  required
                  sx={{ flex: '1 1 160px' }}
                  inputProps={{ maxLength: 48 }}
                  error={renameSlug.length > 48}
                  helperText={
                    renameSlug.length > 48
                      ? `Slug too long (${renameSlug.length}/48)`
                      : `${renameSlug.length}/48`
                  }
                  slotProps={{ input: { startAdornment: <Typography variant="caption" sx={{ mr: 0.5, color: 'text.secondary' }}>/</Typography> } }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={
                    renaming ||
                    !renameName.trim() ||
                    !renameSlug.trim() ||
                    renameName.length > 64 ||
                    renameSlug.length > 48 ||
                    (renameName.trim() === localName && renameSlug.trim() === localSlug)
                  }
                  startIcon={<Pencil size={15} />}
                >
                  {renaming ? 'Saving…' : 'Save'}
                </Button>
              </Box>
            </Paper>
          </div>

          {/* Manage members */}
          <div>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Manage members
            </Typography>
            {loadingMembers ? (
              <Box className="flex justify-center py-8"><CircularProgress /></Box>
            ) : (
              <Paper variant="outlined">
                <TableContainer>
                <Table size="small" sx={{ minWidth: 480 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Joined</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {members.map((m) => {
                      const canChangeRole =
                        m.email !== user?.email &&
                        !(workspace?.role === 'admin' && m.role === 'owner');
                      const roleOptions: Array<'owner' | 'admin' | 'editor' | 'viewer'> =
                        workspace?.role === 'owner'
                          ? ['owner', 'admin', 'editor', 'viewer']
                          : ['admin', 'editor', 'viewer'];
                      return (
                      <TableRow key={m.user_id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {m.email}
                            {m.email === user?.email && (
                              <Chip label="You" size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 18 }} />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ minWidth: 130 }}>
                          {canChangeRole ? (
                            <Select
                              value={m.role}
                              size="small"
                              disabled={updatingRole === m.user_id}
                              onChange={(e) =>
                                handleChangeRole(m, e.target.value as 'owner' | 'admin' | 'editor' | 'viewer')
                              }
                              sx={{ fontSize: '0.8rem' }}
                            >
                              {roleOptions.map((r) => (
                                <MenuItem key={r} value={r} sx={{ fontSize: '0.8rem' }}>
                                  {r}
                                </MenuItem>
                              ))}
                            </Select>
                          ) : (
                            <Chip label={m.role} size="small" color={ROLE_COLORS[m.role] ?? 'default'} />
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateFull(m.joined_at)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {m.role !== 'owner' && m.email !== user?.email && (
                            <Tooltip title="Remove from workspace">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveMember(m)}
                                disabled={removingMember === m.user_id}
                              >
                                <Trash2 size={15} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </TableContainer>
              </Paper>
            )}
          </div>
          {/* Invite form */}
          <div>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Invite member
            </Typography>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Box
                component="form"
                onSubmit={handleSendInvite}
                className="flex items-end gap-3 flex-wrap"
              >
                <TextField
                  label="Email address"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  size="small"
                  required
                  sx={{ flex: '1 1 220px' }}
                  placeholder="colleague@example.com"
                />
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={inviteRole}
                    label="Role"
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                  >
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="editor">Editor</MenuItem>
                    <MenuItem value="viewer">Viewer</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={inviting || !inviteEmail.trim()}
                  startIcon={<Mail size={15} />}
                >
                  {inviting ? 'Sending…' : 'Send Invite'}
                </Button>
              </Box>
            </Paper>
          </div>

          {/* Pending invites */}
          <div>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Pending invites
            </Typography>
            {loadingMembers ? (
              <Box className="flex justify-center py-8"><CircularProgress /></Box>
            ) : invites.length === 0 ? (
              <Paper variant="outlined">
                <Box className="flex flex-col items-center py-10">
                  <Mail size={36} className="text-slate-400 mb-3" />
                  <Typography variant="body2" color="text.secondary">No pending invites</Typography>
                </Box>
              </Paper>
            ) : (
              <Paper variant="outlined">
                <TableContainer>
                <Table size="small" sx={{ minWidth: 420 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Expires</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invites.map((inv) => (
                      <TableRow key={inv.id} hover>
                        <TableCell>{inv.email}</TableCell>
                        <TableCell>
                          <Chip label={inv.role} size="small" color={ROLE_COLORS[inv.role] ?? 'default'} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography
                            variant="caption"
                            color={isExpired(inv.expires_at) ? 'error' : 'text.secondary'}
                          >
                            {isExpired(inv.expires_at) ? 'Expired' : formatDateFull(inv.expires_at)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Remove invite">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteInvite(inv)}
                              disabled={removingInvite === inv.id}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </TableContainer>
              </Paper>
            )}
          </div>
        </Box>
      )}
    </div>
  );
}
