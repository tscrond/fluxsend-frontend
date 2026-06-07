import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Check, Copy, Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react';
import {
  createWorkspaceAPIKey,
  deleteWorkspaceAPIKey,
  listWorkspaceAPIKeys,
  type CreatedWorkspaceAPIKey,
  type WorkspaceAPIKey,
} from '@/api';
import { useToast } from '@/hooks/useToast';
import { formatDateFull } from '@/lib/utils';

const SECRET_STORAGE_PREFIX = 'fluxsend.workspaceApiKeys';

const WORKSPACE_SCOPE_OPTIONS = [
  { value: 'workspaces:read', label: 'Workspace metadata: read' },
  { value: 'workspaces:write', label: 'Workspace metadata: write' },
  { value: 'workspaces:delete', label: 'Workspace: delete' },
  { value: 'workspaces:members:read', label: 'Members: read' },
  { value: 'workspaces:members:manage', label: 'Workspace Members: manage' },
  { value: 'workspaces:invites:manage', label: 'Workspace Invites: manage' },
  { value: 'workspaces:files:read', label: 'Workspace Files: read' },
  { value: 'workspaces:files:write', label: 'Workspace Files: write' },
  { value: 'workspaces:files:delete', label: 'Workspace Files: delete' },
] as const;

interface Props {
  workspaceId: string;
}

function storageKey(workspaceId: string): string {
  return `${SECRET_STORAGE_PREFIX}.${workspaceId}`;
}

function readStoredSecrets(workspaceId: string): Record<string, string> {
  try {
    const raw = window.sessionStorage.getItem(storageKey(workspaceId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}

function writeStoredSecrets(workspaceId: string, secrets: Record<string, string>) {
  try {
    window.sessionStorage.setItem(storageKey(workspaceId), JSON.stringify(secrets));
  } catch {
    // ignore storage failures
  }
}

function maskSecret(secret: string): string {
  if (!secret) return '';
  return `${'•'.repeat(Math.max(12, Math.min(secret.length - 6, 28)))}${secret.slice(-6)}`;
}

function createdKeyToListItem(apiKey: CreatedWorkspaceAPIKey): WorkspaceAPIKey {
  return {
    id: apiKey.id,
    name: apiKey.name,
    description: apiKey.description,
    status: 'active',
    scopes: apiKey.scopes,
    created_by: apiKey.created_by,
    created_at: apiKey.created_at,
    last_used_at: null,
  };
}

export default function WorkspaceAPIKeysPanel({ workspaceId }: Props) {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<WorkspaceAPIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceAPIKey | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [sessionSecrets, setSessionSecrets] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['workspaces:read', 'workspaces:files:read']);

  useEffect(() => {
    setSessionSecrets(readStoredSecrets(workspaceId));
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await listWorkspaceAPIKeys(workspaceId);
        if (!cancelled) {
          setApiKeys(response.api_keys ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          toast('error', err instanceof Error ? err.message : 'Failed to load workspace API keys');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, toast]);

  const knownSecretCount = useMemo(
    () => apiKeys.filter((apiKey) => Boolean(sessionSecrets[apiKey.id])).length,
    [apiKeys, sessionSecrets],
  );

  const persistSecrets = (nextSecrets: Record<string, string>) => {
    setSessionSecrets(nextSecrets);
    writeStoredSecrets(workspaceId, nextSecrets);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((value) => value !== scope) : [...prev, scope],
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedScopes.length === 0) return;

    setCreating(true);
    try {
      const response = await createWorkspaceAPIKey(workspaceId, {
        name: name.trim(),
        description: description.trim(),
        scopes: selectedScopes,
      });

      const created = response.api_key;
      setApiKeys((prev) => [createdKeyToListItem(created), ...prev.filter((item) => item.id !== created.id)]);
      persistSecrets({
        ...sessionSecrets,
        [created.id]: created.key,
      });
      setRevealedKeys((prev) => ({ ...prev, [created.id]: false }));
      setName('');
      setDescription('');
      setSelectedScopes(['workspaces:read', 'workspaces:files:read']);
      toast('success', 'Workspace API key created. Copy it now; plaintext is only available after creation.');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to create workspace API key');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (apiKeyId: string) => {
    const secret = sessionSecrets[apiKeyId];
    if (!secret) {
      toast('info', 'Plaintext is only available right after creation in the current session.');
      return;
    }

    try {
      await navigator.clipboard.writeText(secret);
      setCopiedKeyId(apiKeyId);
      window.setTimeout(() => setCopiedKeyId((prev) => (prev === apiKeyId ? null : prev)), 2000);
      toast('success', 'API key copied');
    } catch {
      toast('error', 'Failed to copy API key');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWorkspaceAPIKey(workspaceId, deleteTarget.id);
      setApiKeys((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      const nextSecrets = { ...sessionSecrets };
      delete nextSecrets[deleteTarget.id];
      persistSecrets(nextSecrets);
      setRevealedKeys((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      toast('success', 'Workspace API key revoked');
      setDeleteTarget(null);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to revoke workspace API key');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box className="flex flex-col gap-6">
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          Create workspace API key
        </Typography>
        <Box component="form" onSubmit={handleCreate} className="flex flex-col gap-4">
          <Box className="flex gap-3 flex-wrap">
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="small"
              required
              sx={{ flex: '1 1 220px' }}
              inputProps={{ maxLength: 128 }}
            />
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              size="small"
              sx={{ flex: '2 1 280px' }}
              inputProps={{ maxLength: 255 }}
            />
          </Box>

          <Box>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
              Scopes
            </Typography>
            <Box className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              {WORKSPACE_SCOPE_OPTIONS.map((scope) => (
                <FormControlLabel
                  key={scope.value}
                  control={(
                    <Checkbox
                      checked={selectedScopes.includes(scope.value)}
                      onChange={() => toggleScope(scope.value)}
                    />
                  )}
                  label={scope.label}
                  slotProps={{ typography: { variant: 'body2' } }}
                />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Select the workspace actions this key should be allowed to perform.
            </Typography>
          </Box>

          <Box className="flex items-center justify-between gap-3 flex-wrap">
            <Typography variant="caption" color="text.secondary">
              {selectedScopes.length} scope{selectedScopes.length === 1 ? '' : 's'} selected
            </Typography>
            <Button
              type="submit"
              variant="contained"
              disabled={creating || !name.trim() || selectedScopes.length === 0}
              startIcon={creating ? <CircularProgress size={14} color="inherit" /> : <KeyRound size={15} />}
            >
              {creating ? 'Creating…' : 'Create API key'}
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper variant="outlined">
        <Box className="flex items-center justify-between gap-3 flex-wrap" sx={{ px: 2.5, py: 2 }}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              Workspace API keys
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {apiKeys.length} total, {knownSecretCount} with plaintext still available in this session
            </Typography>
          </Box>
        </Box>

        {loading ? (
          <Box className="flex items-center justify-center py-10">
            <CircularProgress />
          </Box>
        ) : apiKeys.length === 0 ? (
          <Box className="flex flex-col items-center py-12">
            <KeyRound size={40} className="text-slate-400 mb-3" />
            <Typography variant="body2" color="text.secondary">No workspace API keys yet</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Scopes</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Plaintext</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {apiKeys.map((apiKey) => {
                  const secret = sessionSecrets[apiKey.id];
                  const isRevealed = Boolean(revealedKeys[apiKey.id]);
                  return (
                    <TableRow key={apiKey.id} hover>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Typography variant="body2" fontWeight={700}>{apiKey.name}</Typography>
                        {apiKey.description && (
                          <Typography variant="caption" color="text.secondary">{apiKey.description}</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 220 }}>
                        <Box className="flex gap-1 flex-wrap">
                          {apiKey.scopes.map((scope) => (
                            <Chip key={scope} label={scope} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={apiKey.status}
                          size="small"
                          color={apiKey.status === 'active' ? 'success' : 'default'}
                          variant={apiKey.status === 'active' ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 140 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateFull(apiKey.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 260 }}>
                        {secret ? (
                          <TextField
                            fullWidth
                            size="small"
                            value={isRevealed ? secret : maskSecret(secret)}
                            slotProps={{
                              input: {
                                readOnly: true,
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <Box className="flex items-center gap-1">
                                      <Tooltip title={isRevealed ? 'Hide plaintext' : 'Reveal plaintext'}>
                                        <IconButton
                                          size="small"
                                          onClick={() =>
                                            setRevealedKeys((prev) => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))
                                          }
                                        >
                                          {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title={copiedKeyId === apiKey.id ? 'Copied' : 'Copy plaintext'}>
                                        <IconButton size="small" onClick={() => handleCopy(apiKey.id)}>
                                          {copiedKeyId === apiKey.id ? <Check size={16} /> : <Copy size={16} />}
                                        </IconButton>
                                      </Tooltip>
                                    </Box>
                                  </InputAdornment>
                                ),
                              },
                            }}
                          />
                        ) : (
                          <Box>
                            <TextField fullWidth size="small" value="Unavailable after creation" slotProps={{ input: { readOnly: true } }} />
                            <Typography variant="caption" color="text.secondary">
                              Create a new key to test reveal and copy in plaintext.
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Revoke API key">
                          <IconButton color="error" size="small" onClick={() => setDeleteTarget(apiKey)}>
                            <Trash2 size={15} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Revoke workspace API key</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {deleteTarget
              ? `This will revoke \"${deleteTarget.name}\" and remove it from the workspace.`
              : ''}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Revoking…' : 'Revoke'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}