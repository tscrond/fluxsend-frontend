import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router';
import {
  getWorkspaceMembers,
  getWorkspaceInvites,
  createWorkspaceInvite,
  deleteWorkspaceInvite,
  removeWorkspaceMember,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceInvite,
} from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { formatDateFull } from '@/lib/utils';
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
} from '@mui/material';
import { ArrowLeft, Users, Trash2, Mail, FolderOpen, KeyRound, Settings } from 'lucide-react';

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

  useEffect(() => {
    if (!workspaceId) return;
    async function load() {
      setLoadingMembers(true);
      try {
        const [m, i] = await Promise.all([
          getWorkspaceMembers(workspaceId!),
          getWorkspaceInvites(workspaceId!),
        ]);
        setMembers(m ?? []);
        setInvites(i ?? []);
      } catch {
        toast('error', 'Failed to load workspace data');
      } finally {
        setLoadingMembers(false);
      }
    }
    load();
  }, [workspaceId, toast]);

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
      await deleteWorkspaceInvite(invite.id);
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
            {workspace?.name ?? 'Workspace'}
          </Typography>
          {workspace?.slug && (
            <Chip label={`/${workspace.slug}`} size="small" variant="outlined" />
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
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="members" label="Members" icon={<Users size={15} />} iconPosition="start" />
        <Tab value="files" label="Files" icon={<FolderOpen size={15} />} iconPosition="start" disabled />
        <Tab value="api-keys" label="API Keys" icon={<KeyRound size={15} />} iconPosition="start" disabled />
        {(workspace?.role === 'owner' || workspace?.role === 'admin') && (
          <Tab value="administration" label="Administration" icon={<Settings size={15} />} iconPosition="start" />
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
            <Table size="small">
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
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateFull(m.joined_at)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      {/* Administration tab */}
      {tab === 'administration' && (workspace?.role === 'owner' || workspace?.role === 'admin') && (
        <Box className="flex flex-col gap-6">
          {/* Manage members */}
          <div>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Manage members
            </Typography>
            {loadingMembers ? (
              <Box className="flex justify-center py-8"><CircularProgress /></Box>
            ) : (
              <Paper variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Joined</TableCell>
                      <TableCell />
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
                        <TableCell>
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
                    ))}
                  </TableBody>
                </Table>
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
                <Table size="small">
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
                        <TableCell>
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
              </Paper>
            )}
          </div>
        </Box>
      )}
    </div>
  );
}
