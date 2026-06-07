import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { listWorkspaces, type Workspace } from '@/api';
import WorkspaceAPIKeysPanel from '@/components/WorkspaceAPIKeysPanel';
import PrivateAPIKeysPanel from '@/components/PrivateAPIKeysPanel';
import { useToast } from '@/hooks/useToast';

type APIKeyMode = 'personal' | 'workspace';

function canManageWorkspaceAPIKeys(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

export default function PrivateAPIKeysPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<APIKeyMode>('personal');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      setLoadingWorkspaces(true);
      try {
        const response = await listWorkspaces();
        if (!cancelled) {
          setWorkspaces(response ?? []);
        }
      } catch {
        if (!cancelled) {
          toast('error', 'Failed to load workspaces');
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkspaces(false);
        }
      }
    }

    loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const manageableWorkspaces = useMemo(
    () => workspaces.filter((workspace) => canManageWorkspaceAPIKeys(workspace.role)),
    [workspaces],
  );

  useEffect(() => {
    if (manageableWorkspaces.length === 0) {
      setSelectedWorkspaceId('');
      return;
    }

    if (!manageableWorkspaces.some((workspace) => workspace.workspace_id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(manageableWorkspaces[0].workspace_id);
    }
  }, [manageableWorkspaces, selectedWorkspaceId]);

  const selectedWorkspace = manageableWorkspaces.find((workspace) => workspace.workspace_id === selectedWorkspaceId) ?? null;

  return (
    <div>
      <div className="mb-6">
        <Typography variant="h5" fontWeight={700}>API Keys</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage personal keys and workspace keys from one place.
        </Typography>
      </div>

      <Tabs
        value={mode}
        onChange={(_, value) => setMode(value as APIKeyMode)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider', '& .MuiTabs-scrollButtons.Mui-disabled': { opacity: 0.3 } }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        <Tab value="personal" label="Personal" />
        <Tab value="workspace" label="Workspace" />
      </Tabs>

      {mode === 'personal' ? (
        <PrivateAPIKeysPanel />
      ) : (
        <Box className="flex flex-col gap-4">
        <Alert severity="info">
          Plaintext API key values are only returned when the key is created. This page can reveal and copy keys created in the current browser session; older keys remain manageable, but their plaintext cannot be recovered from the current backend.
        </Alert>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Select workspace
            </Typography>

            {loadingWorkspaces ? (
              <Box className="flex items-center justify-center py-6">
                <CircularProgress size={24} />
              </Box>
            ) : manageableWorkspaces.length === 0 ? (
              <Alert severity="info">
                You can manage workspace API keys only in workspaces where your role is owner or admin.
              </Alert>
            ) : (
              <Box className="flex flex-col gap-2">
                <FormControl fullWidth size="small">
                  <InputLabel id="workspace-api-keys-select-label">Workspace</InputLabel>
                  <Select
                    labelId="workspace-api-keys-select-label"
                    value={selectedWorkspaceId}
                    label="Workspace"
                    onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                  >
                    {manageableWorkspaces.map((workspace) => (
                      <MenuItem key={workspace.workspace_id} value={workspace.workspace_id}>
                        {workspace.name} ({workspace.role})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary">
                  Only workspaces where you are an owner or admin are available here. Workspace-level management inside each workspace remains unchanged.
                </Typography>
              </Box>
            )}
          </Paper>

          {selectedWorkspace && <WorkspaceAPIKeysPanel workspaceId={selectedWorkspace.workspace_id} />}
        </Box>
      )}
    </div>
  );
}